/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import { useNavigate, useParams } from "react-router-dom";
import { io } from "socket.io-client";
import { useAuth } from "../context/AuthContext";
import { addCollaborator, renameDocument } from "../api/documentService.js";
import axiosInstance from "../api/axios.js";

const FONT_OPTIONS = [
  { label: "Default Font", value: "" },
  { label: "Sans Serif", value: "sans-serif" },
  { label: "Serif", value: "serif" },
  { label: "Monospace", value: "monospace" },
  { label: "Inter", value: "Inter, sans-serif" },
  { label: "Roboto", value: "Roboto, Arial, sans-serif" },
  { label: "Arial", value: "Arial, Helvetica, sans-serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Times New Roman", value: "Times New Roman, Times, serif" },
  { label: "Courier New", value: "Courier New, Courier, monospace" },
  { label: "Comic Sans", value: "Comic Sans MS, Comic Sans, cursive" },
  { label: "Trebuchet MS", value: "Trebuchet MS, sans-serif" },
  { label: "Verdana", value: "Verdana, Geneva, sans-serif" },
];

const LEGACY_FONT_VALUE_ALIASES = {
  inter: "Inter, sans-serif",
  roboto: "Roboto, Arial, sans-serif",
  arial: "Arial, Helvetica, sans-serif",
  georgia: "Georgia, serif",
  "times-new-roman": "Times New Roman, Times, serif",
  "courier-new": "Courier New, Courier, monospace",
  "comic-sans": "Comic Sans MS, Comic Sans, cursive",
  "trebuchet-ms": "Trebuchet MS, sans-serif",
  verdana: "Verdana, Geneva, sans-serif",
};

const normalizeFontValue = (value) => (
  typeof value === "string" ? LEGACY_FONT_VALUE_ALIASES[value] || value : value
);

const SIZE_OPTIONS = [
  { label: "Default Size", value: "" },
  ...["10px", "12px", "14px", "16px", "18px", "20px", "24px", "28px", "36px", "48px", "72px"].map((size) => ({
    label: size,
    value: size,
  })),
];

// Quill Font Registration (style attributor)
const Font = ReactQuill.Quill.import("attributors/style/font");
const baseFontAdd = Font.add.bind(Font);
Font.add = (node, value) => baseFontAdd(node, normalizeFontValue(value));
Font.whitelist = [
  ...new Set([
    ...FONT_OPTIONS.map(({ value }) => value).filter(Boolean),
    ...Object.keys(LEGACY_FONT_VALUE_ALIASES),
  ]),
];
ReactQuill.Quill.register(Font, true);

// Quill Size Registration
const Size = ReactQuill.Quill.import("attributors/style/size");
Size.whitelist = SIZE_OPTIONS.map(({ value }) => value).filter(Boolean);
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
        try { node.releasePointerCapture(e.pointerId); } catch { /* pointer capture may already be released */ }
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
  static blotName = 'custom-image';
  static tagName = 'div';
  static className = 'ql-custom-image-wrapper';

  static create(value) {
    const payload = typeof value === 'string' ? { src: value } : (value || {});
    const initialWidth = Number(payload.width) || 360;
    const initialHeight = Number(payload.height) || null;
    const initialFloat = payload.float || 'none';
    const node = super.create();
    node.setAttribute('contenteditable', 'false');
    node.style.display = 'inline-block';
    node.style.verticalAlign = 'middle';
    node.style.userSelect = 'none';
    node.style.position = 'relative';
    node.style.margin = '0 8px 8px 0';
    node.dataset.src = payload.src || '';
    node.dataset.width = initialWidth;
    node.dataset.float = initialFloat;
    if (initialHeight) node.dataset.height = initialHeight;
    node.style.cssFloat = initialFloat === 'none' ? '' : initialFloat;

    const img = document.createElement('img');
    img.className = 'ql-custom-image';
    img.style.display = 'block';
    img.style.maxWidth = '100%';
    img.style.width = `${initialWidth}px`;
    img.style.height = initialHeight ? `${initialHeight}px` : 'auto';
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

    const syncNaturalImageSize = () => {
      if (payload.width || !img.naturalWidth) return;

      const width = Math.min(img.naturalWidth, 520);
      const height = Math.round(width * (img.naturalHeight / img.naturalWidth));
      node.dataset.width = width;
      node.dataset.height = height;
      img.style.width = `${width}px`;
      img.style.height = `${height}px`;
      positionHandles();
    };

    img.addEventListener('load', syncNaturalImageSize);
    img.src = payload.src || '';
    if (img.complete) syncNaturalImageSize();

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
        startW = img.offsetWidth; startH = img.offsetHeight; startAspect = startH ? startW / startH : 1;
        h.el.setPointerCapture(ev.pointerId);
        const move = (e) => {
          let dx = e.clientX - startX, dy = e.clientY - startY;
          let newW = startW, newH = startH;
          if (['nw','ne','se','sw'].includes(h.pos)) {
            // preserve aspect ratio for corner handles
            if (Math.abs(dx) > Math.abs(dy)) {
              newW = Math.max(10, startW + (h.pos.includes('w') ? -dx : dx));
              newH = Math.max(10, Math.round(newW / startAspect));
            } else {
              newH = Math.max(10, startH + (h.pos.includes('n') ? -dy : dy));
              newW = Math.max(10, Math.round(newH * startAspect));
            }
          } else if (h.pos === 'n' || h.pos === 's') {
            newH = Math.max(10, startH + (h.pos === 'n' ? -dy : dy));
          } else { // e or w
            newW = Math.max(10, startW + (h.pos === 'w' ? -dx : dx));
          }
          node.dataset.width = newW;
          node.dataset.height = newH;
          img.style.width = `${newW}px`;
          img.style.height = `${newH}px`;
          positionHandles();
        };
        const up = (e) => { try { h.el.releasePointerCapture(e.pointerId); } catch { /* pointer capture may already be released */ } window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
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
        node.dataset.float = node.style.cssFloat || 'none';
        try { node.releasePointerCapture(e.pointerId); } catch { /* pointer capture may already be released */ }
        window.removeEventListener('pointerup', up);
      };
      window.addEventListener('pointerup', up);
    });

    return node;
  }

  static value(domNode) {
    const img = domNode.querySelector('img');
    return {
      src: img ? img.src : domNode.dataset.src,
      width: parseInt(domNode.dataset.width, 10) || img?.offsetWidth || 360,
      height: parseInt(domNode.dataset.height, 10) || img?.offsetHeight || null,
      float: domNode.dataset.float || 'none',
    };
  }
}

ReactQuill.Quill.register(ShapeBlot);
ReactQuill.Quill.register(CustomImageBlot);

// safe helper to get the Quill editor instance without throwing if not yet instantiated
const safeGetEditor = (ref) => {
  try {
    return ref?.current?.getEditor ? ref.current.getEditor() : null;
  } catch {
    return null;
  }
};

const colors = ["", "#000000", "#e60000", "#ff9900", "#ffff00", "#008a00", "#0066cc", "#9933ff", "#4f46e5"];

const getActiveUserName = (activeUser) => {
  if (typeof activeUser === 'string') return activeUser;
  return activeUser?.username || activeUser?.name || activeUser?.email || 'Collaborator';
};

// Small CustomToolbar component used by the editor
const CustomToolbar = ({ onUndo, onRedo, onSave, formatOpen, setFormatOpen, onCaptureFormatRange, dialogFont, setDialogFont, dialogSize, setDialogSize, dialogColor, setDialogColor, onApplyFormat, onCancelFormat }) => {
  return (
    <div id="custom-toolbar" className="custom-ribbon bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-10 w-full flex justify-center shadow-sm">
      <div className="flex items-center justify-between w-full max-w-4xl mx-auto py-1.5 px-4">
        <div className="flex items-center gap-2">
          <span className="ql-formats mr-1">
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
            <select className="ql-font" defaultValue="" title="Font Family">
              {FONT_OPTIONS.map(({ label, value }) => <option value={value} key={`${label}-${value}`}>{label}</option>)}
            </select>
            <select className="ql-size" defaultValue="" title="Font Size">
              {SIZE_OPTIONS.map(({ label, value }) => <option value={value} key={`${label}-${value}`}>{label}</option>)}
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

          <span className="ql-formats mr-1">
            <button className="ql-bold hover:bg-indigo-50 rounded" title="Bold" />
            <button className="ql-italic hover:bg-indigo-50 rounded" title="Italic" />
            <button className="ql-underline hover:bg-indigo-50 rounded" title="Underline" />
            <button className="ql-image hover:bg-indigo-50 rounded" title="Insert Image" />
          </span>
        </div>

        <div className="flex items-center relative">
          {/* Inline format popover placed in toolbar */}
          <div className="relative">
            <button onClick={() => { if (!formatOpen) onCaptureFormatRange(); setFormatOpen(!formatOpen); }} className="toolbar-action-btn flex items-center justify-center text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-md px-3 py-1.5 w-auto gap-1.5 text-xs font-semibold transition-all shadow-sm" title="Advanced Format">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>
              <span className="ml-1">Format</span>
            </button>

            {formatOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-white border border-slate-200 rounded-lg p-3 shadow-lg z-50">
                <div className="mb-3">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Font Family</label>
                  <select className="w-full border rounded px-2 py-1 text-sm" value={dialogFont} onChange={(e) => setDialogFont(e.target.value)}>
                    <option value="">(default)</option>
                    {FONT_OPTIONS.filter(({ value }) => value).map(({ label, value }) => <option key={`${label}-${value}`} value={value}>{label}</option>)}
                  </select>
                </div>

                <div className="mb-3">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Font Size</label>
                  <select className="w-full border rounded px-2 py-1 text-sm" value={dialogSize} onChange={(e) => setDialogSize(e.target.value)}>
                    <option value="">(default)</option>
                    {SIZE_OPTIONS.filter(({ value }) => value).map(({ label, value }) => <option key={`${label}-${value}`} value={value}>{label}</option>)}
                  </select>
                </div>

                <div className="mb-3">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Text Color</label>
                  <div className="flex flex-wrap gap-2">
                    {colors.map((c, i) => (
                      <button key={i} onClick={() => setDialogColor(c)} className={`w-6 h-6 rounded-full border-2 transition-transform ${dialogColor === c ? 'border-indigo-500 ring-2 ring-indigo-200 scale-105' : 'border-transparent shadow-sm'}`} style={{ backgroundColor: c || '#e2e8f0' }} title={c || 'Default'} />
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-2 mt-2">
                  <button onClick={() => { onCancelFormat(); setFormatOpen(false); }} className="px-3 py-1.5 text-sm bg-slate-100 rounded">Cancel</button>
                  <button onClick={() => { onApplyFormat(); setFormatOpen(false); }} className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded">Apply</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const modulesFactory = () => ({
  toolbar: {
    container: "#custom-toolbar",
    handlers: {
      font: function(value) {
        const range = this.quill.getSelection();
        const formatValue = value || false;
        this.quill.focus();
        if (range && range.length > 0) this.quill.formatText(range.index, range.length, 'font', formatValue, 'user');
        else this.quill.format('font', formatValue, 'user');
      },
      size: function(value) {
        const range = this.quill.getSelection();
        const formatValue = value || false;
        this.quill.focus();
        if (range && range.length > 0) this.quill.formatText(range.index, range.length, 'size', formatValue, 'user');
        else this.quill.format('size', formatValue, 'user');
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
            const quill = this.quill; if (!quill) return;
            const range = quill.getSelection(true); const index = range ? range.index : quill.getLength() - 1;
            quill.insertEmbed(index, 'custom-image', { src: e.target.result }, 'user'); quill.setSelection(index + 1);
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
  "link", "custom-image", "video", "formula",
  "shape",
];

// Inject minimal CSS for image handles and shape SVG styling once
if (typeof document !== 'undefined' && !document.getElementById('quill-custom-styles')) {
  const style = document.createElement('style');
  style.id = 'quill-custom-styles';
  style.innerHTML = `
    .ql-custom-image-wrapper { display:inline-block; vertical-align:middle; margin:0 8px 8px 0; }
    .ql-custom-image-wrapper img { display:block; max-width:100%; margin:0 !important; }
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
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [collaboratorEmail, setCollaboratorEmail] = useState('');
  const [shareMessage, setShareMessage] = useState('');
  const [shareLoading, setShareLoading] = useState(false);
  const [copyMessage, setCopyMessage] = useState('');
  const [documentError, setDocumentError] = useState('');

  // Format dialog hooks
  const [formatOpen, setFormatOpen] = useState(false);
  const [formatRange, setFormatRange] = useState(null);
  const [dialogFont, setDialogFont] = useState('');
  const [dialogSize, setDialogSize] = useState('');
  const [dialogColor, setDialogColor] = useState('');

  const getEditor = useCallback(() => safeGetEditor(quillRef), []);
  const modules = useMemo(() => modulesFactory(), []);

  const captureFormatRange = useCallback(() => {
    const quill = getEditor();
    const range = quill?.getSelection() || null;
    setFormatRange(range);

    if (!quill) return;

    const currentFormats = quill.getFormat(range || undefined);
    setDialogFont(typeof currentFormats.font === 'string' ? normalizeFontValue(currentFormats.font) : '');
    setDialogSize(typeof currentFormats.size === 'string' ? currentFormats.size : '');
    setDialogColor(typeof currentFormats.color === 'string' ? currentFormats.color : '');
  }, [getEditor]);

  const applyFormatting = useCallback(() => {
    const quill = getEditor();
    if (!quill) return;

    const range = quill.getSelection() || formatRange;
    const formatsToApply = {
      font: dialogFont || false,
      size: dialogSize || false,
      color: dialogColor || false,
    };

    quill.focus();
    Object.entries(formatsToApply).forEach(([format, value]) => {
      if (range && range.length > 0) {
        quill.formatText(range.index, range.length, format, value, 'user');
      } else {
        quill.format(format, value, 'user');
      }
    });
  }, [dialogColor, dialogFont, dialogSize, formatRange, getEditor]);

  // Basic socket connection (lightweight)
  useEffect(() => {
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';
    const s = io(backendUrl, { withCredentials: true });
    setSocket(s);
    setIsSocketConnected(!!s.connected);
    const onConnect = () => setIsSocketConnected(true);
    const onDisconnect = () => {
      setIsSocketConnected(false);
      setTypingUser('');
    };
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
      setDocumentError('');
      setDocumentTitle(doc.title || 'Untitled Document');
      try { quill.setContents(doc.content || { ops: [] }); } catch { quill.setText(''); }
      quill.enable(true);
    };
    const onDocumentError = () => {
      didLoad = true;
      quill.enable(false);
      setDocumentError('Document not found or you do not have access.');
    };
    socket.once('load-document', onLoad);
    socket.once('document-not-found', onDocumentError);
    socket.once('not-authorized', onDocumentError);
    const fallback = setTimeout(() => { if (!didLoad) quill.enable(true); }, 2000);
    return () => {
      socket.off('load-document', onLoad);
      socket.off('document-not-found', onDocumentError);
      socket.off('not-authorized', onDocumentError);
      clearTimeout(fallback);
    };
  }, [socket, documentId]);

  useEffect(() => {
    const quill = getEditor();
    if (!socket || !quill) return;

    const receiveChangesHandler = (delta) => {
      quill.updateContents(delta, 'api');
    };

    socket.on('receive-changes', receiveChangesHandler);
    return () => { socket.off('receive-changes', receiveChangesHandler); };
  }, [getEditor, socket]);

  useEffect(() => {
    if (!socket) return;

    const typingHandler = ({ username }) => {
      if (username && username !== user?.username) {
        setTypingUser(`${username} is typing...`);
      }
    };
    const stoppedTypingHandler = ({ username }) => {
      if (!username || username === user?.username) return;
      setTypingUser('');
    };

    socket.on('user-typing', typingHandler);
    socket.on('user-stopped-typing', stoppedTypingHandler);

    return () => {
      socket.off('user-typing', typingHandler);
      socket.off('user-stopped-typing', stoppedTypingHandler);
    };
  }, [socket, user?.username]);

  useEffect(() => {
    if (!socket) return;

    const activeUsersHandler = (users) => {
      const normalizedUsers = Array.isArray(users)
        ? users
        : users?.activeUsers || users?.users || [];
      setActiveUsers(normalizedUsers);
    };

    socket.on('active-users', activeUsersHandler);
    return () => { socket.off('active-users', activeUsersHandler); };
  }, [socket]);

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
      try { quill.root.removeEventListener('blur', blurHandler); } catch { /* editor root may already be detached */ }
    };
  }, [socket, documentId, user]);

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

  const openShareModal = () => {
    setIsShareModalOpen(true);
    setShareMessage('');
    setCopyMessage('');
  };

  const closeShareModal = () => {
    setIsShareModalOpen(false);
    setCopyMessage('');
    setShareMessage('');
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopyMessage('Link copied');
      setTimeout(() => setCopyMessage(''), 2500);
    } catch {
      setCopyMessage('Unable to copy link');
    }
  };

  const handleAddCollaborator = async (event) => {
    event?.preventDefault();
    const email = collaboratorEmail.trim();

    if (!email) {
      setShareMessage('Enter an email address.');
      return;
    }

    try {
      setShareLoading(true);
      setShareMessage('');
      const response = await addCollaborator(documentId, email);
      setShareMessage(response.message || 'Collaborator added');
      setCollaboratorEmail('');
    } catch (err) {
      setShareMessage(err?.response?.data?.message || err?.response?.data?.error || 'Could not add collaborator');
    } finally {
      setShareLoading(false);
    }
  };

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
                className="text-xl font-bold text-slate-800 bg-slate-50 border-b-2 border-indigo-500 focus:outline-none px-1 py-0.5 w-52 transition-colors"
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                onBlur={handleTitleSubmit}
                onKeyDown={(e) => e.key === 'Enter' && handleTitleSubmit()}
              />
            ) : (
              <h1 
                onClick={() => { setIsEditingTitle(true); setTitleInput(documentTitle); }}
                className="text-xl font-bold text-slate-800 cursor-pointer hover:bg-slate-100 px-2 py-0.5 rounded transition-colors border-b-2 border-transparent whitespace-nowrap overflow-hidden text-ellipsis max-w-md"
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
              {typingUser && <span className="text-indigo-500">{typingUser}</span>}
            </div>
          </div>
        </div>

        <div className="flex items-center">
          <button
            onClick={openShareModal}
            className="inline-flex items-center justify-center rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            Share
          </button>
        </div>
      </header>

      {/* Editor Main Area */}
      <main className="flex-1 flex flex-col relative bg-slate-50/30">
        <CustomToolbar onUndo={onUndo} onRedo={onRedo} onSave={onSave} formatOpen={formatOpen} setFormatOpen={setFormatOpen} onCaptureFormatRange={captureFormatRange} dialogFont={dialogFont} setDialogFont={setDialogFont} dialogSize={dialogSize} setDialogSize={setDialogSize} dialogColor={dialogColor} setDialogColor={setDialogColor} onApplyFormat={applyFormatting} onCancelFormat={() => setFormatOpen(false)} />
        
        <div className="flex-1 overflow-y-auto w-full flex justify-center pb-24 pt-8 custom-scrollbar">
          {documentError ? (
            <div className="mt-20 w-full max-w-md rounded-lg border border-rose-200 bg-white p-6 text-center shadow-sm">
              <h2 className="text-base font-semibold text-slate-900">Unable to open document</h2>
              <p className="mt-2 text-sm text-slate-600">{documentError}</p>
              <button
                onClick={() => navigate('/dashboard')}
                className="mt-5 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-700"
              >
                Back to dashboard
              </button>
            </div>
          ) : (
            <ReactQuill ref={quillRef} theme="snow" className="w-full max-w-4xl shadow-sm rounded-xl overflow-hidden bg-white min-h-screen" modules={modules} formats={formats} placeholder="Start typing your document..." />
          )}
        </div>
      </main>

      {isShareModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 px-4 py-6 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeShareModal();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="share-dialog-title"
            className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/10"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
              <div>
                <h2 id="share-dialog-title" className="text-lg font-semibold text-slate-900">
                  Share "{documentTitle || 'Untitled Document'}"
                </h2>
                <p className="mt-1 text-sm text-slate-500">Invite collaborators or copy the document link.</p>
              </div>
              <button
                onClick={closeShareModal}
                className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close share dialog"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            </div>

            <div className="space-y-6 px-6 py-5">
              <section>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-slate-800">Copy Link</h3>
                  {copyMessage && <span className="text-xs font-medium text-emerald-600">{copyMessage}</span>}
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    readOnly
                    value={typeof window !== 'undefined' ? window.location.href : ''}
                    className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 outline-none"
                  />
                  <button
                    onClick={handleCopyLink}
                    className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    Copy Link
                  </button>
                </div>
              </section>

              <section>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-slate-800">Add Collaborator</h3>
                  {shareMessage && <span className="text-xs font-medium text-slate-500">{shareMessage}</span>}
                </div>
                <form className="flex flex-col gap-2 sm:flex-row" onSubmit={handleAddCollaborator}>
                  <input
                    type="email"
                    value={collaboratorEmail}
                    onChange={(event) => setCollaboratorEmail(event.target.value)}
                    placeholder="email@example.com"
                    className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  />
                  <button
                    type="submit"
                    disabled={shareLoading}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {shareLoading ? 'Adding...' : 'Add Collaborator'}
                  </button>
                </form>
              </section>

              <section>
                <h3 className="mb-3 text-sm font-semibold text-slate-800">Active collaborators</h3>
                {activeUsers.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {activeUsers.map((activeUser, index) => {
                      const name = getActiveUserName(activeUser);
                      return (
                        <span
                          key={activeUser?._id || activeUser?.id || activeUser?.socketId || `${name}-${index}`}
                          className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 ring-1 ring-emerald-100"
                        >
                          <span className="h-2 w-2 rounded-full bg-emerald-500" />
                          {name}
                        </span>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                    No active collaborators
                  </div>
                )}
              </section>
            </div>

            <div className="flex justify-end border-t border-slate-100 bg-slate-50 px-6 py-4">
              <button
                onClick={closeShareModal}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EditorPage;
