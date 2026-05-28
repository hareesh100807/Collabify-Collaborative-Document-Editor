import React, { useEffect, useRef, useState, useCallback } from "react";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import { useNavigate, useParams } from "react-router-dom";
import { io } from "socket.io-client";
import { useAuth } from "../context/AuthContext";
import { addCollaborator, renameDocument, getCollaborators } from "../api/documentService.js";
const FontStyle = ReactQuill.Quill.import('attributors/style/font');
FontStyle.whitelist = [
  'sans-serif', 'serif', 'monospace',
  'Inter', 'Roboto', 'Arial', 'Georgia',
  'Times New Roman', 'Courier New', 'Comic Sans MS',
  'Trebuchet MS', 'Verdana'
];
ReactQuill.Quill.register(FontStyle, true);
const SizeStyle = ReactQuill.Quill.import('attributors/style/size');
SizeStyle.whitelist = ['10px','12px','14px','16px','18px','20px','24px','28px','36px','48px','72px'];
ReactQuill.Quill.register(SizeStyle, true);
// Expose whitelist arrays for the toolbar dropdowns
const FONT_LIST = FontStyle.whitelist;
const SIZE_LIST = SizeStyle.whitelist;
// Pre-defined color palette
const colors = [
  "", // Empty option for "default/clear"
  "#000000", "#e60000", "#ff9900", "#ffff00", "#008a00", "#0066cc", "#9933ff",
  "#ffffff", "#facccc", "#ffebcc", "#ffffcc", "#cce8cc", "#cce0f5", "#ebd6ff",
  "#bbbbbb", "#f06666", "#ffc266", "#ffff66", "#66b966", "#66a3e0", "#c285ff",
  "#888888", "#a10000", "#b26b00", "#b2b200", "#006100", "#0047b2", "#6b24b2",
  "#444444", "#5c0000", "#663d00", "#666600", "#003700", "#002966", "#3d1466",
  "#4f46e5", "#ec4899", "#14b8a6", "#f59e0b" // custom additions
];
// Custom Shape Blot for SVGs
const BlockEmbed = ReactQuill.Quill.import('blots/block/embed');
class ShapeBlot extends BlockEmbed {
  static create(value) {
    let node = super.create();
    node.setAttribute('data-shape', value);
    node.setAttribute('contenteditable', 'false');
    node.className = "shape-container"; 
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 100 100");
    svg.setAttribute("width", "120");
    svg.setAttribute("height", "120");
    svg.setAttribute("class", `shape-embed shape-${value}`);
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("fill", "#6366f1"); // default indigo color
    const shapes = {
      rectangle: "M10 10 H 90 V 90 H 10 Z",
      circle: "M 50, 50 m -40, 0 a 40,40 0 1,0 80,0 a 40,40 0 1,0 -80,0",
      triangle: "M 50 10 L 90 90 L 10 90 Z",
      diamond: "M 50 10 L 90 50 L 50 90 L 10 50 Z",
      hexagon: "M 30 10 L 70 10 L 90 50 L 70 90 L 30 90 L 10 50 Z",
      star: "M 50 5 L 61 39 L 97 39 L 68 60 L 79 94 L 50 73 L 21 94 L 32 60 L 3 39 L 39 39 Z",
      arrowRight: "M 10 35 L 50 35 L 50 15 L 90 50 L 50 85 L 50 65 L 10 65 Z",
      heart: "M 50 30 C 50 30 45 10 25 10 C 5 10 5 40 5 40 C 5 60 50 90 50 90 C 50 90 95 60 95 40 C 95 40 95 10 75 10 C 55 10 50 30 50 30 Z",
      cloud: "M 25 60 A 20 20 0 0 1 45 40 A 25 25 0 0 1 85 50 A 15 15 0 0 1 85 80 L 25 80 A 10 10 0 0 1 25 60 Z"
    };
    path.setAttribute("d", shapes[value] || shapes.rectangle);
    svg.appendChild(path);
    node.appendChild(svg);
    return node;
  }
  static value(node) {
    return node.getAttribute('data-shape');
  }
}
ShapeBlot.blotName = 'shape';
ShapeBlot.tagName = 'div';
ReactQuill.Quill.register(ShapeBlot, true);
// Custom Video Blot for Local Files
const BlockEmbedVideo = ReactQuill.Quill.import('blots/block/embed');
class LocalVideoBlot extends BlockEmbedVideo {
  static create(value) {
    const node = super.create();
    node.setAttribute('contenteditable', 'false');
    node.className = 'video-container';
    const video = document.createElement('video');
    video.setAttribute('controls', true);
    video.setAttribute('src', value);
    video.setAttribute('style', 'max-width:100%;');
    // Ensure safe playback without autoplay
    video.setAttribute('playsinline', 'true');
    video.muted = true;
    video.autoplay = false;
    // No automatic play to avoid AbortError
    node.appendChild(video);
    return node;
  }
  static value(node) {
    const video = node.querySelector('video');
    return video ? video.getAttribute('src') : '';
  }
}
LocalVideoBlot.blotName = 'localVideo';
LocalVideoBlot.tagName = 'div';
ReactQuill.Quill.register(LocalVideoBlot, true);
(function suppressVideoAbortError() {
  // 1. Wrap HTMLMediaElement.play so every promise has a .catch()
  const _origPlay = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function (...args) {
    try {
      const p = _origPlay.apply(this, args);
      if (p && typeof p.then === 'function') {
        p.catch(err => {
          if (err && err.name === 'AbortError') return; // benign when element removed
          setTimeout(() => { throw err; });
        });
      }
      return p;
    } catch (err) {
      if (err && err.name === 'AbortError') return Promise.resolve();
      return Promise.reject(err);
    }
  };
  // 2. Catch any remaining unhandled rejections with name "AbortError"
  window.addEventListener('unhandledrejection', (e) => {
    try {
      if (e.reason && e.reason.name === 'AbortError') {
        e.preventDefault();
      }
    } catch (err) {
      // ignore
    }
  });
})();
const CustomToolbar = React.memo(({ onUndo, onRedo, onSave }) => (
  <div id="custom-toolbar" className="custom-ribbon">
    {/* Actions Section */}
    <div className="ribbon-section">
      <div className="ribbon-group">
        <span className="ql-formats">
          <button onClick={onUndo} title="Undo (Ctrl+Z)" className="ribbon-action-btn">
            <svg viewBox="0 0 18 18">
              <path className="ql-fill ql-stroke" d="M4.5,9a5.5,5.5,0,1,1,11,0v3.5H13V9a3.5,3.5,0,1,0-7,0v.5h2L4.5,13,1,9.5h2V9Z"/>
            </svg>
          </button>
          <button onClick={onRedo} title="Redo (Ctrl+Y)" className="ribbon-action-btn">
            <svg viewBox="0 0 18 18">
              <path className="ql-fill ql-stroke" d="M13.5,9a5.5,5.5,0,1,0-11,0v3.5H4.5V9a3.5,3.5,0,1,1,7,0v.5h-2L13.5,13l3.5-3.5h-2V9Z"/>
            </svg>
          </button>
          <button onClick={onSave} title="Force Save (Ctrl+S)" className="ribbon-action-btn" style={{ stroke: '#4f46e5', padding: '2px' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '18px', height: '18px' }}>
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
              <polyline points="17 21 17 13 7 13 7 21"></polyline>
              <polyline points="7 3 7 8 15 8"></polyline>
            </svg>
          </button>
        </span>
      </div>
      <div className="ribbon-label">Actions</div>
    </div>
    <div className="ribbon-divider"></div>
    {/* Font Section */}
    <div className="ribbon-section">
      <div className="ribbon-group">
        <span className="ql-formats">
          <select className="ql-font" defaultValue="" title="Font Family">
            <option value="">Default Font</option>
            {FONT_LIST.map(font => <option value={font} key={font}>{font}</option>)}
          </select>
          <select className="ql-size" defaultValue="" title="Font Size">
            <option value="">Default Size</option>
            {SIZE_LIST.map(size => <option value={size} key={size}>{size}</option>)}
          </select>
        </span>
        <span className="ql-formats">
          <button className="ql-bold" title="Bold (Ctrl+B)" />
          <button className="ql-italic" title="Italic (Ctrl+I)" />
          <button className="ql-underline" title="Underline (Ctrl+U)" />
          <button className="ql-strike" title="Strikethrough" />
          <button className="ql-script" value="sub" title="Subscript" />
          <button className="ql-script" value="super" title="Superscript" />
        </span>
        <span className="ql-formats">
          <select className="ql-color" title="Text Color">
            {colors.map((c, i) => <option value={c} key={`color-${i}`}></option>)}
          </select>
          <select className="ql-background" title="Highlight Color">
            {colors.map((c, i) => <option value={c} key={`bg-${i}`}></option>)}
          </select>
        </span>
        <span className="ql-formats">
          <button className="ql-clean" title="Clear Formatting" />
        </span>
      </div>
      <div className="ribbon-label">Font</div>
    </div>
    <div className="ribbon-divider"></div>
    {/* Paragraph Section */}
    <div className="ribbon-section">
      <div className="ribbon-group">
        <span className="ql-formats">
          <button className="ql-list" value="ordered" title="Numbered List" />
          <button className="ql-list" value="bullet" title="Bullet List" />
          <button className="ql-list" value="check" title="Checklist" />
        </span>
        <span className="ql-formats">
          <button className="ql-align" value="" title="Align Left" />
          <button className="ql-align" value="center" title="Align Center" />
          <button className="ql-align" value="right" title="Align Right" />
          <button className="ql-align" value="justify" title="Justify" />
        </span>
        <span className="ql-formats">
          <button className="ql-indent" value="-1" title="Decrease Indent" />
          <button className="ql-indent" value="+1" title="Increase Indent" />
          <button className="ql-direction" value="rtl" title="Right-to-Left Direction" />
        </span>
      </div>
      <div className="ribbon-label">Paragraph</div>
    </div>
    <div className="ribbon-divider"></div>
    {/* Styles Section */}
    <div className="ribbon-section">
      <div className="ribbon-group">
        <span className="ql-formats">
          <select className="ql-header" defaultValue="" title="Heading Styles">
            <option value="1"></option>
            <option value="2"></option>
            <option value="3"></option>
            <option value="4"></option>
            <option value="5"></option>
            <option value="6"></option>
            <option value=""></option>
          </select>
        </span>
      </div>
      <div className="ribbon-label">Styles</div>
    </div>
    <div className="ribbon-divider"></div>
    {/* Insert Section */}
    <div className="ribbon-section">
      <div className="ribbon-group">
        <span className="ql-formats">
          <button className="ql-link" title="Insert Link" />
          <button className="ql-image" title="Insert Image" />
          <button className="ql-video" title="Insert Video" />
          <button className="ql-formula" title="Insert Formula" />
        </span>
        <span className="ql-formats">
          <button className="ql-blockquote" title="Blockquote" />
          <button className="ql-code-block" title="Code Block" />
        </span>
        <span className="ql-formats">
          <select className="ql-shape" defaultValue="" title="Insert Shape">
            <option value="" disabled hidden>Shape</option>
            <option value="rectangle">Rectangle</option>
            <option value="circle">Circle</option>
            <option value="triangle">Triangle</option>
            <option value="diamond">Diamond</option>
            <option value="hexagon">Hexagon</option>
            <option value="star">Star</option>
            <option value="arrowRight">Arrow</option>
            <option value="heart">Heart</option>
            <option value="cloud">Cloud</option>
          </select>
        </span>
      </div>
      <div className="ribbon-label">Insert</div>
    </div>
  </div>
));
const modules = {
  toolbar: {
    container: "#custom-toolbar"
  },
  history: {
    delay: 1000,
    maxStack: 100,
    userOnly: true
  },
  clipboard: {
    matchVisual: false, // Prevent extra whitespace on paste
  },
};
const formats = [
  "font", "size",
  "header",
  "bold", "italic", "underline", "strike",
  "script",
  "color", "background",
  "align", "indent", "direction",
  "list",
  "blockquote", "code-block",
  "link", "image", "video", "formula",
  "shape", "localVideo",
];
const EditorPage = () => {
  const { id: documentId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const quillRef = useRef(null);
  const [socket, setSocket] = useState(null);
  const [documentTitle, setDocumentTitle] = useState("Untitled Document");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState("");
  const [activeUsers, setActiveUsers] = useState([]);
  const [typingUser, setTypingUser] = useState("");
  const [shareEmail, setShareEmail] = useState("");
  const [shareLoading, setShareLoading] = useState(false);
  const [shareMessage, setShareMessage] = useState("");
  const [showCollabModal, setShowCollabModal] = useState(false);
  const [collabInfo, setCollabInfo] = useState({ owner: null, collaborators: [], pendingCollaborators: [] });
  const [selectedImg, setSelectedImg] = useState(null);
  const [pendingShape, setPendingShape] = useState(null);
  const [overlayStyle, setOverlayStyle] = useState({ display: "none" });
  useEffect(() => {
    window.__REACT_SHAPE_SETTER__ = setPendingShape;
    return () => {
      delete window.__REACT_SHAPE_SETTER__;
    };
  }, []);
  useEffect(() => {
    const attach = () => {
      const quill = quillRef.current?.getEditor?.();
      if (!quill) return;
      // Track every selection change inside the editor
      const onSelectionChange = (range) => {
        if (range) quill.__savedRange = range;
      };
      quill.on('selection-change', onSelectionChange);
      // Capture selection on toolbar mousedown BEFORE blur fires
      const toolbar = document.getElementById('custom-toolbar');
      const onToolbarMouseDown = () => {
        const cur = quill.getSelection();
        if (cur) quill.__savedRange = cur;
      };
      if (toolbar) toolbar.addEventListener('mousedown', onToolbarMouseDown, true);
      return () => {
        quill.off('selection-change', onSelectionChange);
        if (toolbar) toolbar.removeEventListener('mousedown', onToolbarMouseDown, true);
      };
    };
    // ReactQuill may not have mounted the editor yet on first render tick
    let cleanup;
    const timer = setTimeout(() => {
      cleanup = attach();
    }, 0);
    return () => {
      clearTimeout(timer);
      if (cleanup) cleanup();
    };
  }, []); // run once after mount
  const reposition = useCallback(() => {
    if (!selectedImg || !document.body.contains(selectedImg)) {
      setSelectedImg(null);
      setOverlayStyle({ display: "none" });
      return;
    }
    const imgRect = selectedImg.getBoundingClientRect();
    const editorWrapper = document.querySelector('.editor-wrapper');
    if (!editorWrapper) return;
    const wrapperRect = editorWrapper.getBoundingClientRect();  
    setOverlayStyle({
      top: imgRect.top - wrapperRect.top,
      left: imgRect.left - wrapperRect.left,
      width: imgRect.width,
      height: imgRect.height,
      display: 'block'
    });
  }, [selectedImg]);
  const handleMouseDown = (e, direction) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = selectedImg.clientWidth;
    const startHeight = selectedImg.clientHeight;
    const aspectRatio = startWidth / startHeight;  
    const handleMouseMove = (moveEvent) => {
      let dx = moveEvent.clientX - startX;
      let newWidth = startWidth;
      if (direction === 'br' || direction === 'tr') {
        newWidth = startWidth + dx;
      } else if (direction === 'bl' || direction === 'tl') {
        newWidth = startWidth - dx;
      }
      if (newWidth < 50) newWidth = 50;
      selectedImg.style.width = `${newWidth}px`;
      selectedImg.style.height = `${newWidth / aspectRatio}px`;
      reposition();
    };
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      const finalWidth = selectedImg.clientWidth;
      const finalHeight = selectedImg.clientHeight;
      const blot = ReactQuill.Quill.find(selectedImg);
      if (blot) {
        blot.format('width', `${finalWidth}px`);
        blot.format('height', `${finalHeight}px`);
      }
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };
  /* Listen to clicks inside editor to select image */
  useEffect(() => {
    const editor = quillRef.current?.getEditor();
    if (!editor) return;
    const handleEditorClick = (e) => {
      const quill = quillRef.current?.getEditor();
      if (!quill) return;
      if (e.target.tagName === 'IMG') {
        setSelectedImg(e.target);
        return;
      }
      // Check if a shape container was clicked
      const shapeElem = e.target.closest('.shape-container');
      if (shapeElem) {
        setSelectedImg(shapeElem);
        return;
      }
      // If a pending shape is set, insert it at cursor
      if (pendingShape) {
        const range = quill.getSelection(true);
        const index = range ? range.index : quill.getLength();
        quill.insertEmbed(index, 'shape', pendingShape);
        quill.setSelection(index + 1);
        setPendingShape(null);
        const shapeSelect = document.querySelector('.ql-shape');
        if (shapeSelect) shapeSelect.value = '';
        return;
      }
      setSelectedImg(null);
    };
    const root = editor.root;
    root.addEventListener('click', handleEditorClick);
    return () => {
      root.removeEventListener('click', handleEditorClick);
    };
  }, [quillRef.current]);
  /* Monitor selection scroll/resize and escape key */
  useEffect(() => {
    if (!selectedImg) {
      setOverlayStyle({ display: "none" });
      return;
    }
    const qlContainer = selectedImg.closest('.ql-container');
    if (!qlContainer) return;
    qlContainer.addEventListener('scroll', reposition);
    window.addEventListener('resize', reposition);
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' || e.key === 'Backspace' || e.key === 'Delete') {
        if (e.key === 'Escape') {
          setSelectedImg(null);
        } else {
          // If deleted, hide overlay after a tick
          setTimeout(reposition, 0);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    // Initial position
    reposition();
    return () => {
      qlContainer.removeEventListener('scroll', reposition);
      window.removeEventListener('resize', reposition);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedImg, reposition]);
  /* SOCKET CONNECTION */
  useEffect(() => {
    const s = io(import.meta.env.VITE_BACKEND_URL || "http://localhost:4000", {
      withCredentials: true,
    });
    setSocket(s);
    return () => {
      s.disconnect();
    };
  }, []);
  /* SOCKET DOCUMENT RENAMED */
  useEffect(() => {
    if (!socket) return;
    const renamedHandler = ({ title }) => {
      setDocumentTitle(title);
    };
    socket.on('document-renamed', renamedHandler);
    return () => {
      socket.off('document-renamed', renamedHandler);
    };
  }, [socket]);
  /*  LOAD DOCUMENT */
  useEffect(() => {
    if (!socket || !quillRef.current) return;
    const quill = quillRef.current.getEditor();
    quill.enable(false);
    socket.emit("join-document", documentId);
    /*LOAD DOCUMENT*/
    socket.once("load-document", (document) => {
      setDocumentTitle(document.title || "Untitled Document");
      quill.setContents(document.content || { ops: [] });
      quill.enable(true);
    });
    /*DOCUMENT NOT FOUND*/
    socket.on("document-not-found", () => {
      alert("Document not found");
      navigate("/dashboard");
    });
    /*NOT AUTHORIZED*/
    socket.on("not-authorized", () => {
      alert("You are not authorized to access this document");
      navigate("/dashboard");
    });
    /*ACTIVE USERS*/
    socket.on("active-users", (users) => {
      setActiveUsers(users);
    });
    /*RECEIVE CHANGES*/
    const receiveChangesHandler = (delta) => {
        quill.updateContents(delta, "silent");
    };
    socket.on("receive-changes", receiveChangesHandler);
    /* TYPING */
    socket.on("user-typing", (username) => {
      setTypingUser(username);
    });
    socket.on("user-stop-typing", () => {
      setTypingUser("");
    });
    return () => {
      socket.off("load-document");
      socket.off("document-not-found");
      socket.off("not-authorized");
      socket.off("active-users");
      socket.off("receive-changes", receiveChangesHandler);
      socket.off("user-typing");
      socket.off("user-stop-typing");
    };
  }, [socket, documentId, navigate]);
  /*SEND CHANGES */
  useEffect(() => {
    if (!socket || !quillRef.current) return;
    const quill = quillRef.current.getEditor();
    let typingTimeout;
    const textChangeHandler = ( delta, oldDelta, source ) => {
      if (source !== "user") return;
      /*SEND CHANGES*/
      socket.emit("send-changes", delta, documentId);
      /* TYPING */
      socket.emit("typing", { documentId, username: user?.username });
      clearTimeout(typingTimeout);
      typingTimeout = setTimeout(() => {
        socket.emit("stop-typing", { documentId, username: user?.username });
        // Save document after user stops typing
        const currentContent = quill.getContents();
        socket.emit("save-document", { documentId, content: currentContent });
      }, 1000);
    };
    quill.on("text-change", textChangeHandler);
    return () => {
      quill.off("text-change", textChangeHandler);
    };
  }, [socket, documentId]);

  //document sharing
  const handleShareDocument = async () => {
    if(!shareEmail.trim()) return;
    try{
      setShareLoading(true);
      setShareMessage("");
      const response= await addCollaborator(documentId, shareEmail);
      setShareMessage(response.message||"Collaborator added");
      setShareEmail("");
      // Refresh the collaborators list so it updates in the modal dynamically
      const data = await getCollaborators(documentId);
      setCollabInfo(data);
    }catch(error){
      setShareMessage(error.response?.data?.message || "Error sharing document");
    }finally{
      setShareLoading(false);
    }
  };
  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* HEADER */}
      <div className="bg-white shadow p-4 flex justify-between items-center z-10">
        {/* LEFT */}
        <div className="flex items-center gap-4">
          <button onClick={() => navigate("/dashboard")} className="text-gray-600 hover:text-black font-medium">
            ← Back
          </button>
          {isEditingTitle ? (
            <input
              type="text"
              className="text-xl font-bold border-b border-gray-300 focus:outline-none focus:border-blue-500"
              value={titleInput}
              onChange={e => setTitleInput(e.target.value)}
              onBlur={async () => {
                if (titleInput.trim() && titleInput !== documentTitle) {
                  try {
                    await renameDocument(documentId, titleInput.trim());
                    setDocumentTitle(titleInput.trim());
                  } catch (err) {
                    console.error('Rename failed', err);
                  }
                }
                setIsEditingTitle(false);
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  e.currentTarget.blur();
                }
              }}
            />
          ) : (
            <h1 onClick={() => { setIsEditingTitle(true); setTitleInput(documentTitle); }} className="text-xl font-bold text-gray-800 border-l pl-4 cursor-pointer">
              {documentTitle}
            </h1>
          )}
        </div>
        {/* RIGHT */}
        <div className="flex items-center gap-3">
          {/* TYPING */}
          {typingUser && (
            <div className="flex items-center gap-1.5 text-xs text-indigo-500 font-medium bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100/50 animate-pulse">
              <span className="flex gap-0.5">
                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" />
              </span>
              <span className="hidden sm:inline">{typingUser} typing</span>
            </div>
          )}
          {/* ACTIVE USERS AVATAR STACK */}
          {activeUsers.length > 0 && (
            <div className="flex items-center -space-x-2 overflow-hidden mr-1">
              {activeUsers.map((u) => {
                const name = u.username || "Guest";
                const initials = name.slice(0, 1).toUpperCase();
                // Color palette for avatars based on user name hash
                const colors = [
                  "bg-pink-500", "bg-purple-500", "bg-indigo-500", 
                  "bg-sky-500", "bg-emerald-500", "bg-amber-500"
                ];
                const charSum = name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
                const colorClass = colors[charSum % colors.length];
                return (
                  <div
                    key={u.socketId}
                    title={`${name} is active`}
                    className={`inline-flex items-center justify-center h-8 w-8 rounded-full text-white text-xs font-bold border-2 border-white shadow-sm hover:-translate-y-0.5 transition-transform duration-200 cursor-help ${colorClass}`}
                  >
                    {initials}
                  </div>
                );
              })}
            </div>
          )}
          {/* UNIFIED SHARE BUTTON */}
          <button
            onClick={async () => {
              try {
                setShareMessage("");
                setShareEmail("");
                const data = await getCollaborators(documentId);
                setCollabInfo(data);
                setShowCollabModal(true);
              } catch (err) {
                console.error('Failed to fetch collaborators', err);
              }
            }}
            className="flex items-center gap-1.5 bg-blue-600 text-white px-3.5 py-1.5 rounded-lg text-sm font-semibold hover:bg-blue-700 shadow-sm transition hover:shadow-md cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
            <span className="hidden sm:inline">Share</span>
          </button>
          {/* AUTO-SAVE STATUS */}
          <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1.5 rounded-full border border-emerald-100 transition-colors duration-300" title="Changes are automatically saved and synced" id="save-status-container">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span id="save-status-indicator" className="hidden md:inline">Saved</span>
          </div>
        </div>
      </div>
      {/* EDITOR */}
      <div className="flex-1 flex flex-col items-center relative w-full editor-wrapper">
        <CustomToolbar 
          onUndo={() => {
            const quill = quillRef.current?.getEditor();
            if (quill) quill.history.undo();
          }}
          onRedo={() => {
            const quill = quillRef.current?.getEditor();
            if (quill) quill.history.redo();
          }}
          onSave={() => {
            const quill = quillRef.current?.getEditor();
            if (quill && socket) {
              const currentContent = quill.getContents();
              socket.emit("save-document", { documentId, content: currentContent });
              // Quick visual feedback
              const saveStatus = document.getElementById("save-status-indicator");
              const saveContainer = document.getElementById("save-status-container");
              if (saveStatus && saveContainer) {
                const originalText = saveStatus.innerText;
                saveStatus.innerText = "Force Saved!";
                saveContainer.classList.replace("bg-emerald-50", "bg-indigo-100");
                saveContainer.classList.replace("text-emerald-600", "text-indigo-700");
                setTimeout(() => {
                  saveStatus.innerText = originalText;
                  saveContainer.classList.replace("bg-indigo-100", "bg-emerald-50");
                  saveContainer.classList.replace("text-indigo-700", "text-emerald-600");
                }, 2000);
              }
            }
          }}
        />
        <ReactQuill ref={quillRef} theme="snow" className="w-full h-full" modules={modules} formats={formats} />
        {selectedImg && (
          <div 
            style={{
              position: 'absolute',
              border: '2px dashed #4f46e5',
              pointerEvents: 'none',
              zIndex: 50,
              boxSizing: 'border-box',
              ...overlayStyle
            }}
          >
            {/* Corner Handles */}
            {['tl', 'tr', 'bl', 'br'].map((dir) => {
              const cursor = dir === 'tl' || dir === 'br' ? 'nwse-resize' : 'nesw-resize';
              const style = {
                position: 'absolute',
                width: '10px',
                height: '10px',
                backgroundColor: '#ffffff',
                border: '2px solid #4f46e5',
                borderRadius: '50%',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                cursor: cursor,
                pointerEvents: 'auto',
                zIndex: 51,
              };  
              if (dir.includes('t')) style.top = '-6px';
              if (dir.includes('b')) style.bottom = '-6px';
              if (dir.includes('l')) style.left = '-6px';
              if (dir.includes('r')) style.right = '-6px';
              return (
                <div
                  key={dir}
                  style={style}
                  onMouseDown={(e) => handleMouseDown(e, dir)}
                />
              );
            })}
          </div>
        )}
      </div>
      {/* Collaborators Modal */}
      {showCollabModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-100">
          <div className="bg-white rounded-xl shadow-2xl w-100 max-h-[85vh] overflow-y-auto p-6 text-slate-800 border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            <h2 className="text-lg font-bold mb-4 border-b pb-3 text-slate-900 flex items-center justify-between">
              <span>Document Access & Sharing</span>
              <button 
                onClick={() => setShowCollabModal(false)}
                className="text-slate-400 hover:text-slate-600 transition text-sm cursor-pointer p-1"
              >
                ✕
              </button>
            </h2>
            {/* 1. Share / Invite Section */}
            <div className="mb-5 pb-5 border-b border-slate-100">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Invite Collaborators</label>
              <div className="flex gap-2">
                <input 
                  type="email" 
                  placeholder="Collaborator email address" 
                  value={shareEmail} 
                  onChange={(e) => setShareEmail(e.target.value)} 
                  className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100/50 transition bg-slate-50/50 text-slate-800"
                />
                <button 
                  onClick={handleShareDocument}
                  disabled={shareLoading}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50 min-w-17.5 cursor-pointer shadow-sm hover:shadow"
                >
                  {shareLoading ? "Adding..." : "Invite"}
                </button>
              </div>
              {shareMessage && (
                <p className="mt-2.5 text-xs text-blue-600 bg-blue-50 px-2.5 py-1.5 rounded border border-blue-100/50 animate-pulse">
                  {shareMessage}
                </p>
              )}
            </div>
            {/* 2. Copy Link Section */}
            <div className="mb-5 pb-5 border-b flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-100">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                <span className="text-xs text-slate-500 font-medium">Anyone with this link can collaborate</span>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href);
                  alert("Link copied to clipboard!");
                }}
                className="flex items-center gap-1 text-blue-600 hover:text-blue-700 text-xs font-semibold px-2 py-1.5 hover:bg-blue-50 rounded-md transition cursor-pointer"
              >
                Copy Link
              </button>
            </div>
            {/* 3. Who Has Access List */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">People with Access</h3>
              {/* Owner */}
              <div className="flex items-center justify-between bg-slate-50/50 p-2.5 rounded-lg border border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold">
                    O
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-slate-800">
                      {collabInfo.owner?.username || "Owner"}
                    </span>
                    <span className="text-[10px] text-slate-400 mt-0.5">
                      {collabInfo.owner?.email || "owner@domain.com"}
                    </span>
                  </div>
                </div>
                <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                  Owner
                </span>
              </div>
              {/* Collaborators List */}
              {collabInfo.collaborators && collabInfo.collaborators.length > 0 && (
                <div className="space-y-2">
                  {collabInfo.collaborators.map((c) => {
                    const initials = c.username ? c.username.slice(0, 1).toUpperCase() : "?";
                    return (
                      <div key={c._id} className="flex items-center justify-between p-2.5 bg-slate-50/20 rounded-lg border border-slate-100 hover:bg-slate-50/50 transition">
                        <div className="flex items-center gap-2.5">
                          <div className="h-7 w-7 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-bold">
                            {initials}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold text-slate-800">{c.username}</span>
                            <span className="text-[10px] text-slate-400 mt-0.5">{c.email}</span>
                          </div>
                        </div>
                        <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                          Editor
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
              {/* Pending Invites List */}
              {collabInfo.pendingCollaborators && collabInfo.pendingCollaborators.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-2">Invited</h4>
                  {collabInfo.pendingCollaborators.map((email, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2.5 bg-amber-50/30 rounded-lg border border-amber-100/50 animate-pulse">
                      <div className="flex items-center gap-2.5">
                        <div className="h-7 w-7 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-bold">
                          P
                        </div>
                        <span className="text-sm font-medium text-slate-700">{email}</span>
                      </div>
                      <span className="text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                        Pending
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* Footer action */}
            <div className="flex justify-end mt-6 border-t pt-4">
              <button
                onClick={() => setShowCollabModal(false)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-800 px-4 py-2 rounded-lg text-sm font-medium transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}<br />
    </div>
  );
}

export default EditorPage;