import React, { useEffect, useRef, useState, useCallback } from "react";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import { useNavigate, useParams } from "react-router-dom";
import { io } from "socket.io-client";
import { useAuth } from "../context/AuthContext";
import { addCollaborator, renameDocument, getCollaborators, generateShareLink, removeCollaborator } from "../api/documentService.js";
import axiosInstance from "../api/axios.js";

// Quill Font Registration (style attributor)
const Font = ReactQuill.Quill.import("attributors/style/font");
Font.whitelist = [
  "sans-serif", "serif", "monospace",
  "inter", "roboto", "arial", "georgia",
  "times-new-roman", "courier-new", "comic-sans",
  "trebuchet-ms", "verdana"
];
ReactQuill.Quill.register(Font, true);

// Quill Size Registration
const Size = ReactQuill.Quill.import("attributors/style/size");
Size.whitelist = ["10px", "12px", "14px", "16px", "18px", "20px", "24px", "28px", "36px", "48px", "72px"];
ReactQuill.Quill.register(Size, true);

// --- Custom Shape and Image Blots ---
const BlockEmbed = ReactQuill.Quill.import('blots/block/embed');

class ShapeBlot extends BlockEmbed {
  static blotName = 'shape';
  static tagName = 'div';
  static className = 'ql-shape-embed';

  static create(value) {
    const node = super.create();
    node.setAttribute('contenteditable', 'false');
    node.style.display = 'inline-block';
    node.style.verticalAlign = 'middle';
    node.style.userSelect = 'none';
    node.dataset.shape = value.type || 'rectangle';
    node.dataset.width = value.width || 120;
    node.dataset.height = value.height || 80;
    // create svg
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', node.dataset.width);
    svg.setAttribute('height', node.dataset.height);
    svg.setAttribute('viewBox', `0 0 ${node.dataset.width} ${node.dataset.height}`);
    svg.style.display = 'block';
    svg.style.pointerEvents = 'none';
    svg.classList.add('ql-shape-svg');
    // draw shape
    const type = node.dataset.shape;
    let el;
    if (type === 'circle') {
      el = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
      el.setAttribute('cx', node.dataset.width/2);
      el.setAttribute('cy', node.dataset.height/2);
      el.setAttribute('rx', node.dataset.width/2 - 2);
      el.setAttribute('ry', node.dataset.height/2 - 2);
    } else if (type === 'triangle') {
      el = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      const w = node.dataset.width, h = node.dataset.height;
      el.setAttribute('points', `${w/2},2 ${w-2},${h-2} 2,${h-2}`);
    } else { // rectangle default
      el = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      el.setAttribute('x', 2);
      el.setAttribute('y', 2);
      el.setAttribute('width', node.dataset.width - 4);
      el.setAttribute('height', node.dataset.height - 4);
      el.setAttribute('rx', 4);
    }
    el.setAttribute('fill', value.fill || '#60a5fa');
    svg.appendChild(el);
    node.appendChild(svg);

    // attach simple drag to float left/right (move) but do not change shape on drag
    let startX = 0;
    node.addEventListener('pointerdown', (ev) => {
      if (ev.button !== 0) return;
      startX = ev.clientX;
      node.setPointerCapture(ev.pointerId);
      const up = (e) => {
        const dx = e.clientX - startX;
        if (dx < -30) node.style.cssFloat = 'left';
        else if (dx > 30) node.style.cssFloat = 'right';
        else node.style.cssFloat = 'none';
        try { node.releasePointerCapture(e.pointerId); } catch {};
        window.removeEventListener('pointerup', up);
      };
      window.addEventListener('pointerup', up);
    });

    return node;
  }

  static value(domNode) {
    return {
      type: domNode.dataset.shape,
      width: parseInt(domNode.dataset.width, 10),
      height: parseInt(domNode.dataset.height, 10)
    };
  }
}

// Custom image blot overriding default image behavior to allow inline flow and resizing handles
class CustomImageBlot extends BlockEmbed {
  static blotName = 'image';
  static tagName = 'div';
  static className = 'ql-custom-image-wrapper';

  static create(value) {
    const node = super.create();
    node.setAttribute('contenteditable', 'false');
    node.style.display = 'inline-block';
    node.style.verticalAlign = 'middle';
    node.style.userSelect = 'none';
    node.style.position = 'relative';
    node.style.margin = '0 8px 8px 0';

    const img = document.createElement('img');
    img.className = 'ql-custom-image';
    img.src = typeof value === 'string' ? value : (value.src || '');
    img.style.display = 'block';
    img.style.maxWidth = '100%';
    img.style.height = 'auto';
    img.setAttribute('draggable', 'false');
    node.appendChild(img);

    // Create 8 resize handles (no visible border box). Handles are tiny dots around image.
    const handles = ['nw','n','ne','e','se','s','sw','w'].map((pos) => {
      const h = document.createElement('div');
      h.className = `ql-resize-handle ql-handle-${pos}`;
      h.style.position = 'absolute';
      h.style.width = '10px'; h.style.height = '10px';
      h.style.background = 'white'; h.style.border = '1px solid rgba(0,0,0,0.15)';
      h.style.borderRadius = '50%'; h.style.boxSizing = 'border-box';
      h.style.transform = 'translate(-50%, -50%)';
      h.style.cursor = 'nwse-resize';
      h.style.zIndex = '10';
      h.style.display = 'none';
      node.appendChild(h);
      return { pos, el: h };
    });

    const positionHandles = () => {
      const rect = img.getBoundingClientRect();
      // calculate relative positions
      const w = img.offsetWidth; const hgt = img.offsetHeight;
      const coords = {
        nw: [0,0], n: [w/2,0], ne: [w,0], e: [w,hgt/2], se: [w,hgt], s: [w/2,hgt], sw: [0,hgt], w: [0,hgt/2]
      };
      handles.forEach(h => {
        const [x,y] = coords[h.pos];
        h.el.style.left = `${x}px`;
        h.el.style.top = `${y}px`;
      });
    };

    // show handles on click/focus, hide on blur
    node.addEventListener('click', (e) => {
      handles.forEach(h => h.el.style.display = 'block');
      positionHandles();
      e.stopPropagation();
    });
    document.addEventListener('click', () => { handles.forEach(h => h.el.style.display = 'none'); });

    // Resize logic
    handles.forEach(h => {
      let startX, startY, startW, startH, startAspect;
      const onPointerDown = (ev) => {
        ev.preventDefault(); ev.stopPropagation();
        startX = ev.clientX; startY = ev.clientY;
        startW = img.offsetWidth; startH = img.offsetHeight; startAspect = startW / startH;
        h.el.setPointerCapture(ev.pointerId);
        const move = (e) => {
          let dx = e.clientX - startX, dy = e.clientY - startY;
          let newW = startW, newH = startH;
          if (['nw','ne','se','sw'].includes(h.pos)) {
            // preserve aspect ratio for corner handles
            if (Math.abs(dx) > Math.abs(dy)) newW = startW + (h.pos.includes('w') ? -dx : dx);
            else newH = startH + (h.pos.includes('n') ? -dy : dy);
            // sync to aspect
            newW = Math.max(10, newW);
            newH = Math.max(10, Math.round(newW / startAspect));
          } else if (h.pos === 'n' || h.pos === 's') {
            newH = Math.max(10, startH + (h.pos === 'n' ? -dy : dy));
          } else { // e or w
            newW = Math.max(10, startW + (h.pos === 'w' ? -dx : dx));
          }
          img.style.width = `${newW}px`;
          img.style.height = 'auto';
          positionHandles();
        };
        const up = (e) => { try { h.el.releasePointerCapture(e.pointerId); } catch {} ; window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
      };
      h.el.addEventListener('pointerdown', onPointerDown);
    });

    // Simple horizontal drag to float left/right (move within flow) when user drags the image wrapper
    let dragStartX = 0;
    node.addEventListener('pointerdown', (ev) => {
      if (ev.target.classList.contains('ql-resize-handle')) return; // resize handles manage their own
      dragStartX = ev.clientX;
      node.setPointerCapture(ev.pointerId);
      const up = (e) => {
        const dx = e.clientX - dragStartX;
        if (dx < -30) node.style.cssFloat = 'left';
        else if (dx > 30) node.style.cssFloat = 'right';
        else node.style.cssFloat = 'none';
        try { node.releasePointerCapture(e.pointerId); } catch {};
        window.removeEventListener('pointerup', up);
      };
      window.addEventListener('pointerup', up);
    });

    return node;
  }

  static value(domNode) {
    const img = domNode.querySelector('img');
    return img ? img.src : '';
  }
}

ReactQuill.Quill.register(ShapeBlot);
ReactQuill.Quill.register(CustomImageBlot);

// safe helper to get the Quill editor instance without throwing if not yet instantiated
const safeGetEditor = (ref) => {
  try {
    return ref?.current?.getEditor ? ref.current.getEditor() : null;
  } catch (err) {
    return null;
  }
};

const colors = ["", "#000000", "#e60000", "#ff9900", "#ffff00", "#008a00", "#0066cc", "#9933ff", "#4f46e5"];

// Small CustomToolbar component used by the editor
const CustomToolbar = ({ onUndo, onRedo, onSave, onOpenFormatDialog }) => {
  return (
    <div id="custom-toolbar" className="custom-ribbon bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-10 w-full flex justify-center shadow-sm">
      <div className="flex items-center justify-between w-full max-w-[850px] mx-auto py-1.5 px-4">
        <div className="flex items-center gap-2">
          <span className="ql-formats !mr-1">
            <button onClick={onUndo} className="toolbar-action-btn flex items-center justify-center text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors h-8 w-8" title="Undo">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>
            </button>
            <button onClick={onRedo} className="toolbar-action-btn flex items-center justify-center text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors h-8 w-8" title="Redo">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"/></svg>
            </button>
            <button onClick={onSave} className="toolbar-save-btn flex items-center justify-center text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors h-8 w-8 ml-1" title="Save">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
            </button>
          </span>
          <div className="w-px h-5 bg-slate-200 mx-1"></div>
          <span className="ql-formats">
            <select className="ql-font" defaultValue="inter" title="Font Family">
              {Font.whitelist.map(f => <option value={f} key={f}>{f}</option>)}
            </select>
            <select className="ql-size" defaultValue="16px" title="Font Size">
              {Size.whitelist.map(s => <option value={s} key={s}>{s}</option>)}
            </select>
            <select className="ql-shape" defaultValue="" title="Insert Shape">
              <option value="">Shape</option>
              <option value="rectangle">Rectangle</option>
              <option value="circle">Circle</option>
              <option value="triangle">Triangle</option>
              <option value="diamond">Diamond</option>
              <option value="hexagon">Hexagon</option>
              <option value="star">Star</option>
              <option value="arrowRight">Arrow</option>
              <option value="heart">Heart</option>
            </select>
          </span>
          <div className="w-px h-5 bg-slate-200 mx-1"></div>
          <span className="ql-formats !mr-1">
            <button className="ql-bold hover:bg-indigo-50 rounded" title="Bold" />
            <button className="ql-italic hover:bg-indigo-50 rounded" title="Italic" />
            <button className="ql-underline hover:bg-indigo-50 rounded" title="Underline" />
          </span>
        </div>
        <div className="flex items-center">
          <span className="ql-formats !mr-0">
            <button onClick={onOpenFormatDialog} className="toolbar-action-btn flex items-center justify-center text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-md px-3 py-1.5 w-auto gap-1.5 text-xs font-semibold transition-all shadow-sm" title="Advanced Format">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>
              Format Text
            </button>
          </span>
        </div>
      </div>
    </div>
  );
};

const modulesFactory = (quillRef, setPendingShape) => ({
  toolbar: {
    container: "#custom-toolbar",
    handlers: {
      font: function(value) {
        if (!value) return;
        const range = this.quill.getSelection();
        this.quill.focus();
        if (range && range.length > 0) this.quill.formatText(range.index, range.length, 'font', value, 'user');
        else this.quill.format('font', value, 'user');
      },
      size: function(value) {
        if (!value) return;
        const range = this.quill.getSelection();
        this.quill.focus();
        if (range && range.length > 0) this.quill.formatText(range.index, range.length, 'size', value, 'user');
        else this.quill.format('size', value, 'user');
      },
      shape: function(value) {
        if (!value) return;
        const range = this.quill.getSelection(true);
        const index = range ? range.index : this.quill.getLength();
        // default size
        const payload = { type: value, width: 120, height: 80, fill: '#60a5fa' };
        this.quill.insertEmbed(index, 'shape', payload, 'user');
        this.quill.setSelection(index + 1, 0);
        const shapeSelect = document.querySelector('.ql-shape'); if (shapeSelect) shapeSelect.value = '';
      },
      image: function() {
        const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*';
        input.onchange = () => {
          const file = input.files[0]; if (!file) return; const reader = new FileReader();
          reader.onload = (e) => {
            const quill = safeGetEditor(quillRef); if (!quill) return;
            const range = quill.getSelection(true); const index = range ? range.index : quill.getLength() - 1;
            quill.insertEmbed(index, 'image', e.target.result, 'user'); quill.setSelection(index + 1);
          };
          reader.readAsDataURL(file);
        };
        input.click();
      }
    }
  },
  history: { delay: 1000, maxStack: 100, userOnly: true },
  clipboard: { matchVisual: false }
});

const formats = [
  "font", "size", "header",
  "bold", "italic", "underline", "strike",
  "script",
  "color", "background",
  "align", "indent", "direction",
  "list",
  "blockquote", "code-block",
  "link", "image", "video", "formula",
  "shape",
];

// Inject minimal CSS for image handles and shape SVG styling once
if (typeof document !== 'undefined' && !document.getElementById('quill-custom-styles')) {
  const style = document.createElement('style');
  style.id = 'quill-custom-styles';
  style.innerHTML = `
    .ql-custom-image-wrapper { display:inline-block; vertical-align:middle; margin:0 8px 8px 0; }
    .ql-custom-image-wrapper img { display:block; max-width:600px; height:auto; }
    .ql-custom-image-wrapper .ql-resize-handle { display:none; }
    /* shown only when wrapper is selected; handled via JS click events */
    .ql-shape-embed { display:inline-block; vertical-align:middle; margin:0 8px 8px 0; }
    .ql-shape-embed .ql-shape-svg { display:block; }
  `;
  document.head.appendChild(style);
}

const EditorPage = () => {
  const { id: documentId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const quillRef = useRef(null);

  // Basic states
  const [socket, setSocket] = useState(null);
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [documentTitle, setDocumentTitle] = useState('Untitled Document');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const [activeUsers, setActiveUsers] = useState([]);
  const [typingUser, setTypingUser] = useState('');
  const [shareEmail, setShareEmail] = useState('');
  const [shareLoading, setShareLoading] = useState(false);
  const [shareMessage, setShareMessage] = useState('');
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [collaboratorsList, setCollaboratorsList] = useState([]);
  const [shareLink, setShareLink] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);
  const [pendingShape, setPendingShape] = useState(null);
  useEffect(() => { window.__REACT_SHAPE_SETTER__ = setPendingShape; return () => { if (window.__REACT_SHAPE_SETTER__ === setPendingShape) delete window.__REACT_SHAPE_SETTER__; }; }, [setPendingShape]);

  // Format dialog hooks
  const [formatDialogOpen, setFormatDialogOpen] = useState(false);
  const [formatRange, setFormatRange] = useState(null);
  const [dialogFont, setDialogFont] = useState('');
  const [dialogSize, setDialogSize] = useState('');
  const [dialogColor, setDialogColor] = useState('');

  // modules use quillRef
  const modules = modulesFactory(quillRef, setPendingShape);

  // Basic socket connection (lightweight)
  useEffect(() => {
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
    const s = io(backendUrl, { withCredentials: true });
    setSocket(s);
    setIsSocketConnected(!!s.connected);
    const onConnect = () => setIsSocketConnected(true);
    const onDisconnect = () => setIsSocketConnected(false);
    s.on('connect', onConnect); s.on('disconnect', onDisconnect);
    return () => { s.off('connect', onConnect); s.off('disconnect', onDisconnect); s.disconnect(); };
  }, []);

  // Load document once socket + quill available
  useEffect(() => {
    const quill = safeGetEditor(quillRef);
    if (!socket || !quill) return;
    quill.enable(false);
    let didLoad = false;
    socket.emit('join-document', documentId);
    const onLoad = (doc) => {
      didLoad = true;
      setDocumentTitle(doc.title || 'Untitled Document');
      try { quill.setContents(doc.content || { ops: [] }); } catch { quill.setText(''); }
      quill.enable(true);
    };
    socket.once('load-document', onLoad);
    const fallback = setTimeout(() => { if (!didLoad) quill.enable(true); }, 2000);
    return () => { socket.off('load-document', onLoad); clearTimeout(fallback); };
  }, [socket, documentId]);

  // Send changes (simplified)
  useEffect(() => {
    if (!socket || !quillRef.current) return;
    const quill = safeGetEditor(quillRef);
    if (!quill) return;

    let typingTimeout;
    let saveTimeout;

    const doSave = async () => {
      try {
        setIsSaving(true);
        const content = quill.getContents();
        await axiosInstance.put(`/documents/${documentId}`, { content });
      } catch (err) {
        console.error('autosave failed', err);
      } finally {
        setIsSaving(false);
      }
    };

    const textChangeHandler = (delta, oldDelta, source) => {
      if (source !== 'user') return;
      // broadcast changes to other clients
      socket.emit('send-changes', delta, documentId);
      socket.emit('typing', { documentId, username: user?.username });

      // reset typing indicator timer
      clearTimeout(typingTimeout);
      typingTimeout = setTimeout(() => { socket.emit('stop-typing', { documentId, username: user?.username }); }, 800);

      // debounce autosave: save after 2s of inactivity
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => { doSave(); }, 2000);
    };

    quill.on('text-change', textChangeHandler);
    // also save when editor loses focus
    const blurHandler = () => { clearTimeout(saveTimeout); doSave(); };
    quill.root.addEventListener('blur', blurHandler);

    return () => {
      clearTimeout(typingTimeout); clearTimeout(saveTimeout);
      quill.off('text-change', textChangeHandler);
      try { quill.root.removeEventListener('blur', blurHandler); } catch {};
    };
  }, [socket, documentId, user]);

  // Format dialog helpers
  const openFormatDialog = () => {
    const editor = safeGetEditor(quillRef); if (!editor) return; const sel = editor.getSelection(); if (sel && sel.length > 0) { setFormatRange(sel); setDialogFont(''); setDialogSize(''); setDialogColor(''); setFormatDialogOpen(true); } else console.warn('Select text before opening format dialog');
  };
  const applyFormatting = () => {
    const editor = safeGetEditor(quillRef); if (!editor || !formatRange) return; const { index, length } = formatRange; if (dialogFont) editor.formatText(index, length, 'font', dialogFont, 'user'); if (dialogSize) editor.formatText(index, length, 'size', dialogSize, 'user'); if (dialogColor) editor.formatText(index, length, 'color', dialogColor, 'user'); setFormatDialogOpen(false);
  };

  // Title handler
  const handleTitleSubmit = async () => {
    if (!titleInput.trim() || titleInput === documentTitle) {
      setIsEditingTitle(false);
      return;
    }
    try {
      await renameDocument(documentId, titleInput);
      setDocumentTitle(titleInput);
      setIsEditingTitle(false);
    } catch (err) {
      console.error("Failed to rename document", err);
      setIsEditingTitle(false);
    }
  };

  // Share handler
  const handleShareDocument = async () => {
    if (!shareEmail.trim()) return; 
    try {
      setShareLoading(true);
      setShareMessage('');
      const response = await addCollaborator(documentId, shareEmail);
      setShareMessage(response.message || 'Collaborator added');
      setShareEmail('');
      // refresh collaborators list if modal open
      try { const data = await getCollaborators(documentId); setCollaboratorsList(data.collaborators || []); } catch {}
    } catch (err) {
      setShareMessage(err?.response?.data?.message || 'Error sharing document');
    } finally { setShareLoading(false); setTimeout(() => setShareMessage(''), 3000); }
  };

  const openShareModal = async () => {
    setShareModalOpen(true);
    try {
      const data = await getCollaborators(documentId);
      setCollaboratorsList(data.collaborators || []);
    } catch (err) {
      console.error('Failed to load collaborators', err);
    }
  };

  const closeShareModal = () => { setShareModalOpen(false); setShareLink(''); setLinkCopied(false); };

  const handleGenerateLink = async () => {
    try {
      const resp = await generateShareLink(documentId);
      const link = resp.link || resp?.data?.link || '';
      setShareLink(link);
      setLinkCopied(false);
    } catch (err) {
      console.error('Generate link failed', err);
    }
  };

  const handleCopyLink = async () => {
    if (!shareLink) return;
    try {
      await navigator.clipboard.writeText(shareLink);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2500);
    } catch (err) { console.error('copy failed', err); }
  };

  const handleRemoveCollaborator = async (email) => {
    try {
      await removeCollaborator(documentId, email);
      const data = await getCollaborators(documentId);
      setCollaboratorsList(data.collaborators || []);
    } catch (err) {
      console.error('Remove collaborator failed', err);
    }
  };

  // Small FormatDialog component inside EditorPage
  const FormatDialog = () => (
    formatDialogOpen ? (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm transition-opacity">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 transform transition-all scale-100">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-lg font-bold text-slate-800">Format Text</h3>
            <button onClick={() => setFormatDialogOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
          
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-slate-600 mb-1.5">Font Family</label>
              <select 
                className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-shadow text-sm"
                value={dialogFont} onChange={e => setDialogFont(e.target.value)}
              >
                <option value="">(default)</option>
                {Font.whitelist.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-slate-600 mb-1.5">Font Size</label>
              <select 
                className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-shadow text-sm"
                value={dialogSize} onChange={e => setDialogSize(e.target.value)}
              >
                <option value="">(default)</option>
                {Size.whitelist.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-slate-600 mb-2">Text Color</label>
              <div className="flex flex-wrap gap-2.5">
                {colors.map((c, i) => (
                  <button 
                    key={i} 
                    onClick={() => setDialogColor(c)}
                    className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 focus:outline-none ${dialogColor === c ? 'border-indigo-500 scale-110 ring-2 ring-indigo-200' : 'border-transparent shadow-sm'}`}
                    style={{ backgroundColor: c || '#e2e8f0' }}
                    title={c || 'Default'}
                  />
                ))}
              </div>
            </div>
          </div>
          
          <div className="mt-8 pt-4 border-t border-slate-100 flex justify-end gap-3">
            <button 
              onClick={() => setFormatDialogOpen(false)} 
              className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={applyFormatting}
              className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-md shadow-indigo-200 transition-all active:scale-95 flex items-center gap-2"
            >
              Apply Changes
            </button>
          </div>
        </div>
      </div>
    ) : null
  );

  // Editor action helpers (simple)
  const onUndo = () => { const q = safeGetEditor(quillRef); if (q) q.history.undo(); };
  const onRedo = () => { const q = safeGetEditor(quillRef); if (q) q.history.redo(); };
  const onSave = async () => { const q = safeGetEditor(quillRef); if (!q) return; const content = q.getContents(); try { await axiosInstance.put(`/documents/${documentId}`, { content }); } catch (err) { console.error('save failed', err); } };

  return (
    <div className="h-screen flex flex-col bg-[#f8fafc] font-sans selection:bg-indigo-100 selection:text-indigo-900 overflow-hidden">
      {/* Top Navigation Bar */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shrink-0 shadow-sm z-20">
        <div className="flex items-center gap-5">
          <button 
            onClick={() => navigate('/dashboard')}
            className="p-2.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all border border-transparent hover:border-indigo-100"
            title="Back to Dashboard"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          
          <div className="flex flex-col">
            {isEditingTitle ? (
              <input
                autoFocus
                className="text-xl font-bold text-slate-800 bg-slate-50 border-b-2 border-indigo-500 focus:outline-none px-1 py-0.5 min-w-[200px] transition-colors"
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                onBlur={handleTitleSubmit}
                onKeyDown={(e) => e.key === 'Enter' && handleTitleSubmit()}
              />
            ) : (
              <h1 
                onClick={() => { setIsEditingTitle(true); setTitleInput(documentTitle); }}
                className="text-xl font-bold text-slate-800 cursor-pointer hover:bg-slate-100 px-2 py-0.5 rounded transition-colors border-b-2 border-transparent whitespace-nowrap overflow-hidden text-ellipsis max-w-[420px]"
                title={documentTitle || 'Untitled Document'}
              >
                {documentTitle || 'Untitled Document'}
              </h1>
            )}
            
            {/* Connection Status */}
            <div className="flex items-center gap-2 text-xs text-slate-500 mt-1 px-2 -ml-2 font-medium">
              <span className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  {isSocketConnected && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${isSocketConnected ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                </span>
                {isSaving ? 'Saving...' : (isSocketConnected ? 'Saved' : 'Working Offline')}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Share Input Group */}
          <div className="flex items-center gap-2">
            <button onClick={openShareModal} className="bg-white border border-slate-200 px-3 py-2 rounded-lg text-sm hover:bg-slate-50">Share</button>
          </div>
          
          <div className="h-8 w-px bg-slate-200 mx-1"></div>
          
          {/* Avatar Profile */}
          <div className="flex items-center gap-2 cursor-pointer hover:bg-slate-100 p-1.5 rounded-lg transition-colors">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center text-sm font-bold shadow-md ring-2 ring-white" title={user?.username || 'You'}>
              {(user?.username || 'U').charAt(0).toUpperCase()}
            </div>
          </div>
        </div>
      </header>
      
      {/* Messages Toast */}
      <div className={`absolute top-20 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 transform ${shareMessage ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'}`}>
        <div className="bg-slate-800 text-white px-5 py-2.5 rounded-full shadow-lg text-sm font-medium flex items-center gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
          <span>{shareMessage}</span>
          <button onClick={() => setShareMessage('')} className="text-slate-400 hover:text-white ml-1 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
      </div>

      {/* Editor Main Area */}
      <main className="flex-1 flex flex-col relative bg-slate-50/30">
        <CustomToolbar onUndo={onUndo} onRedo={onRedo} onSave={onSave} onOpenFormatDialog={openFormatDialog} />
        
        <div className="flex-1 overflow-y-auto w-full flex justify-center pb-24 pt-8 custom-scrollbar">
          <ReactQuill ref={quillRef} theme="snow" className="w-full max-w-[850px] shadow-sm rounded-xl overflow-hidden bg-white min-h-[800px]" modules={modules} formats={formats} placeholder="Start typing your document..." />
        </div>
      </main>

      {/* Share Modal */}
      {shareModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Share Document</h3>
              <button onClick={closeShareModal} className="text-slate-500 hover:text-slate-800">Close</button>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">Invite via email</label>
              <div className="flex gap-2">
                <input type="email" value={shareEmail} onChange={e => setShareEmail(e.target.value)} placeholder="email@example.com" className="flex-1 border rounded px-3 py-2" />
                <button onClick={handleShareDocument} className="bg-indigo-600 text-white px-4 py-2 rounded">Invite</button>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">Or generate a shareable link</label>
              <div className="flex gap-2 items-center">
                <button onClick={handleGenerateLink} className="bg-white border px-3 py-2 rounded">Generate Link</button>
                {shareLink && (
                  <div className="flex gap-2 items-center">
                    <input readOnly value={shareLink} className="border rounded px-2 py-2 w-80" />
                    <button onClick={handleCopyLink} className={`px-3 py-2 rounded ${linkCopied ? 'bg-emerald-600 text-white' : 'bg-indigo-600 text-white'}`}>{linkCopied ? 'Copied' : 'Copy'}</button>
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Collaborators</label>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {collaboratorsList.length === 0 ? <div className="text-sm text-slate-500">No collaborators</div> : collaboratorsList.map((c) => (
                  <div key={c._id || c.email} className="flex items-center justify-between border rounded px-3 py-2">
                    <div>
                      <div className="text-sm font-medium">{c.username || c.email}</div>
                      <div className="text-xs text-slate-500">{c.email}</div>
                    </div>
                    <div>
                      <button onClick={() => handleRemoveCollaborator(c.email)} className="text-red-600 text-sm">Remove</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <FormatDialog />
    </div>
  );
};

export default EditorPage;