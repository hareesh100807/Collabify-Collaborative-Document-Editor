/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Eraser,
  History,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  PaintBucket,
  Redo2,
  Save,
  Shapes,
  Strikethrough,
  Type,
  TextCursorInput,
  Underline,
  Undo2,
  Video as VideoIcon,
} from "lucide-react";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import { useNavigate, useParams } from "react-router-dom";
import { io } from "socket.io-client";
import { useAuth } from "../context/AuthContext";
import { addCollaborator, getCollaborators, getVersions, renameDocument, restoreVersion } from "../api/documentService.js";
import axiosInstance from "../api/axios.js";

const Quill = ReactQuill.Quill;
const BlockEmbed = Quill.import("blots/block/embed");

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:4000";
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_VIDEO_SIZE = 25 * 1024 * 1024;

const FONT_OPTIONS = [
  { value: "", label: "Default" },
  { value: "sans-serif", label: "Sans Serif" },
  { value: "serif", label: "Serif" },
  { value: "monospace", label: "Monospace" },
  { value: "inter", label: "Inter" },
  { value: "roboto", label: "Roboto" },
  { value: "arial", label: "Arial" },
  { value: "georgia", label: "Georgia" },
  { value: "times-new-roman", label: "Times New Roman" },
  { value: "courier-new", label: "Courier New" },
  { value: "verdana", label: "Verdana" },
];

const SIZE_OPTIONS = ["10px", "12px", "14px", "16px", "18px", "20px", "24px", "28px", "36px", "48px", "72px"];

const SHAPE_OPTIONS = [
  { value: "rectangle", label: "Rectangle" },
  { value: "rounded-rectangle", label: "Rounded rectangle" },
  { value: "circle", label: "Circle" },
  { value: "oval", label: "Oval" },
  { value: "triangle", label: "Triangle" },
  { value: "right-triangle", label: "Right triangle" },
  { value: "diamond", label: "Diamond" },
  { value: "line", label: "Line" },
  { value: "arrow", label: "Arrow" },
  { value: "double-arrow", label: "Double arrow" },
  { value: "star", label: "Star" },
  { value: "heart", label: "Heart" },
  { value: "pentagon", label: "Pentagon" },
  { value: "hexagon", label: "Hexagon" },
  { value: "speech-bubble", label: "Speech bubble" },
  { value: "cloud", label: "Cloud" },
  { value: "check", label: "Check mark" },
  { value: "cross", label: "Cross mark" },
];

const RESIZE_HANDLES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const TEXT_BOX_DEFAULTS = {
  html: "Type here...",
  left: 96,
  top: 96,
  width: 260,
  height: 130,
};

const normalizeObjectValue = (value, fallback = {}) => {
  if (typeof value === "string") {
    return { ...fallback, src: value };
  }

  return { ...fallback, ...(value || {}) };
};

const normalizeTextBoxValue = (value) => {
  if (typeof value === "string") {
    return { ...TEXT_BOX_DEFAULTS, html: value };
  }

  return { ...TEXT_BOX_DEFAULTS, ...(value || {}) };
};

const emitEditorObjectChange = () => {
  window.dispatchEvent(new CustomEvent("editor-object-change"));
};

const createResizeHandle = (position) => {
  const handle = document.createElement("span");
  handle.className = `ql-resize-handle ql-resize-${position}`;
  handle.dataset.resizeHandle = position;
  handle.setAttribute("contenteditable", "false");
  return handle;
};

const positionResizeHandles = (node) => {
  const width = Number(node.dataset.width || 220);
  const height = Number(node.dataset.height || 140);
  const positions = {
    nw: [0, 0],
    n: [width / 2, 0],
    ne: [width, 0],
    e: [width, height / 2],
    se: [width, height],
    s: [width / 2, height],
    sw: [0, height],
    w: [0, height / 2],
  };

  node.querySelectorAll("[data-resize-handle]").forEach((handle) => {
    const [left, top] = positions[handle.dataset.resizeHandle];
    handle.style.left = `${left}px`;
    handle.style.top = `${top}px`;
  });
};

const setObjectBox = (node, target, width, height, updateTarget) => {
  const nextWidth = Math.round(clamp(width, 40, 760));
  const nextHeight = Math.round(clamp(height, 24, 760));

  node.dataset.width = String(nextWidth);
  node.dataset.height = String(nextHeight);
  node.style.width = `${nextWidth}px`;
  node.style.height = `${nextHeight}px`;

  if (target) {
    target.style.width = `${nextWidth}px`;
    target.style.height = `${nextHeight}px`;
  }

  updateTarget?.(nextWidth, nextHeight);
  positionResizeHandles(node);
};

const attachObjectControls = (node, target, updateTarget) => {
  if (node.dataset.decorated === "true") return;
  node.dataset.decorated = "true";
  node.classList.add("ql-editor-object");
  node.setAttribute("contenteditable", "false");
  node.style.position = "relative";
  node.style.display = "inline-block";
  node.style.verticalAlign = "middle";
  node.style.userSelect = "none";
  node.style.transform = `translate(${Number(node.dataset.x || 0)}px, ${Number(node.dataset.y || 0)}px)`;

  RESIZE_HANDLES.forEach((position) => {
    node.appendChild(createResizeHandle(position));
  });

  setObjectBox(node, target, Number(node.dataset.width || 220), Number(node.dataset.height || 140), updateTarget);

  const selectNode = (event) => {
    document.querySelectorAll(".ql-editor-object.is-selected").forEach((selected) => {
      if (selected !== node) selected.classList.remove("is-selected");
    });
    node.classList.add("is-selected");
    positionResizeHandles(node);
    event?.stopPropagation();
  };

  node.addEventListener("click", selectNode);

  node.querySelectorAll("[data-resize-handle]").forEach((handle) => {
    handle.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      selectNode(event);

      const startX = event.clientX;
      const startY = event.clientY;
      const startWidth = Number(node.dataset.width || 220);
      const startHeight = Number(node.dataset.height || 140);
      const position = handle.dataset.resizeHandle;

      handle.setPointerCapture(event.pointerId);

      const onMove = (moveEvent) => {
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;
        let nextWidth = startWidth;
        let nextHeight = startHeight;

        if (position.includes("e")) nextWidth = startWidth + dx;
        if (position.includes("w")) nextWidth = startWidth - dx;
        if (position.includes("s")) nextHeight = startHeight + dy;
        if (position.includes("n")) nextHeight = startHeight - dy;

        setObjectBox(node, target, nextWidth, nextHeight, updateTarget);
        emitEditorObjectChange();
      };

      const onUp = (upEvent) => {
        try {
          handle.releasePointerCapture(upEvent.pointerId);
        } catch {
          // Pointer capture may already be released by the browser.
        }
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        emitEditorObjectChange();
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    });
  });

  node.addEventListener("pointerdown", (event) => {
    if (event.target?.dataset?.resizeHandle) return;
    if (event.target?.tagName === "VIDEO") return;

    selectNode(event);
    const startX = event.clientX;
    const startY = event.clientY;
    const originX = Number(node.dataset.x || 0);
    const originY = Number(node.dataset.y || 0);

    node.setPointerCapture(event.pointerId);

    const onMove = (moveEvent) => {
      const nextX = Math.round(originX + moveEvent.clientX - startX);
      const nextY = Math.round(originY + moveEvent.clientY - startY);
      node.dataset.x = String(nextX);
      node.dataset.y = String(nextY);
      node.style.transform = `translate(${nextX}px, ${nextY}px)`;
      emitEditorObjectChange();
    };

    const onUp = (upEvent) => {
      try {
        node.releasePointerCapture(upEvent.pointerId);
      } catch {
        // Pointer capture may already be released by the browser.
      }
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      emitEditorObjectChange();
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  });
};

const getNumberFromStyle = (node, key, fallback) => {
  const value = Number(node.dataset[key] || Number.parseFloat(node.style[key]));
  return Number.isFinite(value) ? value : fallback;
};

const setTextBoxPosition = (node, left, top) => {
  const nextLeft = Math.round(left);
  const nextTop = Math.round(top);
  node.dataset.left = String(nextLeft);
  node.dataset.top = String(nextTop);
  node.style.left = `${nextLeft}px`;
  node.style.top = `${nextTop}px`;
};

const setTextBoxBox = (node, width, height) => {
  const nextWidth = Math.round(clamp(width, 120, 620));
  const nextHeight = Math.round(clamp(height, 72, 520));
  const editable = node.querySelector("[data-text-box-content]");

  node.dataset.width = String(nextWidth);
  node.dataset.height = String(nextHeight);
  node.style.width = `${nextWidth}px`;
  node.style.minHeight = `${nextHeight}px`;

  if (editable) {
    editable.style.minHeight = `${Math.max(nextHeight - 38, 42)}px`;
  }

  positionResizeHandles(node);
};

const styleTextBoxNode = (node) => {
  node.classList.add("ql-editor-object", "ql-text-box-wrapper");
  node.setAttribute("contenteditable", "false");
  node.style.position = "absolute";
  node.style.zIndex = "12";
  node.style.boxSizing = "border-box";
  node.style.border = "1px solid #818cf8";
  node.style.borderRadius = "10px";
  node.style.background = "#ffffff";
  node.style.boxShadow = "none";
  node.style.overflow = "visible";
  node.style.userSelect = "none";
};

const styleTextBoxHandle = (handle) => {
  handle.className = "ql-text-box-drag-handle";
  handle.dataset.textBoxHandle = "true";
  handle.setAttribute("contenteditable", "false");
  handle.textContent = "";
  handle.style.position = "absolute";
  handle.style.top = "-6px";
  handle.style.left = "0";
  handle.style.right = "0";
  handle.style.zIndex = "4";
  handle.style.height = "12px";
  handle.style.cursor = "move";
  handle.style.display = "block";
  handle.style.padding = "0";
  handle.style.border = "0";
  handle.style.borderRadius = "0";
  handle.style.background = "transparent";
  handle.style.color = "transparent";
  handle.style.fontSize = "0";
  handle.style.lineHeight = "0";
};

const styleTextBoxContent = (editable) => {
  editable.className = "ql-text-box-content";
  editable.dataset.textBoxContent = "true";
  editable.setAttribute("contenteditable", "true");
  editable.style.boxSizing = "border-box";
  editable.style.width = "100%";
  editable.style.padding = "10px 12px";
  editable.style.color = "#0f172a";
  editable.style.fontSize = "15px";
  editable.style.lineHeight = "1.5";
  editable.style.outline = "none";
  editable.style.userSelect = "text";
  editable.style.cursor = "text";
  editable.style.whiteSpace = "pre-wrap";
};

const ensureTextBoxParts = (node) => {
  let handle = node.querySelector("[data-text-box-handle]");
  if (!handle) {
    handle = document.createElement("div");
    node.prepend(handle);
  }
  styleTextBoxHandle(handle);

  let editable = node.querySelector("[data-text-box-content]");
  if (!editable) {
    editable = document.createElement("div");
    editable.innerHTML = node.dataset.html || TEXT_BOX_DEFAULTS.html;
    node.appendChild(editable);
  }
  styleTextBoxContent(editable);

  return { handle, editable };
};

const attachTextBoxControls = (node) => {
  if (node.dataset.decorated === "true") return;
  node.dataset.decorated = "true";
  styleTextBoxNode(node);

  const { handle, editable } = ensureTextBoxParts(node);
  const selectNode = (event) => {
    document.querySelectorAll(".ql-editor-object.is-selected").forEach((selected) => {
      if (selected !== node) selected.classList.remove("is-selected");
    });
    node.classList.add("is-selected");
    positionResizeHandles(node);
    event?.stopPropagation();
  };

  node.dataset.left ||= String(getNumberFromStyle(node, "left", TEXT_BOX_DEFAULTS.left));
  node.dataset.top ||= String(getNumberFromStyle(node, "top", TEXT_BOX_DEFAULTS.top));
  node.dataset.width ||= String(getNumberFromStyle(node, "width", TEXT_BOX_DEFAULTS.width));
  node.dataset.height ||= String(getNumberFromStyle(node, "height", TEXT_BOX_DEFAULTS.height));

  setTextBoxPosition(node, Number(node.dataset.left), Number(node.dataset.top));

  if (!node.querySelector("[data-resize-handle]")) {
    RESIZE_HANDLES.forEach((position) => {
      node.appendChild(createResizeHandle(position));
    });
  }

  setTextBoxBox(node, Number(node.dataset.width), Number(node.dataset.height));

  handle.addEventListener("mousedown", (event) => {
    event.preventDefault();
    event.stopPropagation();
    selectNode(event);

    const startX = event.clientX;
    const startY = event.clientY;
    const originLeft = Number(node.dataset.left || 0);
    const originTop = Number(node.dataset.top || 0);

    const onMove = (moveEvent) => {
      setTextBoxPosition(node, originLeft + moveEvent.clientX - startX, originTop + moveEvent.clientY - startY);
    };

    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      emitEditorObjectChange();
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  });

  node.querySelectorAll("[data-resize-handle]").forEach((resizeHandle) => {
    resizeHandle.addEventListener("mousedown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      selectNode(event);

      const startX = event.clientX;
      const startY = event.clientY;
      const startWidth = Number(node.dataset.width || TEXT_BOX_DEFAULTS.width);
      const startHeight = Number(node.dataset.height || TEXT_BOX_DEFAULTS.height);
      const startLeft = Number(node.dataset.left || 0);
      const startTop = Number(node.dataset.top || 0);
      const position = resizeHandle.dataset.resizeHandle;

      const onMove = (moveEvent) => {
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;
        let nextWidth = startWidth;
        let nextHeight = startHeight;
        let nextLeft = startLeft;
        let nextTop = startTop;

        if (position.includes("e")) nextWidth = startWidth + dx;
        if (position.includes("s")) nextHeight = startHeight + dy;
        if (position.includes("w")) {
          nextWidth = startWidth - dx;
          nextLeft = startLeft + dx;
        }
        if (position.includes("n")) {
          nextHeight = startHeight - dy;
          nextTop = startTop + dy;
        }

        setTextBoxPosition(node, nextLeft, nextTop);
        setTextBoxBox(node, nextWidth, nextHeight);
      };

      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        emitEditorObjectChange();
      };

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    });
  });

  editable.addEventListener("mousedown", selectNode);
  editable.addEventListener("click", (event) => event.stopPropagation());
  editable.addEventListener("keydown", (event) => event.stopPropagation());
  editable.addEventListener("input", () => {
    node.dataset.html = editable.innerHTML;
    emitEditorObjectChange();
  });
  editable.addEventListener("paste", () => {
    window.setTimeout(() => {
      node.dataset.html = editable.innerHTML;
      emitEditorObjectChange();
    }, 0);
  });
};

const renderShapeSvg = (svg, type, width, height, fill = "#eef2ff", stroke = "#4f46e5") => {
  svg.innerHTML = "";
  svg.setAttribute("width", String(width));
  svg.setAttribute("height", String(height));
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

  const create = (tag) => document.createElementNS("http://www.w3.org/2000/svg", tag);
  const append = (shape, options = {}) => {
    if (!options.noFill) shape.setAttribute("fill", fill);
    if (options.fill) shape.setAttribute("fill", options.fill);
    shape.setAttribute("stroke", stroke);
    shape.setAttribute("stroke-width", options.strokeWidth || "3");
    shape.setAttribute("stroke-linecap", "round");
    shape.setAttribute("stroke-linejoin", "round");
    svg.appendChild(shape);
  };

  const polygon = (points) => {
    const shape = create("polygon");
    shape.setAttribute("points", points);
    append(shape);
  };

  const path = (d, options) => {
    const shape = create("path");
    shape.setAttribute("d", d);
    append(shape, options);
  };

  if (type === "circle" || type === "oval") {
    const shape = create("ellipse");
    shape.setAttribute("cx", String(width / 2));
    shape.setAttribute("cy", String(height / 2));
    shape.setAttribute("rx", String(type === "circle" ? Math.max(Math.min(width, height) / 2 - 4, 4) : Math.max(width / 2 - 4, 4)));
    shape.setAttribute("ry", String(Math.max(height / 2 - 4, 4)));
    append(shape);
  } else if (type === "triangle") {
    polygon(`${width / 2},4 ${width - 4},${height - 4} 4,${height - 4}`);
  } else if (type === "right-triangle") {
    polygon(`4,4 ${width - 4},${height - 4} 4,${height - 4}`);
  } else if (type === "diamond") {
    polygon(`${width / 2},4 ${width - 4},${height / 2} ${width / 2},${height - 4} 4,${height / 2}`);
  } else if (type === "pentagon") {
    polygon(`${width / 2},4 ${width - 5},${height * 0.38} ${width * 0.82},${height - 4} ${width * 0.18},${height - 4} 5,${height * 0.38}`);
  } else if (type === "hexagon") {
    polygon(`${width * 0.25},4 ${width * 0.75},4 ${width - 5},${height / 2} ${width * 0.75},${height - 4} ${width * 0.25},${height - 4} 5,${height / 2}`);
  } else if (type === "star") {
    polygon(`${width / 2},4 ${width * 0.61},${height * 0.36} ${width - 5},${height * 0.36} ${width * 0.68},${height * 0.56} ${width * 0.8},${height - 5} ${width / 2},${height * 0.68} ${width * 0.2},${height - 5} ${width * 0.32},${height * 0.56} 5,${height * 0.36} ${width * 0.39},${height * 0.36}`);
  } else if (type === "heart") {
    path(`M ${width / 2} ${height - 8} C ${width * 0.14} ${height * 0.62}, 4 ${height * 0.42}, ${width * 0.16} ${height * 0.22} C ${width * 0.28} 4, ${width * 0.43} ${height * 0.12}, ${width / 2} ${height * 0.25} C ${width * 0.57} ${height * 0.12}, ${width * 0.72} 4, ${width * 0.84} ${height * 0.22} C ${width - 4} ${height * 0.42}, ${width * 0.86} ${height * 0.62}, ${width / 2} ${height - 8} Z`);
  } else if (type === "speech-bubble") {
    path(`M 8 8 H ${width - 8} Q ${width - 4} 8 ${width - 4} 12 V ${height - 24} Q ${width - 4} ${height - 20} ${width - 8} ${height - 20} H ${width * 0.42} L ${width * 0.28} ${height - 6} V ${height - 20} H 8 Q 4 ${height - 20} 4 ${height - 24} V 12 Q 4 8 8 8 Z`);
  } else if (type === "cloud") {
    path(`M ${width * 0.22} ${height * 0.68} C ${width * 0.08} ${height * 0.66}, ${width * 0.06} ${height * 0.38}, ${width * 0.28} ${height * 0.42} C ${width * 0.34} ${height * 0.18}, ${width * 0.62} ${height * 0.18}, ${width * 0.68} ${height * 0.42} C ${width * 0.9} ${height * 0.38}, ${width * 0.92} ${height * 0.66}, ${width * 0.76} ${height * 0.68} Z`);
  } else if (type === "check") {
    path(`M ${width * 0.18} ${height * 0.52} L ${width * 0.42} ${height * 0.74} L ${width * 0.82} ${height * 0.28}`, { noFill: true, strokeWidth: "7" });
  } else if (type === "cross") {
    path(`M ${width * 0.24} ${height * 0.24} L ${width * 0.76} ${height * 0.76} M ${width * 0.76} ${height * 0.24} L ${width * 0.24} ${height * 0.76}`, { noFill: true, strokeWidth: "7" });
  } else if (type === "line" || type === "arrow" || type === "double-arrow") {
    const shape = create("line");
    shape.setAttribute("x1", "8");
    shape.setAttribute("y1", String(height / 2));
    shape.setAttribute("x2", String(width - 12));
    shape.setAttribute("y2", String(height / 2));
    append(shape, { noFill: true, strokeWidth: "5" });

    if (type === "arrow" || type === "double-arrow") {
      const arrowHead = create("polygon");
      arrowHead.setAttribute("points", `${width - 6},${height / 2} ${width - 24},${height / 2 - 10} ${width - 24},${height / 2 + 10}`);
      arrowHead.setAttribute("fill", stroke);
      svg.appendChild(arrowHead);
    }
    if (type === "double-arrow") {
      const arrowTail = create("polygon");
      arrowTail.setAttribute("points", `6,${height / 2} 24,${height / 2 - 10} 24,${height / 2 + 10}`);
      arrowTail.setAttribute("fill", stroke);
      svg.appendChild(arrowTail);
    }
  } else {
    const shape = create("rect");
    shape.setAttribute("x", "4");
    shape.setAttribute("y", "4");
    shape.setAttribute("width", String(Math.max(width - 8, 8)));
    shape.setAttribute("height", String(Math.max(height - 8, 8)));
    shape.setAttribute("rx", type === "rounded-rectangle" ? "16" : "6");
    append(shape);
  }
};

const getShapeHtml = (type) => {
  const isLineShape = ["line", "arrow", "double-arrow"].includes(type);
  const width = isLineShape ? 240 : 170;
  const height = isLineShape ? 48 : 110;

  return `<div class="ql-shape-embed" data-type="${type}" data-width="${width}" data-height="${height}" data-x="0" data-y="0" data-fill="#eef2ff" data-stroke="#4f46e5"></div><p><br></p>`;
};

const getVideoHtml = (src) =>
  `<div class="ql-resizable-video-wrapper" data-src="${src}" data-width="480" data-height="280" data-x="0" data-y="0"><video src="${src}" controls style="max-width:100%;width:480px;height:280px;border-radius:10px;"></video></div><p><br></p>`;

class ResizableImageBlot extends BlockEmbed {
  static blotName = "image";
  static tagName = "div";
  static className = "ql-resizable-image-wrapper";

  static create(value) {
    const data = normalizeObjectValue(value, { width: 360, height: 220, x: 0, y: 0 });
    const node = super.create();
    const image = document.createElement("img");

    node.dataset.src = data.src || "";
    node.dataset.width = String(data.width || 360);
    node.dataset.height = String(data.height || 220);
    node.dataset.x = String(data.x || 0);
    node.dataset.y = String(data.y || 0);

    image.src = data.src || "";
    image.alt = "Inserted";
    image.draggable = false;
    image.style.objectFit = "contain";
    image.style.display = "block";
    node.appendChild(image);

    attachObjectControls(node, image);
    return node;
  }

  static value(domNode) {
    const image = domNode.querySelector("img");
    return {
      src: image?.src || domNode.dataset.src || "",
      width: Number(domNode.dataset.width || 360),
      height: Number(domNode.dataset.height || 220),
      x: Number(domNode.dataset.x || 0),
      y: Number(domNode.dataset.y || 0),
    };
  }
}

class VideoBlot extends BlockEmbed {
  static blotName = "custom-video";
  static tagName = "div";
  static className = "ql-resizable-video-wrapper";

  static create(value) {
    const data = normalizeObjectValue(value, { width: 420, height: 260, x: 0, y: 0 });
    const node = super.create();
    const video = document.createElement("video");

    node.dataset.src = data.src || "";
    node.dataset.width = String(data.width || 420);
    node.dataset.height = String(data.height || 260);
    node.dataset.x = String(data.x || 0);
    node.dataset.y = String(data.y || 0);

    video.src = data.src || "";
    video.controls = true;
    video.draggable = false;
    video.style.objectFit = "contain";
    video.style.display = "block";
    node.appendChild(video);

    attachObjectControls(node, video);
    return node;
  }

  static value(domNode) {
    const video = domNode.querySelector("video");
    return {
      src: video?.src || domNode.dataset.src || "",
      width: Number(domNode.dataset.width || 420),
      height: Number(domNode.dataset.height || 260),
      x: Number(domNode.dataset.x || 0),
      y: Number(domNode.dataset.y || 0),
    };
  }
}

class ShapeBlot extends BlockEmbed {
  static blotName = "shape";
  static tagName = "div";
  static className = "ql-shape-embed";

  static create(value) {
    const data = normalizeObjectValue(value, {
      type: "rectangle",
      width: 160,
      height: 100,
      x: 0,
      y: 0,
      fill: "#eef2ff",
      stroke: "#4f46e5",
    });
    const node = super.create();
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");

    node.dataset.type = data.type || "rectangle";
    node.dataset.width = String(data.width || 160);
    node.dataset.height = String(data.height || 100);
    node.dataset.x = String(data.x || 0);
    node.dataset.y = String(data.y || 0);
    node.dataset.fill = data.fill || "#eef2ff";
    node.dataset.stroke = data.stroke || "#4f46e5";

    svg.classList.add("ql-shape-svg");
    svg.style.display = "block";
    svg.style.pointerEvents = "none";
    node.appendChild(svg);

    const updateShape = (width, height) => {
      renderShapeSvg(svg, node.dataset.type, width, height, node.dataset.fill, node.dataset.stroke);
    };

    attachObjectControls(node, svg, updateShape);
    return node;
  }

  static value(domNode) {
    return {
      type: domNode.dataset.type || "rectangle",
      width: Number(domNode.dataset.width || 160),
      height: Number(domNode.dataset.height || 100),
      x: Number(domNode.dataset.x || 0),
      y: Number(domNode.dataset.y || 0),
      fill: domNode.dataset.fill || "#eef2ff",
      stroke: domNode.dataset.stroke || "#4f46e5",
    };
  }
}

class TextBoxBlot extends BlockEmbed {
  static blotName = "text-box";
  static tagName = "div";
  static className = "ql-text-box-wrapper";

  static create(value) {
    const data = normalizeTextBoxValue(value);
    const node = super.create();
    const handle = document.createElement("div");
    const editable = document.createElement("div");

    handle.dataset.textBoxHandle = "true";
    editable.dataset.textBoxContent = "true";
    node.dataset.html = data.html || TEXT_BOX_DEFAULTS.html;
    node.dataset.left = String(data.left ?? TEXT_BOX_DEFAULTS.left);
    node.dataset.top = String(data.top ?? TEXT_BOX_DEFAULTS.top);
    node.dataset.width = String(data.width ?? TEXT_BOX_DEFAULTS.width);
    node.dataset.height = String(data.height ?? TEXT_BOX_DEFAULTS.height);

    editable.innerHTML = data.html || TEXT_BOX_DEFAULTS.html;
    node.appendChild(handle);
    node.appendChild(editable);

    attachTextBoxControls(node);
    return node;
  }

  static value(domNode) {
    const editable = domNode.querySelector("[data-text-box-content]");
    return {
      html: editable?.innerHTML || domNode.dataset.html || TEXT_BOX_DEFAULTS.html,
      left: Number(domNode.dataset.left || Number.parseFloat(domNode.style.left) || TEXT_BOX_DEFAULTS.left),
      top: Number(domNode.dataset.top || Number.parseFloat(domNode.style.top) || TEXT_BOX_DEFAULTS.top),
      width: Number(domNode.dataset.width || Number.parseFloat(domNode.style.width) || TEXT_BOX_DEFAULTS.width),
      height: Number(domNode.dataset.height || Number.parseFloat(domNode.style.height) || TEXT_BOX_DEFAULTS.height),
    };
  }
}

const decorateEditorObjects = (root) => {
  if (!root) return;
  root.style.position = "relative";

  root.querySelectorAll(".ql-resizable-video-wrapper").forEach((node) => {
    if (node.dataset.decorated === "true") return;
    const video = node.querySelector("video");
    if (!video) return;
    node.dataset.width ||= "480";
    node.dataset.height ||= "280";
    node.dataset.x ||= "0";
    node.dataset.y ||= "0";
    attachObjectControls(node, video);
  });

  root.querySelectorAll(".ql-shape-embed").forEach((node) => {
    if (node.dataset.decorated === "true") return;
    let svg = node.querySelector("svg");
    if (!svg) {
      svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.classList.add("ql-shape-svg");
      svg.style.display = "block";
      svg.style.pointerEvents = "none";
      node.appendChild(svg);
    }

    node.dataset.type ||= "rectangle";
    node.dataset.width ||= "170";
    node.dataset.height ||= "110";
    node.dataset.x ||= "0";
    node.dataset.y ||= "0";
    node.dataset.fill ||= "#eef2ff";
    node.dataset.stroke ||= "#4f46e5";

    const updateShape = (width, height) => {
      renderShapeSvg(svg, node.dataset.type, width, height, node.dataset.fill, node.dataset.stroke);
    };

    attachObjectControls(node, svg, updateShape);
  });

  root.querySelectorAll(".ql-text-box-wrapper").forEach((node) => {
    attachTextBoxControls(node);
  });
};

const Font = Quill.import("attributors/style/font");
Font.whitelist = FONT_OPTIONS.map((font) => font.value).filter(Boolean);
Quill.register(Font, true);

const Size = Quill.import("attributors/style/size");
Size.whitelist = SIZE_OPTIONS;
Quill.register(Size, true);

Quill.register(ResizableImageBlot, true);
Quill.register(VideoBlot, true);
Quill.register(ShapeBlot, true);
Quill.register(TextBoxBlot, true);

const modules = {
  toolbar: false,
  history: { delay: 500, maxStack: 100, userOnly: true },
};

const formats = [
  "font",
  "size",
  "header",
  "bold",
  "italic",
  "underline",
  "strike",
  "color",
  "background",
  "align",
  "list",
  "blockquote",
  "code-block",
  "link",
  "image",
  "custom-video",
  "shape",
  "text-box",
];

const safeGetEditor = (quillRef) => {
  try {
    return quillRef.current?.getEditor?.() || null;
  } catch {
    return null;
  }
};

const isObjectDeleteTypingTarget = (target, quillRoot) => {
  if (!target?.closest) return false;
  if (target.closest("[data-text-box-content]")) return true;
  if (target.closest("input, textarea, select, button")) return true;

  const editable = target.closest("[contenteditable='true']");
  return Boolean(editable && editable !== quillRoot);
};

const deleteSelectedEditorObject = (quill) => {
  const selectedObject = quill?.root?.querySelector(".ql-editor-object.is-selected");
  if (!selectedObject) return false;

  const blot = Quill.find(selectedObject);
  if (blot) {
    const index = quill.getIndex(blot);
    quill.deleteText(index, 1, "user");
    quill.setSelection(Math.max(index - 1, 0), 0, "silent");
  } else {
    selectedObject.remove();
    quill.update("user");
    emitEditorObjectChange();
  }

  return true;
};

const formatFileSize = (bytes) => {
  if (!bytes) return "0 MB";
  return `${(bytes / (1024 * 1024)).toFixed(bytes >= 1024 * 1024 ? 1 : 2)} MB`;
};

const getVersionPreview = (content) => {
  if (!content) return "Empty document";

  if (typeof content === "string") {
    return content.replace(/\s+/g, " ").trim().slice(0, 140) || "Empty document";
  }

  if (!Array.isArray(content.ops)) return "Rich document content";

  const preview = content.ops
    .map((op) => {
      if (typeof op.insert === "string") return op.insert;
      if (op.insert?.image) return "[image]";
      if (op.insert?.["custom-video"]) return "[video]";
      if (op.insert?.shape) return "[shape]";
      if (op.insert?.["text-box"]) return "[text box]";
      return "[object]";
    })
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  return preview.slice(0, 140) || "Empty document";
};

const getVersionContentSignature = (content) => {
  try {
    return JSON.stringify(content ?? null);
  } catch {
    return String(content ?? "");
  }
};

const dedupeVersions = (versionList) => {
  if (!Array.isArray(versionList)) return [];

  const uniqueVersions = [];
  let previousSignature = null;

  versionList.forEach((version) => {
    const signature = getVersionContentSignature(version.content);
    if (signature === previousSignature) return;

    uniqueVersions.push(version);
    previousSignature = signature;
  });

  return uniqueVersions;
};

const applyRestoredContent = (quill, content) => {
  if (!content) {
    quill.setContents({ ops: [] }, "user");
    return;
  }

  if (typeof content === "string") {
    quill.setText(content, "user");
    return;
  }

  if (content.ops) {
    quill.setContents(content, "user");
    return;
  }

  quill.setContents({ ops: [] }, "user");
};

const setEditorContent = (quill, content) => {
  if (!content) {
    quill.setContents({ ops: [] }, "silent");
    return;
  }

  if (typeof content === "string") {
    quill.setText(content, "silent");
    return;
  }

  if (content.ops) {
    quill.setContents(content, "silent");
    return;
  }

  quill.setContents({ ops: [] }, "silent");
};

const ToolbarButton = ({ icon: Icon, label, active, className = "", ...props }) => (
  <button
    type="button"
    title={label}
    aria-label={label}
    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-700 transition hover:bg-indigo-50 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-40 ${
      active ? "bg-indigo-100 text-indigo-700 shadow-sm" : "bg-transparent"
    } ${className}`}
    {...props}
  >
    <Icon size={17} strokeWidth={2.2} aria-hidden="true" />
  </button>
);

const ToolbarSeparator = () => <span className="mx-1 h-6 w-px shrink-0 bg-slate-200" />;

const EditorPage = () => {
  const { id: documentId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const quillRef = useRef(null);
  const imageInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const saveTimeoutRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const hasLoadedRef = useRef(false);

  const [socket, setSocket] = useState(null);
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [isDocumentLoaded, setIsDocumentLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [saveStatus, setSaveStatus] = useState("Loading");
  const [isSaving, setIsSaving] = useState(false);
  const [documentTitle, setDocumentTitle] = useState("Untitled Document");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState("");
  const [activeUsers, setActiveUsers] = useState([]);
  const [typingUser, setTypingUser] = useState("");
  const [currentFormat, setCurrentFormat] = useState({});

  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [collaboratorEmail, setCollaboratorEmail] = useState("");
  const [shareMessage, setShareMessage] = useState("");
  const [shareLoading, setShareLoading] = useState(false);
  const [copyMessage, setCopyMessage] = useState("");
  const [collaboratorsList, setCollaboratorsList] = useState([]);

  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [linkText, setLinkText] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkError, setLinkError] = useState("");
  const [linkRange, setLinkRange] = useState(null);
  const [mediaMessage, setMediaMessage] = useState("");

  const [isVersionModalOpen, setIsVersionModalOpen] = useState(false);
  const [versions, setVersions] = useState([]);
  const [versionLoading, setVersionLoading] = useState(false);
  const [versionMessage, setVersionMessage] = useState("");
  const [versionToRestore, setVersionToRestore] = useState(null);

  const currentDocumentUrl = useMemo(() => window.location.href, []);

  const updateCurrentFormat = useCallback(() => {
    const quill = safeGetEditor(quillRef);
    if (!quill) return;
    const range = quill.getSelection();
    setCurrentFormat(range ? quill.getFormat(range) : {});
  }, []);

  const saveDocument = useCallback(
    async ({ quiet = false } = {}) => {
      const quill = safeGetEditor(quillRef);
      if (!quill || !documentId || !isDocumentLoaded) return;

      try {
        setIsSaving(true);
        if (!quiet) setSaveStatus("Saving");
        const content = quill.getContents();

        if (socket?.connected) {
          socket.emit("save-document", { documentId, content });
        }

        await axiosInstance.put(`/documents/${documentId}`, { content });
        setSaveStatus("Saved");
      } catch (error) {
        console.error("Document save failed:", error);
        setSaveStatus("Save failed");
      } finally {
        setIsSaving(false);
      }
    },
    [documentId, isDocumentLoaded, socket]
  );

  useEffect(() => {
    const socketInstance = io(BACKEND_URL, {
      withCredentials: true,
      transports: ["websocket", "polling"],
    });

    setSocket(socketInstance);

    const handleConnect = () => setIsSocketConnected(true);
    const handleDisconnect = () => setIsSocketConnected(false);

    socketInstance.on("connect", handleConnect);
    socketInstance.on("disconnect", handleDisconnect);

    return () => {
      socketInstance.off("connect", handleConnect);
      socketInstance.off("disconnect", handleDisconnect);
      socketInstance.disconnect();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const waitForEditor = () =>
      new Promise((resolve) => {
        const check = () => {
          const quill = safeGetEditor(quillRef);
          if (quill || cancelled) {
            resolve(quill);
            return;
          }
          window.setTimeout(check, 50);
        };
        check();
      });

    const loadDocument = async () => {
      setIsDocumentLoaded(false);
      setLoadError("");
      setSaveStatus("Loading");

      const quill = await waitForEditor();
      if (!quill || cancelled) return;

      quill.enable(false);

      try {
        const response = await axiosInstance.get(`/documents/${documentId}`);
        if (cancelled) return;

        const document = response.data.document;
        setDocumentTitle(document?.title || "Untitled Document");
        setEditorContent(quill, document?.content);
        window.requestAnimationFrame(() => decorateEditorObjects(quill.root));
        quill.history.clear();
        quill.enable(true);
        hasLoadedRef.current = true;
        setIsDocumentLoaded(true);
        setSaveStatus("Saved");
      } catch (error) {
        console.error("Document load failed:", error);
        if (cancelled) return;
        quill.enable(false);
        const status = error.response?.status;
        if (status === 403) setLoadError("You are not authorized to open this document.");
        else if (status === 404) setLoadError("Document not found.");
        else setLoadError("Unable to load this document. Check that the backend is running.");
        setSaveStatus("Load failed");
      }
    };

    loadDocument();

    return () => {
      cancelled = true;
      hasLoadedRef.current = false;
    };
  }, [documentId]);

  useEffect(() => {
    if (!socket || !documentId) return;

    socket.emit("join-document", documentId);

    const handleLoadDocument = (document) => {
      const quill = safeGetEditor(quillRef);
      if (!quill || hasLoadedRef.current) return;

      setDocumentTitle(document?.title || "Untitled Document");
      setEditorContent(quill, document?.content);
      window.requestAnimationFrame(() => decorateEditorObjects(quill.root));
      quill.history.clear();
      quill.enable(true);
      hasLoadedRef.current = true;
      setIsDocumentLoaded(true);
      setSaveStatus("Saved");
    };

    const handleReceiveChanges = (delta) => {
      const quill = safeGetEditor(quillRef);
      if (!quill) return;
      quill.updateContents(delta, "silent");
      window.requestAnimationFrame(() => decorateEditorObjects(quill.root));
    };

    const handleActiveUsers = (users = []) => {
      setActiveUsers(Array.isArray(users) ? users : []);
    };

    const handleTyping = (payload) => {
      const username = typeof payload === "string" ? payload : payload?.username;
      if (!username || username === user?.username) return;
      setTypingUser(username);
    };

    const handleStopTyping = (payload) => {
      const username = typeof payload === "string" ? payload : payload?.username;
      if (!username || username === user?.username) return;
      setTypingUser("");
    };

    const handleDocumentNotFound = () => setLoadError("Document not found.");
    const handleNotAuthorized = () => setLoadError("You are not authorized to open this document.");

    socket.on("load-document", handleLoadDocument);
    socket.on("receive-changes", handleReceiveChanges);
    socket.on("active-users", handleActiveUsers);
    socket.on("typing", handleTyping);
    socket.on("user-typing", handleTyping);
    socket.on("stop-typing", handleStopTyping);
    socket.on("user-stop-typing", handleStopTyping);
    socket.on("document-not-found", handleDocumentNotFound);
    socket.on("not-authorized", handleNotAuthorized);

    return () => {
      socket.off("load-document", handleLoadDocument);
      socket.off("receive-changes", handleReceiveChanges);
      socket.off("active-users", handleActiveUsers);
      socket.off("typing", handleTyping);
      socket.off("user-typing", handleTyping);
      socket.off("stop-typing", handleStopTyping);
      socket.off("user-stop-typing", handleStopTyping);
      socket.off("document-not-found", handleDocumentNotFound);
      socket.off("not-authorized", handleNotAuthorized);
    };
  }, [documentId, socket, user?.username]);

  useEffect(() => {
    if (!isDocumentLoaded) return undefined;

    const quill = safeGetEditor(quillRef);
    if (!quill) return undefined;

    const handleTextChange = (delta, _oldDelta, source) => {
      updateCurrentFormat();
      if (source !== "user") return;

      setSaveStatus("Unsaved");
      socket?.emit("send-changes", delta, documentId);
      socket?.emit("typing", { documentId, username: user?.username || "Someone" });

      window.clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = window.setTimeout(() => {
        socket?.emit("stop-typing", { documentId, username: user?.username || "Someone" });
      }, 900);

      window.clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = window.setTimeout(() => {
        saveDocument({ quiet: true });
      }, 1200);
    };

    const handleSelectionChange = () => updateCurrentFormat();
    const handleBlur = () => saveDocument({ quiet: true });
    const handleObjectDeleteKeyDown = (event) => {
      if (!["Backspace", "Delete"].includes(event.key)) return;
      if (isObjectDeleteTypingTarget(event.target, quill.root)) return;

      if (deleteSelectedEditorObject(quill)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    const handleLinkClick = (event) => {
      const link = event.target.closest?.("a[href]");
      if (!link || !quill.root.contains(link)) return;

      event.preventDefault();
      event.stopPropagation();

      const href = new URL(link.getAttribute("href"), window.location.href).href;
      const openedWindow = window.open(href, "_blank", "noopener,noreferrer");
      if (!openedWindow) {
        window.location.href = href;
      }
    };

    quill.on("text-change", handleTextChange);
    quill.on("selection-change", handleSelectionChange);
    quill.root.addEventListener("blur", handleBlur);
    quill.root.addEventListener("click", handleLinkClick, true);
    document.addEventListener("keydown", handleObjectDeleteKeyDown);

    return () => {
      window.clearTimeout(saveTimeoutRef.current);
      window.clearTimeout(typingTimeoutRef.current);
      quill.off("text-change", handleTextChange);
      quill.off("selection-change", handleSelectionChange);
      quill.root.removeEventListener("blur", handleBlur);
      quill.root.removeEventListener("click", handleLinkClick, true);
      document.removeEventListener("keydown", handleObjectDeleteKeyDown);
    };
  }, [documentId, isDocumentLoaded, saveDocument, socket, updateCurrentFormat, user?.username]);

  useEffect(() => {
    const handleObjectChange = () => {
      const quill = safeGetEditor(quillRef);
      quill?.update("silent");
      setSaveStatus("Unsaved");
      window.clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = window.setTimeout(() => saveDocument({ quiet: true }), 800);
    };

    const handleDocumentClick = (event) => {
      if (!event.target.closest?.(".ql-editor-object")) {
        document.querySelectorAll(".ql-editor-object.is-selected").forEach((node) => node.classList.remove("is-selected"));
      }
    };

    window.addEventListener("editor-object-change", handleObjectChange);
    document.addEventListener("click", handleDocumentClick);

    return () => {
      window.removeEventListener("editor-object-change", handleObjectChange);
      document.removeEventListener("click", handleDocumentClick);
    };
  }, [saveDocument]);

  const applyFormatting = useCallback((format, value) => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return;
    quill.focus();
    quill.format(format, value || false, "user");
    updateCurrentFormat();
  }, [updateCurrentFormat]);

  const handleUndo = () => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return;
    quill.history.undo();
  };

  const handleRedo = () => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return;
    quill.history.redo();
  };

  const handleManualSave = () => {
    saveDocument();
  };

  const handleAlign = (value) => {
    applyFormatting("align", value === "left" ? false : value);
  };

  const handleList = (value) => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return;
    const isActive = quill.getFormat().list === value;
    quill.format("list", isActive ? false : value, "user");
    updateCurrentFormat();
  };

  const handleFontChange = (value) => {
    applyFormatting("font", value);
  };

  const handleSizeChange = (value) => {
    applyFormatting("size", value);
  };

  const handleHeaderChange = (value) => {
    applyFormatting("header", value ? Number(value) : false);
  };

  const handleClearFormatting = () => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return;

    const range = quill.getSelection(true);
    if (!range) return;

    if (range.length > 0) {
      quill.removeFormat(range.index, range.length, "user");
    } else {
      const [line, offset] = quill.getLine(range.index);
      const lineIndex = quill.getIndex(line);
      quill.removeFormat(lineIndex, Math.max(line.length() - offset, 1), "user");
    }

    updateCurrentFormat();
  };

  const openLinkModal = () => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return;

    const range = quill.getSelection(true);
    const selectedText = range?.length ? quill.getText(range.index, range.length) : "";

    setLinkRange(range);
    setLinkText(selectedText.trim());
    setLinkUrl("");
    setLinkError("");
    setIsLinkModalOpen(true);
  };

  const handleInsertLink = () => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return;

    const text = linkText.trim();
    const rawUrl = linkUrl.trim();
    if (!text) {
      setLinkError("Enter the text to display.");
      return;
    }
    if (!rawUrl) {
      setLinkError("Enter a URL.");
      return;
    }

    const url = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
    const range = linkRange || quill.getSelection(true) || { index: quill.getLength() - 1, length: 0 };
    const index = range.index;

    quill.focus();
    if (range.length > 0) {
      quill.deleteText(index, range.length, "user");
    }
    quill.insertText(index, text, "link", url, "user");
    quill.setSelection(index + text.length, 0, "silent");

    setIsLinkModalOpen(false);
    setLinkText("");
    setLinkUrl("");
    setLinkError("");
    setLinkRange(null);
  };

  const handleInsertImageUpload = (event) => {
    const quill = quillRef.current?.getEditor();
    const file = event.target.files?.[0];
    if (!quill || !file) return;
    setMediaMessage("");

    if (file.size > MAX_IMAGE_SIZE) {
      setMediaMessage(`Image is too large (${formatFileSize(file.size)}). Please choose an image under ${formatFileSize(MAX_IMAGE_SIZE)}.`);
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const range = quill.getSelection(true);
      const index = range ? range.index : Math.max(quill.getLength() - 1, 0);
      quill.insertEmbed(index, "image", event.target.result, "user");
      quill.insertText(index + 1, "\n", "user");
      quill.setSelection(index + 2, 0, "silent");
      saveDocument({ quiet: true });
    };
    reader.onerror = () => {
      setMediaMessage("Unable to read this image. Please try another file.");
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const handleInsertVideoUpload = (event) => {
    const quill = quillRef.current?.getEditor();
    const file = event.target.files?.[0];
    if (!quill || !file) return;
    setMediaMessage("");

    if (file.size > MAX_VIDEO_SIZE) {
      setMediaMessage(`Video is too large (${formatFileSize(file.size)}). Please choose a video under ${formatFileSize(MAX_VIDEO_SIZE)}.`);
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      const range = quill.getSelection(true);
      const index = range ? range.index : Math.max(quill.getLength() - 1, 0);
      quill.clipboard.dangerouslyPasteHTML(index, getVideoHtml(readerEvent.target.result), "user");
      quill.setSelection(index + 2, 0, "silent");
      window.requestAnimationFrame(() => decorateEditorObjects(quill.root));
      saveDocument({ quiet: true });
    };
    reader.onerror = () => {
      setMediaMessage("Unable to read this video. Please try another file.");
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const handleShapeInsert = (shapeType) => {
    const quill = quillRef.current?.getEditor();
    if (!quill || !shapeType) return;

    const range = quill.getSelection(true);
    const index = range ? range.index : Math.max(quill.getLength() - 1, 0);
    quill.clipboard.dangerouslyPasteHTML(index, getShapeHtml(shapeType), "user");
    quill.setSelection(index + 2, 0, "silent");
    window.requestAnimationFrame(() => decorateEditorObjects(quill.root));
    saveDocument({ quiet: true });
  };

  const handleInsertTextBox = () => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return;

    quill.focus();
    const range = quill.getSelection(true);
    const index = range ? range.index : Math.max(quill.getLength() - 1, 0);
    const bounds = quill.getBounds(index);
    const maxLeft = Math.max(quill.root.clientWidth - TEXT_BOX_DEFAULTS.width - 24, 24);
    const left = clamp(bounds?.left || TEXT_BOX_DEFAULTS.left, 24, maxLeft);
    const top = Math.max((bounds?.top || 48) + (bounds?.height || 24) + 12, 32);

    if (range?.length > 0) {
      quill.deleteText(index, range.length, "user");
    }

    quill.insertEmbed(
      index,
      "text-box",
      {
        ...TEXT_BOX_DEFAULTS,
        left,
        top,
      },
      "user"
    );
    quill.insertText(index + 1, "\n", "user");
    quill.setSelection(index + 2, 0, "silent");

    window.requestAnimationFrame(() => {
      decorateEditorObjects(quill.root);
      const textBoxes = quill.root.querySelectorAll(".ql-text-box-wrapper");
      const latestBox = textBoxes[textBoxes.length - 1];
      latestBox?.classList.add("is-selected");
      latestBox?.querySelector("[data-text-box-content]")?.focus();
    });
    saveDocument({ quiet: true });
  };

  const openVersionHistory = async () => {
    setIsVersionModalOpen(true);
    setVersionMessage("");
    setVersionToRestore(null);

    try {
      setVersionLoading(true);
      const data = await getVersions(documentId);
      setVersions(dedupeVersions(data));
    } catch (error) {
      setVersionMessage(error.response?.data?.message || "Unable to load version history.");
    } finally {
      setVersionLoading(false);
    }
  };

  const closeVersionHistory = () => {
    setIsVersionModalOpen(false);
    setVersionMessage("");
    setVersionToRestore(null);
  };

  const handleRestoreVersion = async () => {
    if (!versionToRestore) return;

    const quill = quillRef.current?.getEditor();
    if (!quill) return;

    try {
      setVersionLoading(true);
      setVersionMessage("");
      const response = await restoreVersion(versionToRestore._id);
      const restoredContent = response.document?.content || versionToRestore.content;

      quill.focus();
      applyRestoredContent(quill, restoredContent);
      window.requestAnimationFrame(() => decorateEditorObjects(quill.root));
      quill.history.clear();
      setSaveStatus("Saved");
      setVersionMessage(response.message || "Version restored.");
      setVersionToRestore(null);

      const data = await getVersions(documentId);
      setVersions(dedupeVersions(data));
    } catch (error) {
      setVersionMessage(error.response?.data?.message || "Failed to restore this version.");
    } finally {
      setVersionLoading(false);
    }
  };

  const handleTitleSubmit = async () => {
    const nextTitle = titleInput.trim() || "Untitled Document";
    if (nextTitle === documentTitle) {
      setIsEditingTitle(false);
      return;
    }

    try {
      await renameDocument(documentId, nextTitle);
      setDocumentTitle(nextTitle);
    } catch (error) {
      console.error("Failed to rename document:", error);
    } finally {
      setIsEditingTitle(false);
    }
  };

  const openShareModal = async () => {
    setIsShareModalOpen(true);
    setShareMessage("");
    setCopyMessage("");

    try {
      const data = await getCollaborators(documentId);
      setCollaboratorsList(data.collaborators || []);
    } catch (error) {
      console.error("Failed to load collaborators:", error);
    }
  };

  const closeShareModal = () => {
    setIsShareModalOpen(false);
    setCollaboratorEmail("");
    setShareMessage("");
    setCopyMessage("");
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopyMessage("Link copied");
      window.setTimeout(() => setCopyMessage(""), 2200);
    } catch {
      setCopyMessage("Copy failed");
    }
  };

  const handleAddCollaborator = async () => {
    if (!collaboratorEmail.trim()) {
      setShareMessage("Enter an email address.");
      return;
    }

    try {
      setShareLoading(true);
      setShareMessage("");
      const response = await addCollaborator(documentId, collaboratorEmail.trim());
      setShareMessage(response.message || "Invitation sent.");
      setCollaboratorEmail("");
      const data = await getCollaborators(documentId);
      setCollaboratorsList(data.collaborators || []);
    } catch (error) {
      setShareMessage(error.response?.data?.message || "Unable to add collaborator.");
    } finally {
      setShareLoading(false);
    }
  };

  const renderActiveUserName = (activeUser) => {
    if (typeof activeUser === "string") return activeUser;
    return activeUser?.username || activeUser?.email || "Collaborator";
  };

  const formatVersionDate = (dateValue) => {
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return "Unknown date";
    return date.toLocaleString([], {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const saveStatusLabel = isSaving ? "Saving..." : saveStatus;
  const alignmentButtons = [
    { value: "left", label: "Align left", icon: AlignLeft },
    { value: "center", label: "Align center", icon: AlignCenter },
    { value: "right", label: "Align right", icon: AlignRight },
    { value: "justify", label: "Align justify", icon: AlignJustify },
  ];

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-100 text-slate-900">
      <header className="z-30 flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-3 py-2.5 shadow-sm backdrop-blur sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
            title="Back"
          >
            <span className="text-2xl leading-none">&lsaquo;</span>
          </button>

          <div className="min-w-0">
            {isEditingTitle ? (
              <input
                autoFocus
                value={titleInput}
                onChange={(event) => setTitleInput(event.target.value)}
                onBlur={handleTitleSubmit}
                onKeyDown={(event) => {
                  if (event.key === "Enter") handleTitleSubmit();
                  if (event.key === "Escape") setIsEditingTitle(false);
                }}
                className="w-52 rounded-lg border border-indigo-300 px-2 py-1 text-lg font-semibold outline-none ring-4 ring-indigo-100 sm:w-80"
              />
            ) : (
              <button
                type="button"
                onClick={() => {
                  setTitleInput(documentTitle);
                  setIsEditingTitle(true);
                }}
                className="block max-w-[46vw] truncate rounded-lg px-2 py-1 text-left text-lg font-bold text-slate-950 transition hover:bg-slate-100 sm:max-w-md"
                title={documentTitle}
              >
                {documentTitle}
              </button>
            )}

            <div className="flex flex-wrap items-center gap-2 px-2 text-xs">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-semibold ${saveStatusLabel === "Saved" ? "bg-emerald-50 text-emerald-700" : "bg-indigo-50 text-indigo-700"}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${isSocketConnected ? "bg-emerald-500" : "bg-amber-500"}`} />
                {saveStatusLabel}
              </span>
              {typingUser && <span className="hidden font-semibold text-indigo-700 sm:inline">{typingUser} is typing...</span>}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <div className="hidden items-center gap-1 md:flex">
            {activeUsers.slice(0, 3).map((activeUser, index) => (
              <span key={`${renderActiveUserName(activeUser)}-${index}`} className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700 ring-2 ring-white">
                {renderActiveUserName(activeUser).slice(0, 1).toUpperCase()}
              </span>
            ))}
            <span className="ml-1 text-xs font-semibold text-slate-500">
              {activeUsers.length > 0 ? `${activeUsers.length} online` : "Solo editing"}
            </span>
          </div>
          <button
            type="button"
            onClick={openVersionHistory}
            disabled={!isDocumentLoaded}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <History size={16} strokeWidth={2.2} aria-hidden="true" />
            <span className="hidden sm:inline">Versions</span>
          </button>
          <button
            type="button"
            onClick={openShareModal}
            className="rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-500/25 transition hover:from-indigo-700 hover:to-purple-700"
          >
            Share
          </button>
        </div>
      </header>

      <div className="sticky top-0 z-20 shrink-0 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="flex flex-nowrap items-center justify-start gap-1 overflow-x-auto px-3 py-2 xl:justify-center">
          <ToolbarButton icon={Undo2} label="Undo" onClick={handleUndo} disabled={!isDocumentLoaded} />
          <ToolbarButton icon={Redo2} label="Redo" onClick={handleRedo} disabled={!isDocumentLoaded} />
          <ToolbarButton icon={Save} label="Save" onClick={handleManualSave} disabled={!isDocumentLoaded} />

          <ToolbarSeparator />

          <select
            className="h-8 shrink-0 rounded-lg border border-slate-200 bg-white px-2 text-sm font-medium outline-none transition hover:border-indigo-200 hover:bg-indigo-50 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            value={currentFormat.header || ""}
            onChange={(event) => handleHeaderChange(event.target.value)}
            disabled={!isDocumentLoaded}
            title="Paragraph style"
          >
            <option value="">Normal text</option>
            <option value="1">Heading 1</option>
            <option value="2">Heading 2</option>
            <option value="3">Heading 3</option>
          </select>

          <select
            className="h-8 shrink-0 rounded-lg border border-slate-200 bg-white px-2 text-sm font-medium outline-none transition hover:border-indigo-200 hover:bg-indigo-50 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            value={currentFormat.font || ""}
            onChange={(event) => handleFontChange(event.target.value)}
            disabled={!isDocumentLoaded}
            title="Font family"
          >
            {FONT_OPTIONS.map((font) => (
              <option key={font.value || "default"} value={font.value}>
                {font.label}
              </option>
            ))}
          </select>

          <select
            className="h-8 shrink-0 rounded-lg border border-slate-200 bg-white px-2 text-sm font-medium outline-none transition hover:border-indigo-200 hover:bg-indigo-50 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            value={currentFormat.size || "16px"}
            onChange={(event) => handleSizeChange(event.target.value)}
            disabled={!isDocumentLoaded}
            title="Font size"
          >
            {SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>

          <ToolbarSeparator />

          <ToolbarButton icon={Bold} label="Bold" active={currentFormat.bold} onClick={() => applyFormatting("bold", !currentFormat.bold)} disabled={!isDocumentLoaded} />
          <ToolbarButton icon={Italic} label="Italic" active={currentFormat.italic} onClick={() => applyFormatting("italic", !currentFormat.italic)} disabled={!isDocumentLoaded} />
          <ToolbarButton icon={Underline} label="Underline" active={currentFormat.underline} onClick={() => applyFormatting("underline", !currentFormat.underline)} disabled={!isDocumentLoaded} />
          <ToolbarButton icon={Strikethrough} label="Strikethrough" active={currentFormat.strike} onClick={() => applyFormatting("strike", !currentFormat.strike)} disabled={!isDocumentLoaded} />

          <label className="relative flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-slate-700 transition hover:bg-indigo-50 hover:text-indigo-700 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-40" title="Text color" aria-label="Text color">
            <Type size={17} strokeWidth={2.2} aria-hidden="true" />
            <span className="absolute bottom-1 h-0.5 w-4 rounded-full" style={{ backgroundColor: currentFormat.color || "#111827" }} />
            <input
              type="color"
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              value={currentFormat.color || "#111827"}
              onChange={(event) => applyFormatting("color", event.target.value)}
              disabled={!isDocumentLoaded}
            />
          </label>
          <label className="relative flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-slate-700 transition hover:bg-indigo-50 hover:text-indigo-700 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-40" title="Highlight color" aria-label="Highlight color">
            <PaintBucket size={17} strokeWidth={2.2} aria-hidden="true" />
            <span className="absolute bottom-1 h-0.5 w-4 rounded-full" style={{ backgroundColor: currentFormat.background || "#fef3c7" }} />
            <input
              type="color"
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              value={currentFormat.background || "#ffffff"}
              onChange={(event) => applyFormatting("background", event.target.value)}
              disabled={!isDocumentLoaded}
            />
          </label>

          <ToolbarSeparator />

          {alignmentButtons.map(({ value, label, icon }) => (
            <ToolbarButton
              key={value}
              icon={icon}
              label={label}
              active={(currentFormat.align || "left") === value}
              onClick={() => handleAlign(value)}
              disabled={!isDocumentLoaded}
            />
          ))}

          <ToolbarSeparator />

          <ToolbarButton icon={ListOrdered} label="Ordered list" active={currentFormat.list === "ordered"} onClick={() => handleList("ordered")} disabled={!isDocumentLoaded} />
          <ToolbarButton icon={List} label="Bullet list" active={currentFormat.list === "bullet"} onClick={() => handleList("bullet")} disabled={!isDocumentLoaded} />

          <ToolbarSeparator />

          <ToolbarButton icon={LinkIcon} label="Insert link" onClick={openLinkModal} disabled={!isDocumentLoaded} />
          <ToolbarButton icon={ImageIcon} label="Insert image" onClick={() => imageInputRef.current?.click()} disabled={!isDocumentLoaded} />
          <ToolbarButton icon={VideoIcon} label="Insert video" onClick={() => videoInputRef.current?.click()} disabled={!isDocumentLoaded} />
          <ToolbarButton icon={TextCursorInput} label="Insert text box" onClick={handleInsertTextBox} disabled={!isDocumentLoaded} />

          <label className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 text-sm font-medium text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700" title="Insert shape">
            <Shapes size={17} strokeWidth={2.2} aria-hidden="true" />
            <select
              className="h-full max-w-[92px] bg-transparent text-sm font-medium outline-none"
              value=""
              onChange={(event) => {
                handleShapeInsert(event.target.value);
                event.target.value = "";
              }}
              disabled={!isDocumentLoaded}
              title="Insert shape"
            >
              <option value="">Shapes</option>
              {SHAPE_OPTIONS.map((shape) => (
                <option key={shape.value} value={shape.value}>
                  {shape.label}
                </option>
              ))}
            </select>
          </label>

          <ToolbarSeparator />

          <ToolbarButton icon={Eraser} label="Clear formatting" onClick={handleClearFormatting} disabled={!isDocumentLoaded} />
        </div>
      </div>

      <input ref={imageInputRef} type="file" accept="image/*" onChange={handleInsertImageUpload} className="hidden" />
      <input ref={videoInputRef} type="file" accept="video/*" onChange={handleInsertVideoUpload} className="hidden" />

      <main className="relative flex-1 overflow-auto bg-slate-100 px-3 py-6 sm:px-6">
        {loadError && (
          <div className="mx-auto mb-4 max-w-3xl rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {loadError}
          </div>
        )}
        {mediaMessage && (
          <div className="mx-auto mb-4 flex max-w-3xl items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <span>{mediaMessage}</span>
            <button type="button" onClick={() => setMediaMessage("")} className="rounded-md px-2 py-1 text-xs font-bold text-amber-900 hover:bg-amber-100">
              Dismiss
            </button>
          </div>
        )}

        <div className="mx-auto max-w-[900px]">
          <ReactQuill
            ref={quillRef}
            theme="snow"
            readOnly={!isDocumentLoaded || Boolean(loadError)}
            modules={modules}
            formats={formats}
            placeholder={isDocumentLoaded ? "Start typing your document..." : "Loading document..."}
            className="docs-editor"
          />
        </div>
      </main>

      {isVersionModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeVersionHistory();
          }}
        >
          <div className="flex max-h-[86vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/80 bg-white shadow-2xl shadow-indigo-950/20">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Version history</h2>
                <p className="text-sm text-slate-500">{documentTitle}</p>
              </div>
              <button type="button" onClick={closeVersionHistory} className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100">
                Close
              </button>
            </div>

            {versionMessage && (
              <div className={`mx-5 mt-4 rounded-lg border px-3 py-2 text-sm ${versionMessage.toLowerCase().includes("failed") || versionMessage.toLowerCase().includes("unable") ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
                {versionMessage}
              </div>
            )}

            {versionToRestore && (
              <div className="mx-5 mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-semibold text-amber-900">Restore this version?</p>
                <p className="mt-1 text-sm text-amber-800">
                  This will replace the current editor content with the version from {formatVersionDate(versionToRestore.createdAt)}.
                </p>
                <div className="mt-3 flex justify-end gap-2">
                  <button type="button" onClick={() => setVersionToRestore(null)} className="rounded-lg px-3 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100">
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleRestoreVersion}
                    disabled={versionLoading}
                    className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-bold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {versionLoading ? "Restoring..." : "Restore"}
                  </button>
                </div>
              </div>
            )}

            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              {versionLoading && versions.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-8 text-center text-sm font-medium text-slate-500">
                  Loading saved versions...
                </div>
              ) : versions.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-indigo-200 bg-indigo-50/40 px-5 py-8 text-center">
                  <p className="font-semibold text-slate-800">No saved versions yet</p>
                  <p className="mt-1 text-sm text-slate-500">Versions appear after autosave or manual save creates document snapshots.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {versions.map((version, index) => (
                    <article key={version._id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-indigo-200 hover:shadow-md">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-bold text-slate-950">Version {versions.length - index}</h3>
                            {index === 0 && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 ring-1 ring-emerald-100">Latest</span>}
                          </div>
                          <p className="mt-1 text-sm text-slate-500">{formatVersionDate(version.createdAt)}</p>
                          <p className="mt-1 text-xs font-medium text-slate-500">
                            Edited by {version.editedBy?.username || version.editedBy?.email || "Unknown user"}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setVersionToRestore(version)}
                          disabled={versionLoading}
                          className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-bold text-indigo-700 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Restore
                        </button>
                      </div>
                      <p className="mt-3 line-clamp-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                        {getVersionPreview(version.content)}
                      </p>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {isShareModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeShareModal();
          }}
        >
          <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-white/80 bg-white shadow-2xl shadow-indigo-950/20">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Share document</h2>
                <p className="text-sm text-slate-500">{documentTitle}</p>
              </div>
              <button type="button" onClick={closeShareModal} className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100">
                Close
              </button>
            </div>

            <div className="space-y-5 px-5 py-5">
              <section>
                <label className="mb-2 block text-sm font-medium text-slate-700">Copy link</label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input readOnly value={currentDocumentUrl} className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-600" />
                  <button type="button" onClick={handleCopyLink} className="rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-indigo-500/25 transition hover:from-indigo-700 hover:to-purple-700">
                    Copy Link
                  </button>
                </div>
                {copyMessage && <p className="mt-2 text-sm text-emerald-600">{copyMessage}</p>}
              </section>

              <section>
                <label className="mb-2 block text-sm font-medium text-slate-700">Add collaborator</label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    type="email"
                    value={collaboratorEmail}
                    onChange={(event) => setCollaboratorEmail(event.target.value)}
                    placeholder="name@example.com"
                    className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                  />
                  <button
                    type="button"
                    onClick={handleAddCollaborator}
                    disabled={shareLoading}
                    className="rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-indigo-500/25 transition hover:from-indigo-700 hover:to-purple-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {shareLoading ? "Adding..." : "Add Collaborator"}
                  </button>
                </div>
                {shareMessage && <p className="mt-2 text-sm text-slate-700">{shareMessage}</p>}
              </section>

              <section>
                <h3 className="mb-2 text-sm font-medium text-slate-700">Active collaborators</h3>
                {activeUsers.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {activeUsers.map((activeUser, index) => (
                      <span key={`${renderActiveUserName(activeUser)}-${index}`} className="rounded-full bg-indigo-50 px-3 py-1 text-sm font-medium text-indigo-700 ring-1 ring-indigo-100">
                        {renderActiveUserName(activeUser)}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No active collaborators online</p>
                )}
              </section>

              {collaboratorsList.length > 0 && (
                <section>
                  <h3 className="mb-2 text-sm font-medium text-slate-700">People with access</h3>
                  <div className="max-h-36 space-y-2 overflow-y-auto">
                    {collaboratorsList.map((collaborator) => (
                      <div key={collaborator._id || collaborator.email} className="rounded-lg border border-slate-200 px-3 py-2">
                        <p className="text-sm font-medium text-slate-800">{collaborator.username || collaborator.email}</p>
                        <p className="text-xs text-slate-500">{collaborator.email}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          </div>
        </div>
      )}

      {isLinkModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setIsLinkModalOpen(false);
              setLinkError("");
            }
          }}
        >
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl">
            <h2 className="text-lg font-semibold text-slate-900">Insert link</h2>
            <div className="mt-4 space-y-3">
              <label className="block text-sm font-medium text-slate-700">
                Text
                <input
                  value={linkText}
                  onChange={(event) => setLinkText(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Address
                <input
                  value={linkUrl}
                  onChange={(event) => setLinkUrl(event.target.value)}
                  placeholder="https://example.com"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                />
              </label>
              {linkError && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{linkError}</p>}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsLinkModalOpen(false);
                  setLinkError("");
                }}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button type="button" onClick={handleInsertLink} className="rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-indigo-500/25 transition hover:from-indigo-700 hover:to-purple-700">
                Insert
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EditorPage;
