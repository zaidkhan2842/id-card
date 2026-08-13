import { useEffect, useRef, useState } from 'react';

/* ============ Constants ============ */
const PFP_SIZE = 1080;
const CARD_W = 1080, CARD_H = 1350;
const COLORS = {
  ink: '#0A0E1A', inkSoft: '#121a2c', inkCard: '#161f34',
  sand: '#F4E9D8', coral: '#FF6B47', coral2: '#FF8F5E', gold: '#F5B942', teal: '#1FA98A'
};
const TITLES = [
  "Chief Vibe Officer", "Ship-It Specialist", "Full-Stack Wave Rider", "Debugger of Destiny",
  "Prompt Whisperer", "Founder Mode: Activated", "Certified Late-Night Shipper", "Resident Bug Whisperer",
  "Head of Duct-Tape Engineering", "Professional Scope Creeper", "Chief Caffeine Architect",
  "Builder-in-Residence", "Merge Conflict Survivor", "Sunset Standup Regular", "Build Sprint Finisher",
  "Undefeated Demo Day Champion", "Idea-to-Prod Pipeline Lead", "Beach Break Debugger",
  "Weekend MVP Machine", "Hackathon Tide Rider"
];

/* ============ Pure helpers (mirror the original vanilla JS 1:1) ============ */
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = (h << 5) - h + s.charCodeAt(i); h |= 0; }
  return Math.abs(h);
}

function roundedRectPath(c, x, y, w, h, r) {
  if (typeof r === 'number') r = { tl: r, tr: r, br: r, bl: r };
  c.beginPath();
  c.moveTo(x + r.tl, y);
  c.lineTo(x + w - r.tr, y);
  c.arcTo(x + w, y, x + w, y + r.tr, r.tr);
  c.lineTo(x + w, y + h - r.br);
  c.arcTo(x + w, y + h, x + w - r.br, y + h, r.br);
  c.lineTo(x + r.bl, y + h);
  c.arcTo(x, y + h, x, y + h - r.bl, r.bl);
  c.lineTo(x, y + r.tl);
  c.arcTo(x, y, x + r.tl, y, r.tl);
  c.closePath();
}

function drawArcText(c, text, cx, cy, radius, startAngle, dir, letterSpacing, font, color) {
  c.save();
  c.font = font; c.fillStyle = color; c.textBaseline = 'middle'; c.textAlign = 'center';
  const widths = [];
  let total = 0;
  for (let i = 0; i < text.length; i++) {
    const w = c.measureText(text[i]).width + letterSpacing;
    widths.push(w); total += w;
  }
  const angPerPx = 1 / radius;
  const startA = startAngle - (total / 2) * angPerPx * dir;
  let a = startA;
  for (let j = 0; j < text.length; j++) {
    const half = widths[j] / 2;
    a += half * angPerPx * dir;
    const x = cx + radius * Math.cos(a);
    const y = cy + radius * Math.sin(a);
    c.save();
    c.translate(x, y);
    c.rotate(a + (Math.PI / 2) * dir);
    c.fillText(text[j], 0, 0);
    c.restore();
    a += half * angPerPx * dir;
  }
  c.restore();
}

function paintWaves(ctx, x0, y0, w, h, alpha, color, amp, freq, offset) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x0, y0 + h);
  ctx.lineTo(x0, y0 + h * 0.55);
  for (let x = 0; x <= w; x += 6) {
    const y = y0 + h * 0.55 + Math.sin((x / w) * Math.PI * freq + offset) * amp;
    ctx.lineTo(x0 + x, y);
  }
  ctx.lineTo(x0 + w, y0 + h);
  ctx.closePath();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

function wrapText(c, text, maxWidth) {
  const words = text.split(' ');
  const lines = []; let cur = '';
  for (let i = 0; i < words.length; i++) {
    const test = cur ? cur + ' ' + words[i] : words[i];
    if (c.measureText(test).width > maxWidth && cur) { lines.push(cur); cur = words[i]; }
    else cur = test;
  }
  if (cur) lines.push(cur);
  return lines;
}

/* ============ Photo slot geometry per format ============ */
function getSlot(state) {
  if (state.format === 'pfp') {
    return { shape: 'circle', cx: PFP_SIZE / 2, cy: PFP_SIZE / 2, r: PFP_SIZE / 2, w: PFP_SIZE, h: PFP_SIZE };
  } else {
    const w = 760, h = 760;
    const x = (CARD_W - w) / 2, y = 150;
    return { shape: 'rrect', x, y, w, h, r: 40 };
  }
}

function slotBBox(slot) {
  if (slot.shape === 'circle') return { x: slot.cx - slot.r, y: slot.cy - slot.r, w: slot.r * 2, h: slot.r * 2 };
  return { x: slot.x, y: slot.y, w: slot.w, h: slot.h };
}

function computeBaseScale(state, slot) {
  if (!state.img) return 1;
  const box = slotBBox(slot);
  return Math.max(box.w / state.imgW, box.h / state.imgH);
}

function clampOffsets(state, slot) {
  const box = slotBBox(slot);
  const scale = computeBaseScale(state, slot) * state.zoom;
  const drawW = state.imgW * scale, drawH = state.imgH * scale;
  const maxX = Math.max(0, (drawW - box.w) / 2);
  const maxY = Math.max(0, (drawH - box.h) / 2);
  state.offX = clamp(state.offX, -maxX, maxX);
  state.offY = clamp(state.offY, -maxY, maxY);
}

/* ============ Drawing: shared photo draw ============ */
function drawPhoto(ctx, state, slot) {
  const box = slotBBox(slot);
  const scale = computeBaseScale(state, slot) * state.zoom;
  const drawW = state.imgW * scale, drawH = state.imgH * scale;
  const cx = box.x + box.w / 2 + state.offX;
  const cy = box.y + box.h / 2 + state.offY;

  ctx.save();
  if (slot.shape === 'circle') {
    ctx.beginPath();
    ctx.arc(slot.cx, slot.cy, slot.r, 0, Math.PI * 2);
    ctx.clip();
  } else {
    roundedRectPath(ctx, slot.x, slot.y, slot.w, slot.h, slot.r);
    ctx.clip();
  }
  ctx.drawImage(state.img, cx - drawW / 2, cy - drawH / 2, drawW, drawH);
  ctx.restore();
}

/* ============ FORMAT A: PFP Frame ============ */
function renderPfp(ctx, canvas, state) {
  canvas.width = PFP_SIZE; canvas.height = PFP_SIZE;
  ctx.clearRect(0, 0, PFP_SIZE, PFP_SIZE);

  const bgGrad = ctx.createLinearGradient(0, 0, PFP_SIZE, PFP_SIZE);
  bgGrad.addColorStop(0, '#12213a');
  bgGrad.addColorStop(1, COLORS.ink);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, PFP_SIZE, PFP_SIZE);

  const slot = getSlot(state);

  if (state.img) {
    drawPhoto(ctx, state, slot);
    ctx.save();
    ctx.beginPath(); ctx.arc(slot.cx, slot.cy, slot.r, 0, Math.PI * 2); ctx.clip();
    const edgeShade = ctx.createRadialGradient(slot.cx, slot.cy, slot.r * 0.74, slot.cx, slot.cy, slot.r);
    edgeShade.addColorStop(0, 'rgba(10,14,26,0)');
    edgeShade.addColorStop(1, 'rgba(10,14,26,0.55)');
    ctx.fillStyle = edgeShade;
    ctx.fillRect(slot.cx - slot.r, slot.cy - slot.r, slot.r * 2, slot.r * 2);
    ctx.restore();
  }

  const bandOuter = slot.r * 0.995;
  const bandInner = slot.r * 0.86;
  ctx.save();
  ctx.beginPath();
  ctx.arc(slot.cx, slot.cy, bandOuter, 0, Math.PI * 2);
  ctx.arc(slot.cx, slot.cy, bandInner, 0, Math.PI * 2, true);
  ctx.closePath();
  const ringGrad = ctx.createLinearGradient(slot.cx - slot.r, slot.cy - slot.r, slot.cx + slot.r, slot.cy + slot.r);
  ringGrad.addColorStop(0, COLORS.coral);
  ringGrad.addColorStop(0.55, COLORS.gold);
  ringGrad.addColorStop(1, COLORS.teal);
  ctx.fillStyle = ringGrad;
  ctx.fill('evenodd');
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.arc(slot.cx, slot.cy, slot.r * 0.999, 0, Math.PI * 2);
  ctx.lineWidth = PFP_SIZE * 0.006;
  ctx.strokeStyle = 'rgba(10,14,26,0.55)';
  ctx.stroke();
  ctx.restore();

  drawArcText(ctx, '★ HH GOA 2026 ★ BUILDER ★', slot.cx, slot.cy, (bandOuter + bandInner) / 2,
    Math.PI / 2, 1, 3, '700 30px "Bricolage Grotesque"', 'rgba(10,14,26,0.92)');

  if (!state.img) {
    ctx.save();
    ctx.fillStyle = 'rgba(244,233,216,0.25)';
    ctx.font = '600 26px "JetBrains Mono"';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('YOUR PHOTO', slot.cx, slot.cy - 14);
    ctx.fillText('GOES HERE', slot.cx, slot.cy + 22);
    ctx.restore();
  }
}

/* ============ FORMAT B: Builder Badge ============ */
function renderCard(ctx, canvas, state) {
  canvas.width = CARD_W; canvas.height = CARD_H;
  ctx.clearRect(0, 0, CARD_W, CARD_H);

  const bg = ctx.createLinearGradient(0, 0, CARD_W, CARD_H);
  bg.addColorStop(0, '#101a2f');
  bg.addColorStop(1, COLORS.ink);
  ctx.fillStyle = bg; ctx.fillRect(0, 0, CARD_W, CARD_H);

  const glow = ctx.createRadialGradient(CARD_W * 0.5, 60, 10, CARD_W * 0.5, 60, 620);
  glow.addColorStop(0, 'rgba(255,107,71,0.22)');
  glow.addColorStop(1, 'rgba(255,107,71,0)');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, CARD_W, CARD_H);

  paintWaves(ctx, 0, CARD_H - 330, CARD_W, 330, 0.22, COLORS.teal, 26, 3.2, 0);
  paintWaves(ctx, 0, CARD_H - 280, CARD_W, 280, 0.30, COLORS.teal, 20, 4, 1.4);
  paintWaves(ctx, 0, CARD_H - 190, CARD_W, 190, 0.9, '#0d1830', 16, 5, 2.1);

  roundedRectPath(ctx, 24, 24, CARD_W - 48, CARD_H - 48, 34);
  ctx.strokeStyle = 'rgba(244,233,216,0.14)';
  ctx.lineWidth = 2;
  ctx.stroke();

  const perfY = 108;
  ctx.save();
  ctx.setLineDash([2, 14]);
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(244,233,216,0.28)';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(48, perfY); ctx.lineTo(CARD_W - 48, perfY); ctx.stroke();
  ctx.restore();
  [48, CARD_W - 48].forEach((nx) => {
    ctx.save(); ctx.fillStyle = COLORS.ink; ctx.beginPath();
    ctx.arc(nx, perfY, 16, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  });

  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.coral2;
  ctx.font = '700 26px "JetBrains Mono"';
  ctx.fillText('H A C K E R   H O U S E', CARD_W / 2, 66);
  ctx.fillStyle = COLORS.sand;
  ctx.font = '800 46px "Bricolage Grotesque"';
  ctx.fillText('GOA · 2026', CARD_W / 2, 100 + 2);
  ctx.restore();

  ctx.save();
  const pillW = 260, pillH = 40, pillX = CARD_W / 2 - pillW / 2, pillY = perfY + 26;
  roundedRectPath(ctx, pillX, pillY, pillW, pillH, 999);
  ctx.fillStyle = 'rgba(245,185,66,0.14)';
  ctx.fill();
  ctx.strokeStyle = COLORS.gold; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = COLORS.gold;
  ctx.font = '700 20px "JetBrains Mono"';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('B U I L D E R   B A D G E', CARD_W / 2, pillY + pillH / 2 + 1);
  ctx.restore();

  const slot = getSlot(state);
  ctx.save();
  roundedRectPath(ctx, slot.x - 8, slot.y - 8, slot.w + 16, slot.h + 16, slot.r + 8);
  const frameGrad = ctx.createLinearGradient(slot.x, slot.y, slot.x + slot.w, slot.y + slot.h);
  frameGrad.addColorStop(0, COLORS.coral);
  frameGrad.addColorStop(1, COLORS.gold);
  ctx.fillStyle = frameGrad;
  ctx.fill();
  ctx.restore();

  if (state.img) {
    drawPhoto(ctx, state, slot);
  } else {
    roundedRectPath(ctx, slot.x, slot.y, slot.w, slot.h, slot.r);
    ctx.fillStyle = '#1b2540'; ctx.fill();
    ctx.save();
    ctx.fillStyle = 'rgba(244,233,216,0.3)';
    ctx.font = '600 30px "JetBrains Mono"';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('PHOTO', slot.x + slot.w / 2, slot.y + slot.h / 2);
    ctx.restore();
  }

  roundedRectPath(ctx, slot.x, slot.y, slot.w, slot.h, slot.r);
  ctx.strokeStyle = 'rgba(10,14,26,0.55)'; ctx.lineWidth = 4; ctx.stroke();

  const stampCx = slot.x + slot.w - 40, stampCy = slot.y + slot.h - 10, stampR = 118;
  ctx.save();
  ctx.translate(stampCx, stampCy);
  ctx.rotate(-0.16);
  ctx.beginPath(); ctx.arc(0, 0, stampR, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.ink; ctx.fill();
  ctx.beginPath(); ctx.arc(0, 0, stampR, 0, Math.PI * 2);
  ctx.strokeStyle = COLORS.teal; ctx.lineWidth = 3; ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, stampR - 10, 0, Math.PI * 2);
  ctx.setLineDash([3, 6]);
  ctx.strokeStyle = 'rgba(31,169,138,0.7)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  drawArcText(ctx, '★ ' + state.title.toUpperCase() + ' ★', stampCx, stampCy, stampR - 34, -Math.PI / 2, 1, 2.4,
    '700 17px "JetBrains Mono"', COLORS.sand);
  ctx.save();
  ctx.translate(stampCx, stampCy);
  ctx.rotate(-0.16);
  ctx.fillStyle = COLORS.gold;
  ctx.font = '800 15px "Bricolage Grotesque"';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('TITLE', 0, 4);
  ctx.restore();

  const nameY = slot.y + slot.h + 92;
  ctx.save();
  ctx.textAlign = 'center'; ctx.fillStyle = COLORS.sand;
  const nm = (state.name || 'Your Name').trim();
  const nameFont = nm.length > 18 ? 54 : 64;
  ctx.font = '800 ' + nameFont + 'px "Bricolage Grotesque"';
  ctx.fillText(nm, CARD_W / 2, nameY);
  ctx.restore();

  const roleText = (state.role || 'Stack / Role').trim();
  let parts = roleText.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 3);
  if (parts.length === 0) parts = [roleText];
  ctx.font = '600 22px "JetBrains Mono"';
  const gap = 14, padX = 20, ph = 42;
  const widths = parts.map((p) => ctx.measureText(p.toUpperCase()).width + padX * 2);
  const totalW = widths.reduce((a, b) => a + b, 0) + gap * (parts.length - 1);
  const startX = CARD_W / 2 - totalW / 2;
  const py = nameY + 34;
  let px = startX;
  for (let i = 0; i < parts.length; i++) {
    const w = widths[i];
    roundedRectPath(ctx, px, py, w, ph, 999);
    ctx.fillStyle = 'rgba(31,169,138,0.16)';
    ctx.fill();
    ctx.strokeStyle = COLORS.teal; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = COLORS.teal;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(parts[i].toUpperCase(), px + w / 2, py + ph / 2 + 1);
    px += w + gap;
  }

  ctx.save();
  ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(244,233,216,0.55)';
  ctx.font = '600 20px "JetBrains Mono"';
  ctx.fillText('GOA, INDIA  ·  #FrameInGoa', CARD_W / 2, CARD_H - 56);
  ctx.restore();
}

function render(ctx, canvas, state) {
  if (state.format === 'pfp') renderPfp(ctx, canvas, state);
  else renderCard(ctx, canvas, state);
}

/* ============ Component ============ */
export default function App() {
  const canvasRef = useRef(null);
  const dropzoneRef = useRef(null);
  const fileInputRef = useRef(null);
  const zoomRangeRef = useRef(null);

  // mutable drawing state — mirrors the original module-level `state` object
  const stateRef = useRef({
    format: 'pfp',
    img: null,
    imgW: 0, imgH: 0,
    zoom: 1,
    offX: 0, offY: 0,
    name: '',
    role: '',
    title: TITLES[0]
  });

  // refs used only for drag/pinch bookkeeping (not drawn from directly)
  const draggingRef = useRef(false);
  const lastPosRef = useRef({ x: 0, y: 0 });
  const pinchStartDistRef = useRef(null);
  const pinchStartZoomRef = useRef(1);
  const fontsReadyRef = useRef(false);

  // UI-facing state (things that change the chrome around the canvas)
  const [format, setFormatUi] = useState('pfp');
  const [dragActive, setDragActive] = useState(false);
  const [hasImage, setHasImage] = useState(false);
  const [fileLabel, setFileLabel] = useState('');
  const [loadingText, setLoadingText] = useState('Drop a photo, or tap to upload');
  const [nameVal, setNameVal] = useState('');
  const [roleVal, setRoleVal] = useState('');
  const [titleVal, setTitleVal] = useState(TITLES[0]);
  const [shareNote, setShareNote] = useState('');
  const [isGrabbing, setIsGrabbing] = useState(false);

  const getCtx = () => canvasRef.current.getContext('2d');

  const doRender = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    render(getCtx(), canvas, stateRef.current);
  };

  const safeRender = () => {
    if (document.fonts && document.fonts.ready && !fontsReadyRef.current) {
      document.fonts.load('800 46px "Bricolage Grotesque"');
      document.fonts.load('700 20px "JetBrains Mono"');
      document.fonts.ready.then(() => { fontsReadyRef.current = true; doRender(); });
    }
    doRender();
  };

  /* ---------- Format toggle ---------- */
  const setFormat = (fmt) => {
    stateRef.current.format = fmt;
    setFormatUi(fmt);
    stateRef.current.offX = 0; stateRef.current.offY = 0; stateRef.current.zoom = 1;
    if (zoomRangeRef.current) zoomRangeRef.current.value = 100;
    if (stateRef.current.img) clampOffsets(stateRef.current, getSlot(stateRef.current));
    safeRender();
  };

  /* ---------- Title generator ---------- */
  const pickTitle = (seedExtra) => {
    const seed = stateRef.current.name + '|' + stateRef.current.role + '|' + (seedExtra || 0);
    const idx = hashStr(seed) % TITLES.length;
    stateRef.current.title = TITLES[idx];
    setTitleVal(TITLES[idx]);
  };

  const handleShuffleTitle = () => {
    pickTitle(Date.now());
    safeRender();
  };

  /* ---------- Name / role inputs ---------- */
  const handleNameChange = (e) => {
    const v = e.target.value;
    setNameVal(v);
    stateRef.current.name = v;
    pickTitle();
    safeRender();
  };
  const handleRoleChange = (e) => {
    const v = e.target.value;
    setRoleVal(v);
    stateRef.current.role = v;
    pickTitle();
    safeRender();
  };

  /* ---------- Image loading ---------- */
  const isHeic = (file) => {
    const name = (file.name || '').toLowerCase();
    return /image\/hei[cf]/.test(file.type) || name.endsWith('.heic') || name.endsWith('.heif');
  };

  const loadImageFromBlob = (blob, displayName) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      stateRef.current.img = img;
      stateRef.current.imgW = img.naturalWidth;
      stateRef.current.imgH = img.naturalHeight;
      stateRef.current.zoom = 1; stateRef.current.offX = 0; stateRef.current.offY = 0;
      if (zoomRangeRef.current) zoomRangeRef.current.value = 100;
      setHasImage(true);
      setFileLabel('✓ ' + displayName);
      setLoadingText('Drop a photo, or tap to upload');
      safeRender();
    };
    img.onerror = () => {
      setLoadingText('Drop a photo, or tap to upload');
      alert('That file could not be read as an image. Please try a JPG, PNG, WEBP, or HEIC photo.');
    };
    img.src = url;
  };

  const handleFile = (file) => {
    if (!file) return;
    setLoadingText('Processing photo…');
    if (isHeic(file)) {
      if (typeof window.heic2any === 'undefined') {
        setLoadingText('Drop a photo, or tap to upload');
        alert('HEIC support failed to load. Please try again or use a JPG/PNG.');
        return;
      }
      window.heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 })
        .then((converted) => {
          const out = Array.isArray(converted) ? converted[0] : converted;
          loadImageFromBlob(out, file.name);
        })
        .catch((err) => {
          setLoadingText('Drop a photo, or tap to upload');
          console.error(err);
          alert('Could not convert this HEIC photo. Please try exporting it as JPG and upload again.');
        });
    } else {
      loadImageFromBlob(file, file.name);
    }
  };

  const onFileInputChange = (e) => {
    if (e.target.files && e.target.files[0]) handleFile(e.target.files[0]);
  };
  const onDropzoneClick = () => fileInputRef.current.click();
  const onDropzoneKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInputRef.current.click(); }
  };
  const onDragEnter = (e) => { e.preventDefault(); setDragActive(true); };
  const onDragOver = (e) => { e.preventDefault(); setDragActive(true); };
  const onDragLeave = (e) => { e.preventDefault(); setDragActive(false); };
  const onDrop = (e) => {
    e.preventDefault(); setDragActive(false);
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  /* ---------- Reposition: drag + zoom (native listeners, mirrors original) ---------- */
  useEffect(() => {
    const canvas = canvasRef.current;

    const canvasScaleFactor = () => {
      const rect = canvas.getBoundingClientRect();
      return canvas.width / rect.width;
    };
    const pointerPos = (e) => {
      const t = (e.touches && e.touches[0]) || e;
      return { x: t.clientX, y: t.clientY };
    };

    const onDragStart = (e) => {
      if (!stateRef.current.img) return;
      draggingRef.current = true;
      setIsGrabbing(true);
      const p = pointerPos(e);
      lastPosRef.current = p;
      e.preventDefault();
    };
    const onDragMove = (e) => {
      if (!draggingRef.current || !stateRef.current.img) return;
      const p = pointerPos(e);
      const f = canvasScaleFactor();
      stateRef.current.offX += (p.x - lastPosRef.current.x) * f;
      stateRef.current.offY += (p.y - lastPosRef.current.y) * f;
      lastPosRef.current = p;
      clampOffsets(stateRef.current, getSlot(stateRef.current));
      doRender();
      e.preventDefault();
    };
    const onDragEnd = () => {
      draggingRef.current = false;
      setIsGrabbing(false);
    };

    const onTouchStartPinch = (e) => {
      if (e.touches.length === 2) {
        draggingRef.current = false;
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        pinchStartDistRef.current = Math.hypot(dx, dy);
        pinchStartZoomRef.current = stateRef.current.zoom;
      }
    };
    const onTouchMovePinch = (e) => {
      if (e.touches.length === 2 && pinchStartDistRef.current) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        const newZoom = clamp(pinchStartZoomRef.current * (dist / pinchStartDistRef.current), 1, 3);
        stateRef.current.zoom = newZoom;
        if (zoomRangeRef.current) zoomRangeRef.current.value = Math.round(newZoom * 100);
        clampOffsets(stateRef.current, getSlot(stateRef.current));
        doRender();
        e.preventDefault();
      }
    };
    const onTouchEndPinch = (e) => {
      if (e.touches.length < 2) pinchStartDistRef.current = null;
    };

    canvas.addEventListener('mousedown', onDragStart);
    window.addEventListener('mousemove', onDragMove);
    window.addEventListener('mouseup', onDragEnd);
    canvas.addEventListener('touchstart', onDragStart, { passive: false });
    window.addEventListener('touchmove', onDragMove, { passive: false });
    window.addEventListener('touchend', onDragEnd);
    canvas.addEventListener('touchstart', onTouchStartPinch, { passive: false });
    canvas.addEventListener('touchmove', onTouchMovePinch, { passive: false });
    canvas.addEventListener('touchend', onTouchEndPinch);

    return () => {
      canvas.removeEventListener('mousedown', onDragStart);
      window.removeEventListener('mousemove', onDragMove);
      window.removeEventListener('mouseup', onDragEnd);
      canvas.removeEventListener('touchstart', onDragStart);
      window.removeEventListener('touchmove', onDragMove);
      window.removeEventListener('touchend', onDragEnd);
      canvas.removeEventListener('touchstart', onTouchStartPinch);
      canvas.removeEventListener('touchmove', onTouchMovePinch);
      canvas.removeEventListener('touchend', onTouchEndPinch);
    };
  }, []);

  const onZoomRangeInput = (e) => {
    if (!stateRef.current.img) return;
    stateRef.current.zoom = clamp(e.target.value / 100, 1, 3);
    clampOffsets(stateRef.current, getSlot(stateRef.current));
    doRender();
  };
  const onRecenter = () => {
    stateRef.current.zoom = 1; stateRef.current.offX = 0; stateRef.current.offY = 0;
    if (zoomRangeRef.current) zoomRangeRef.current.value = 100;
    doRender();
  };

  /* ---------- Export helpers ---------- */
  const currentFilename = (ext) =>
    'hh-goa-2026-' + (stateRef.current.format === 'pfp' ? 'pfp-frame' : 'builder-badge') + '.' + ext;

  const getBlob = (cb) => {
    canvasRef.current.toBlob((blob) => cb(blob), 'image/png', 1);
  };

  const triggerDownload = (blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = currentFilename('png');
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  const doDownload = () => {
    if (!stateRef.current.img) return;
    getBlob(triggerDownload);
  };

  /* ---------- Share to X ---------- */
  const tweetText = () =>
    'Just made my HH Goa 2026 ' + (stateRef.current.format === 'pfp' ? 'frame' : 'builder badge') + ' 🌊🚀';

  const openTweetIntent = () => {
    const url = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(tweetText()) +
      '&hashtags=' + encodeURIComponent('FrameInGoa');
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const showShareNote = () => {
    setShareNote('Image downloaded — attach it in the X composer that just opened.');
  };

  const doShare = () => {
    if (!stateRef.current.img) return;
    getBlob((blob) => {
      const filename = currentFilename('png');
      const file = new File([blob], filename, { type: 'image/png' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({
          files: [file],
          text: tweetText() + ' #FrameInGoa',
          title: 'HH Goa 2026'
        }).catch((err) => {
          if (err && err.name !== 'AbortError') {
            triggerDownload(blob);
            openTweetIntent();
            showShareNote();
          }
        });
      } else {
        triggerDownload(blob);
        openTweetIntent();
        showShareNote();
      }
    });
  };

  /* ---------- Init ---------- */
  useEffect(() => {
    pickTitle();
    setFormat('pfp');
    window.addEventListener('load', safeRender);
    return () => window.removeEventListener('load', safeRender);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <header className="topbar">
        <div className="brand">
          <span className="mark" aria-hidden="true"></span>
          <span>HH GOA<br /><small>Frame &amp; Badge Studio</small></span>
        </div>
        <span className="year-chip">2026</span>
      </header>

      <section className="hero">
        <span className="eyebrow">One upload · one export</span>
        <h1>Turn your photo into an <span className="accent">HH Goa 2026</span> flex</h1>
        <p>Upload a photo, pick a format, and get a share-ready graphic in seconds — no login, no sign-up, no waiting.</p>
      </section>

      <main>
        <div className="panel controls-panel">

          <div className="format-tabs" role="tablist" aria-label="Output format">
            <button
              type="button"
              className={format === 'pfp' ? 'active' : ''}
              role="tab"
              aria-selected={format === 'pfp'}
              onClick={() => setFormat('pfp')}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="9" /><circle cx="12" cy="10" r="3" />
                <path d="M6.5 18.5c1.5-2.5 3.4-3.5 5.5-3.5s4 1 5.5 3.5" />
              </svg>
              PFP Frame
            </button>
            <button
              type="button"
              className={format === 'card' ? 'active' : ''}
              role="tab"
              aria-selected={format === 'card'}
              onClick={() => setFormat('card')}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="4" y="3" width="16" height="18" rx="2" /><circle cx="12" cy="9" r="2.4" />
                <path d="M8 16h8M8 13.2h3" />
              </svg>
              Builder Badge
            </button>
          </div>

          <div
            className={'dropzone' + (dragActive ? ' drag' : '')}
            tabIndex={0}
            role="button"
            aria-label="Upload photo"
            ref={dropzoneRef}
            onClick={onDropzoneClick}
            onKeyDown={onDropzoneKeyDown}
            onDragEnter={onDragEnter}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
          >
            <div className="icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 16V4M12 4l-4 4M12 4l4 4" />
                <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
              </svg>
            </div>
            <h3>{loadingText}</h3>
            <p>JPG, PNG, WEBP, or iPhone HEIC — any crop, any orientation</p>
            <input
              type="file"
              accept="image/*,.heic,.heif"
              ref={fileInputRef}
              onChange={onFileInputChange}
            />
            <div className={'file-name' + (fileLabel ? ' show' : '')}>{fileLabel}</div>
          </div>

          <div className={'reposition' + (hasImage ? ' show' : '')}>
            <div className="rp-label">
              <span>Reposition photo</span>
              <button type="button" onClick={onRecenter}>Recenter</button>
            </div>
            <input
              type="range"
              min="100"
              max="300"
              defaultValue="100"
              ref={zoomRangeRef}
              aria-label="Zoom photo"
              onInput={onZoomRangeInput}
            />
            <div className="hint">Drag the photo in the preview to recompose an off-center shot. Use the slider to zoom.</div>
          </div>

          <div className={'fields' + (format === 'card' ? ' show' : '')}>
            <div className="field">
              <label htmlFor="nameInput">Name</label>
              <input
                type="text"
                id="nameInput"
                maxLength={40}
                placeholder="e.g. Ananya Rao"
                autoComplete="name"
                value={nameVal}
                onChange={handleNameChange}
              />
            </div>
            <div className="field">
              <label htmlFor="roleInput">Stack / Role</label>
              <input
                type="text"
                id="roleInput"
                maxLength={40}
                placeholder="e.g. Full-Stack · Rust, React"
                autoComplete="off"
                value={roleVal}
                onChange={handleRoleChange}
              />
            </div>
            <div className="title-row">
              <div>
                <div className="t-label">Generated builder title</div>
                <div className="t-val">{titleVal}</div>
              </div>
              <button type="button" className="icon-btn" aria-label="Regenerate builder title" onClick={handleShuffleTitle}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 2v6h-6M3 22v-6h6" />
                  <path d="M3.5 9a8.5 8.5 0 0 1 14.7-4.9L21 8M20.5 15a8.5 8.5 0 0 1-14.7 4.9L3 16" />
                </svg>
              </button>
            </div>
          </div>

        </div>

        <div className="panel preview-panel">
          <div className="canvas-wrap">
            <canvas
              id="stage"
              ref={canvasRef}
              width="1080"
              height="1080"
              aria-label="Generated graphic preview"
              className={isGrabbing ? 'grabbing' : ''}
            />
            {!hasImage && (
              <div className="empty-state">
                <span className="glyph">UPLOAD A PHOTO TO<br />SEE YOUR FRAME</span>
              </div>
            )}
          </div>
          <div className="preview-caption">
            {format === 'pfp' ? '1080 × 1080 · ready for X profile photo' : '1080 × 1350 · ready to post on X'}
          </div>

          <div className="actions">
            <button className="btn dark" disabled={!hasImage} onClick={doDownload}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 3v12M7 10l5 5 5-5" /><path d="M5 21h14" />
              </svg>
              Download
            </button>
            <button className="btn primary" disabled={!hasImage} onClick={doShare}>
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.9 2H22l-7.6 8.7L23.3 22h-7l-5.5-7.2L4.5 22H1.3l8.2-9.3L1 2h7.2l5 6.6L18.9 2Zm-1.2 18h1.7L7.4 4H5.6l12.1 16Z" />
              </svg>
              Share to X
            </button>
          </div>
          <div className={'share-note' + (shareNote ? ' show' : '')}>{shareNote}</div>
        </div>
      </main>

      <footer className="foot">HH GOA 2026 · BUILT FOR BUILDERS · #FrameInGoa</footer>

      <div className="mobile-actions">
        <button className="btn dark" disabled={!hasImage} onClick={doDownload}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 3v12M7 10l5 5 5-5" /><path d="M5 21h14" />
          </svg>
          Download
        </button>
        <button className="btn primary" disabled={!hasImage} onClick={doShare}>
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.9 2H22l-7.6 8.7L23.3 22h-7l-5.5-7.2L4.5 22H1.3l8.2-9.3L1 2h7.2l5 6.6L18.9 2Zm-1.2 18h1.7L7.4 4H5.6l12.1 16Z" />
          </svg>
          Share to X
        </button>
      </div>
    </>
  );
}
