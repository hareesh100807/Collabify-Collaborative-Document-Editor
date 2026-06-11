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

const TEXT_COLOR_OPTIONS = ["#000000", "#5f6368", "#d93025", "#f29900", "#188038", "#1967d2", "#9334e6"];
const HIGHLIGHT_COLOR_OPTIONS = ["#ffffff", "#fce8e6", "#fef7e0", "#e6f4ea", "#e8f0fe", "#f3e8fd", "#fff475"];

const PARAGRAPH_OPTIONS = [
  { label: "Normal text", value: "" },
  { label: "Heading 1", value: "1" },
  { label: "Heading 2", value: "2" },
  { label: "Heading 3", value: "3" },
];

const ALIGN_OPTIONS = [
  { label: "Align left", value: false, icon: "left" },
  { label: "Align center", value: "center", icon: "center" },
  { label: "Align right", value: "right", icon: "right" },
  { label: "Justify", value: "justify", icon: "justify" },
];

const getActiveUserName = (activeUser) => {
  if (typeof activeUser === 'string') return activeUser;
  return activeUser?.username || activeUser?.name || activeUser?.email || 'Collaborator';
};

const normalizeToolbarColor = (value, fallback) => {
  if (typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)) return value;
  return fallback;
};

const ToolbarSeparator = () => <div className="mx-1 h-6 w-px shrink-0 bg-slate-300" />;

const ToolbarButton = ({ title, active = false, disabled = false, className = "", children, onClick }) => (
  <button
    type="button"
    title={title}
    aria-label={title}
    aria-pressed={active}
    disabled={disabled}
    onMouseDown={(event) => event.preventDefault()}
    onClick={onClick}
    className={`inline-flex h-8 min-w-8 shrink-0 items-center justify-center rounded-md px-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:cursor-not-allowed disabled:opacity-40 ${active ? "bg-blue-100 text-blue-700" : ""} ${className}`}
  >
    {children}
  </button>
);

const ToolbarSelect = ({ title, value, className = "", children, onChange }) => (
  <select
    title={title}
    aria-label={title}
    value={value}
    onChange={(event) => onChange(event.target.value)}
    className={`h-8 shrink-0 rounded-md border border-transparent bg-transparent px-2 text-sm text-slate-800 outline-none transition-colors hover:bg-slate-200 focus:border-blue-300 focus:bg-white ${className}`}
  >
    {children}
  </select>
);

const AlignIcon = ({ type }) => {
  const widths = {
    left: [18, 12, 16, 10],
    center: [14, 18, 12, 16],
    right: [10, 16, 12, 18],
    justify: [18, 18, 18, 18],
  }[type];

  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      {widths.map((width, index) => (
        <path
          key={`${type}-${index}`}
          d={`M${type === "right" ? 18 - width : type === "center" ? (20 - width) / 2 : 2} ${4 + index * 4}h${width}`}
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
};

const UndoIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M7 7H3v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M3 11a8 8 0 1 0 2.34-5.66L3 7.68" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const RedoIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M17 7h4v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M21 11a8 8 0 1 1-2.34-5.66L21 7.68" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const SaveIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    <path d="M17 21v-8H7v8M7 3v5h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const LinkIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M10 13a5 5 0 0 0 7.07 0l2-2a5 5 0 0 0-7.07-7.07l-1.1 1.1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M14 11a5 5 0 0 0-7.07 0l-2 2A5 5 0 0 0 12 20.07l1.1-1.1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const ImageIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="2" />
    <path d="m3 16 5-5 4 4 2-2 7 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="16.5" cy="9.5" r="1.5" fill="currentColor" />
  </svg>
);

const ListIcon = ({ ordered = false }) => (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    {ordered ? (
      <>
        <text x="2" y="7" fontSize="6" fill="currentColor">1</text>
        <text x="2" y="15" fontSize="6" fill="currentColor">2</text>
      </>
    ) : (
      <>
        <circle cx="4" cy="6" r="1.4" fill="currentColor" />
        <circle cx="4" cy="14" r="1.4" fill="currentColor" />
      </>
    )}
    <path d="M8 6h9M8 14h9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

const ClearIcon = () => (
  <span className="relative text-sm font-semibold">
    Tx
    <span className="absolute left-0 top-1/2 h-px w-full -rotate-12 bg-current" />
  </span>
);

const ToolbarPopover = ({ title, inputLabel, value, placeholder, submitLabel, onChange, onSubmit, onClose }) => (
  <div className="absolute left-0 top-10 z-30 w-80 rounded-lg border border-slate-200 bg-white p-3 shadow-xl">
    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</div>
    <form onSubmit={onSubmit} className="space-y-3">
      <label className="block text-sm text-slate-700">
        <span className="sr-only">{inputLabel}</span>
        <input
          autoFocus
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />
      </label>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100">
          Cancel
        </button>
        <button type="submit" className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700">
          {submitLabel}
        </button>
      </div>
    </form>
  </div>
);

const CustomToolbar = ({
  activeFormats,
  imageUrl,
  isImagePopoverOpen,
  isLinkPopoverOpen,
  linkUrl,
  onApplyImageUrl,
  onApplyLink,
  onClearFormatting,
  onColor,
  onFormat,
  onImagePopoverToggle,
  onLinkPopoverToggle,
  onRedo,
  onSave,
  onSetImageUrl,
  onSetLinkUrl,
  onUndo,
}) => {
  const normalizedFont = normalizeFontValue(activeFormats.font);
  const headerValue = typeof activeFormats.header === "number" || typeof activeFormats.header === "string" ? String(activeFormats.header) : "";
  const fontValue = typeof normalizedFont === "string" ? normalizedFont : "";
  const sizeValue = typeof activeFormats.size === "string" ? activeFormats.size : "";
  const textColor = normalizeToolbarColor(activeFormats.color, "#000000");
  const highlightColor = normalizeToolbarColor(activeFormats.background, "#ffffff");

  return (
    <div className="sticky top-0 z-20 border-b border-slate-200 bg-white px-3 py-2 shadow-sm">
      <div className="overflow-x-auto">
        <div className="flex min-w-max items-center gap-1 rounded-full bg-[#edf2fa] px-2 py-1">
          <ToolbarButton title="Undo" onClick={onUndo}><UndoIcon /></ToolbarButton>
          <ToolbarButton title="Redo" onClick={onRedo}><RedoIcon /></ToolbarButton>
          <ToolbarButton title="Save" onClick={onSave}><SaveIcon /></ToolbarButton>

          <ToolbarSeparator />

          <ToolbarSelect title="Paragraph style" value={headerValue} className="w-36" onChange={(value) => onFormat("header", value ? Number(value) : false)}>
            {PARAGRAPH_OPTIONS.map((option) => (
              <option key={option.label} value={option.value}>{option.label}</option>
            ))}
          </ToolbarSelect>

          <ToolbarSelect title="Font family" value={fontValue} className="w-40" onChange={(value) => onFormat("font", value || false)}>
            {FONT_OPTIONS.map(({ label, value }) => (
              <option value={value} key={`${label}-${value}`}>{label}</option>
            ))}
          </ToolbarSelect>

          <ToolbarSelect title="Font size" value={sizeValue} className="w-24" onChange={(value) => onFormat("size", value || false)}>
            {SIZE_OPTIONS.map(({ label, value }) => (
              <option value={value} key={`${label}-${value}`}>{label}</option>
            ))}
          </ToolbarSelect>

          <ToolbarSeparator />

          <ToolbarButton title="Bold" active={!!activeFormats.bold} className="font-bold" onClick={() => onFormat("bold", !activeFormats.bold)}>B</ToolbarButton>
          <ToolbarButton title="Italic" active={!!activeFormats.italic} className="italic" onClick={() => onFormat("italic", !activeFormats.italic)}>I</ToolbarButton>
          <ToolbarButton title="Underline" active={!!activeFormats.underline} className="underline" onClick={() => onFormat("underline", !activeFormats.underline)}>U</ToolbarButton>
          <ToolbarButton title="Strike" active={!!activeFormats.strike} className="line-through" onClick={() => onFormat("strike", !activeFormats.strike)}>S</ToolbarButton>

          <ToolbarSeparator />

          <div className="flex items-center rounded-md px-1 hover:bg-slate-200" title="Text color">
            <span className="mr-1 text-sm font-semibold text-slate-700">A</span>
            <input
              aria-label="Text color"
              type="color"
              value={textColor}
              list="editor-text-colors"
              onChange={(event) => onColor("color", event.target.value)}
              className="h-7 w-7 cursor-pointer rounded border-0 bg-transparent p-0"
            />
            <datalist id="editor-text-colors">
              {TEXT_COLOR_OPTIONS.map((color) => <option key={color} value={color} />)}
            </datalist>
          </div>

          <div className="flex items-center rounded-md px-1 hover:bg-slate-200" title="Highlight color">
            <span className="mr-1 rounded-sm px-1 text-sm font-semibold text-slate-700" style={{ backgroundColor: highlightColor }}>A</span>
            <input
              aria-label="Highlight color"
              type="color"
              value={highlightColor}
              list="editor-highlight-colors"
              onChange={(event) => onColor("background", event.target.value)}
              className="h-7 w-7 cursor-pointer rounded border-0 bg-transparent p-0"
            />
            <datalist id="editor-highlight-colors">
              {HIGHLIGHT_COLOR_OPTIONS.map((color) => <option key={color} value={color} />)}
            </datalist>
          </div>

          <ToolbarSeparator />

          {ALIGN_OPTIONS.map((option) => (
            <ToolbarButton
              key={option.label}
              title={option.label}
              active={option.value ? activeFormats.align === option.value : !activeFormats.align}
              onClick={() => onFormat("align", option.value)}
            >
              <AlignIcon type={option.icon} />
            </ToolbarButton>
          ))}

          <ToolbarSeparator />

          <ToolbarButton title="Ordered list" active={activeFormats.list === "ordered"} onClick={() => onFormat("list", activeFormats.list === "ordered" ? false : "ordered")}>
            <ListIcon ordered />
          </ToolbarButton>
          <ToolbarButton title="Bullet list" active={activeFormats.list === "bullet"} onClick={() => onFormat("list", activeFormats.list === "bullet" ? false : "bullet")}>
            <ListIcon />
          </ToolbarButton>

          <ToolbarSeparator />

          <div className="relative">
            <ToolbarButton title="Insert link" active={!!activeFormats.link || isLinkPopoverOpen} onClick={onLinkPopoverToggle}>
              <LinkIcon />
            </ToolbarButton>
            {isLinkPopoverOpen && (
              <ToolbarPopover
                title="Insert link"
                inputLabel="Link URL"
                value={linkUrl}
                placeholder="https://example.com"
                submitLabel="Apply"
                onChange={onSetLinkUrl}
                onClose={onLinkPopoverToggle}
                onSubmit={onApplyLink}
              />
            )}
          </div>

          <div className="relative">
            <ToolbarButton title="Insert image by URL" active={isImagePopoverOpen} onClick={onImagePopoverToggle}>
              <ImageIcon />
            </ToolbarButton>
            {isImagePopoverOpen && (
              <ToolbarPopover
                title="Insert image"
                inputLabel="Image URL"
                value={imageUrl}
                placeholder="https://example.com/image.png"
                submitLabel="Insert"
                onChange={onSetImageUrl}
                onClose={onImagePopoverToggle}
                onSubmit={onApplyImageUrl}
              />
            )}
          </div>

          <ToolbarButton title="Clear formatting" onClick={onClearFormatting}>
            <ClearIcon />
          </ToolbarButton>
        </div>
      </div>
    </div>
  );
};

const modulesFactory = () => ({
  toolbar: false,
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

  const [activeFormats, setActiveFormats] = useState({});
  const [isLinkPopoverOpen, setIsLinkPopoverOpen] = useState(false);
  const [isImagePopoverOpen, setIsImagePopoverOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [savedToolbarRange, setSavedToolbarRange] = useState(null);

  const getEditor = useCallback(() => {
    try {
      const quill = quillRef.current.getEditor();
      return quill;
    } catch {
      return null;
    }
  }, []);
  const modules = useMemo(() => modulesFactory(), []);

  const refreshActiveFormats = useCallback(() => {
    const quill = getEditor();
    if (!quill) return;

    const range = quill.getSelection();
    if (!range) {
      setActiveFormats({});
      return;
    }

    const currentFormats = quill.getFormat(range || undefined);
    setActiveFormats({
      ...currentFormats,
      font: typeof currentFormats.font === 'string' ? normalizeFontValue(currentFormats.font) : currentFormats.font,
    });
  }, [getEditor]);

  const captureToolbarRange = useCallback(() => {
    const quill = getEditor();
    if (!quill) return null;

    const range = quill.getSelection(true);
    setSavedToolbarRange(range);
    return range;
  }, [getEditor]);

  const updateToolbarSoon = useCallback(() => {
    window.setTimeout(refreshActiveFormats, 0);
  }, [refreshActiveFormats]);

  const formatSelection = useCallback((format, value) => {
    const quill = getEditor();
    if (!quill) return;

    quill.focus();
    quill.format(format, value, 'user');
    updateToolbarSoon();
  }, [getEditor, updateToolbarSoon]);

  const handleToolbarColor = useCallback((format, value) => {
    formatSelection(format, value || false);
  }, [formatSelection]);

  const handleClearFormatting = useCallback(() => {
    const quill = getEditor();
    if (!quill) return;

    quill.focus();
    const range = quill.getSelection(true);
    if (!range) return;

    if (range.length > 0) {
      quill.removeFormat(range.index, range.length, 'user');
    } else {
      ["bold", "italic", "underline", "strike", "color", "background", "font", "size", "link", "header", "align", "list"].forEach((format) => {
        quill.format(format, false, 'user');
      });
    }

    updateToolbarSoon();
  }, [getEditor, updateToolbarSoon]);

  const toggleLinkPopover = useCallback(() => {
    const quill = getEditor();
    if (quill) {
      const range = quill.getSelection(true);
      const formatsAtRange = range ? quill.getFormat(range) : {};
      setSavedToolbarRange(range);
      setLinkUrl(typeof formatsAtRange.link === 'string' ? formatsAtRange.link : '');
    }

    setIsImagePopoverOpen(false);
    setIsLinkPopoverOpen((isOpen) => !isOpen);
  }, [getEditor]);

  const toggleImagePopover = useCallback(() => {
    captureToolbarRange();
    setImageUrl('');
    setIsLinkPopoverOpen(false);
    setIsImagePopoverOpen((isOpen) => !isOpen);
  }, [captureToolbarRange]);

  const applyLink = useCallback((event) => {
    event.preventDefault();
    const quill = getEditor();
    if (!quill) return;

    const range = savedToolbarRange || quill.getSelection(true);
    if (!range) return;

    const url = linkUrl.trim();
    quill.focus();

    if (!url) {
      if (range.length > 0) quill.formatText(range.index, range.length, 'link', false, 'user');
    } else if (range.length > 0) {
      quill.formatText(range.index, range.length, 'link', url, 'user');
      quill.setSelection(range.index + range.length, 0, 'silent');
    } else {
      quill.insertText(range.index, url, 'link', url, 'user');
      quill.setSelection(range.index + url.length, 0, 'silent');
    }

    setIsLinkPopoverOpen(false);
    setLinkUrl('');
    updateToolbarSoon();
  }, [getEditor, linkUrl, savedToolbarRange, updateToolbarSoon]);

  const applyImageUrl = useCallback((event) => {
    event.preventDefault();
    const quill = getEditor();
    const url = imageUrl.trim();
    if (!quill || !url) return;

    quill.focus();
    const range = savedToolbarRange || quill.getSelection(true);
    const index = range ? range.index : Math.max(0, quill.getLength() - 1);
    quill.insertEmbed(index, 'custom-image', { src: url }, 'user');
    quill.setSelection(index + 1, 0, 'silent');
    setIsImagePopoverOpen(false);
    setImageUrl('');
    updateToolbarSoon();
  }, [getEditor, imageUrl, savedToolbarRange, updateToolbarSoon]);

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

  useEffect(() => {
    const quill = getEditor();
    if (!quill || documentError) return;

    const updateFormats = () => refreshActiveFormats();
    quill.on('selection-change', updateFormats);
    quill.on('text-change', updateFormats);
    refreshActiveFormats();

    return () => {
      quill.off('selection-change', updateFormats);
      quill.off('text-change', updateFormats);
    };
  }, [documentError, getEditor, refreshActiveFormats]);

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

  const onUndo = () => {
    const quill = getEditor();
    if (!quill) return;
    quill.history.undo();
    updateToolbarSoon();
  };

  const onRedo = () => {
    const quill = getEditor();
    if (!quill) return;
    quill.history.redo();
    updateToolbarSoon();
  };

  const onSave = async () => {
    const quill = getEditor();
    if (!quill) return;

    try {
      setIsSaving(true);
      const content = quill.getContents();
      await axiosInstance.put(`/documents/${documentId}`, { content });
    } catch (err) {
      console.error('save failed', err);
    } finally {
      setIsSaving(false);
    }
  };

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
      <main className="flex-1 flex flex-col relative bg-[#f1f3f4]">
        <CustomToolbar
          activeFormats={activeFormats}
          imageUrl={imageUrl}
          isImagePopoverOpen={isImagePopoverOpen}
          isLinkPopoverOpen={isLinkPopoverOpen}
          linkUrl={linkUrl}
          onApplyImageUrl={applyImageUrl}
          onApplyLink={applyLink}
          onClearFormatting={handleClearFormatting}
          onColor={handleToolbarColor}
          onFormat={formatSelection}
          onImagePopoverToggle={toggleImagePopover}
          onLinkPopoverToggle={toggleLinkPopover}
          onRedo={onRedo}
          onSave={onSave}
          onSetImageUrl={setImageUrl}
          onSetLinkUrl={setLinkUrl}
          onUndo={onUndo}
        />
        
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
