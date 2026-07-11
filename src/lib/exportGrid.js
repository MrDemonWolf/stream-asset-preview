// Bake the showcase into one branded PNG for advertising (Discord post, panel,
// tweet). Pure canvas — no deps. Animated GIFs are drawn as their first frame,
// which is what a still ad wants anyway.
//
// blocks: [{ label, spec, cap, items: [{ img, name }] }]  — empty sections are
// expected to be filtered out by the caller.

import { downloadDataUrl } from "@/lib/resize";

const W = 1200; // logical px; rendered at 2× for crispness
const M = 48; // outer margin
const CELL = 104; // tile size
const GAP = 14;
const PER = Math.floor((W - M * 2 + GAP) / (CELL + GAP)); // tiles per row

// Baked copy of the app's dark-theme tokens (index.css). Canvas can't read CSS
// custom properties, so keep these in sync with :root by hand if the palette
// moves. `over` is the "red as text on dark" token (--destructive-text), used
// only when a section is past its slot cap.
const COL = {
  bg: "#0e0e10",
  card: "#18181b",
  border: "#2a2a31",
  text: "#efeff1",
  muted: "#adadb8",
  over: "#ff6b6b",
};

function rows(n) {
  return Math.ceil(n / PER);
}

function sectionH(block) {
  const r = rows(block.items.length);
  return 28 + 18 + 12 + (r * CELL + (r - 1) * GAP) + 30; // label + spec + gap + grid + bottom
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function drawContained(ctx, img, cx, cy, box) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih) return;
  const s = Math.min(box / iw, box / ih);
  const w = iw * s;
  const h = ih * s;
  ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
}

export async function exportShowcase({ title, subtitle, accent, blocks }, filename) {
  const live = blocks.filter((b) => b.items.length > 0);
  if (live.length === 0) return false;

  // Make sure bundled fonts are ready so the header isn't drawn in a fallback.
  if (document.fonts?.ready) await document.fonts.ready.catch(() => {});

  const titleH = M + 46 + 10 + 24 + 20;
  const footerH = 30 + M;
  const H = titleH + live.reduce((sum, b) => sum + sectionH(b), 0) + footerH;

  const dpr = 2;
  const canvas = document.createElement("canvas");
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  ctx.textBaseline = "alphabetic";

  // Background + a soft accent glow bleeding from the top (matches the site).
  ctx.fillStyle = COL.bg;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, -120, 0, W / 2, -120, 620);
  glow.addColorStop(0, hexA(accent, 0.16));
  glow.addColorStop(1, hexA(accent, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, 360);

  // Header
  let y = M + 40;
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(M + 7, y - 13, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COL.text;
  ctx.font = '700 40px "Bricolage Grotesque Variable", system-ui, sans-serif';
  ctx.fillText(title, M + 26, y);
  y += 30;
  ctx.fillStyle = COL.muted;
  ctx.font = '500 18px "JetBrains Mono Variable", ui-monospace, monospace';
  ctx.fillText(subtitle, M, y);
  y = titleH;

  // Sections
  for (const block of live) {
    ctx.fillStyle = COL.text;
    ctx.font = '600 22px "Bricolage Grotesque Variable", system-ui, sans-serif';
    ctx.fillText(block.label, M, y + 20);

    const count = block.cap == null ? `${block.items.length}` : `${block.items.length} / ${block.cap}`;
    ctx.fillStyle = block.cap != null && block.items.length > block.cap ? COL.over : COL.muted;
    ctx.font = '500 16px "JetBrains Mono Variable", ui-monospace, monospace';
    ctx.textAlign = "right";
    ctx.fillText(count, W - M, y + 19);
    ctx.textAlign = "left";

    ctx.fillStyle = COL.muted;
    ctx.font = '400 13px "JetBrains Mono Variable", ui-monospace, monospace';
    ctx.fillText(block.spec, M, y + 40);

    let gy = y + 28 + 18 + 12;
    block.items.forEach((it, i) => {
      const col = i % PER;
      const row = Math.floor(i / PER);
      const x = M + col * (CELL + GAP);
      const ty = gy + row * (CELL + GAP);
      ctx.fillStyle = COL.card;
      ctx.strokeStyle = COL.border;
      ctx.lineWidth = 1;
      roundRect(ctx, x, ty, CELL, CELL, 12);
      ctx.fill();
      ctx.stroke();
      if (it.img) drawContained(ctx, it.img, x + CELL / 2, ty + CELL / 2, CELL - 22);
    });

    y += sectionH(block);
  }

  // Footer watermark
  ctx.fillStyle = COL.muted;
  ctx.font = '400 13px "JetBrains Mono Variable", ui-monospace, monospace';
  ctx.fillText("Made with MrDemonWolf Stream Asset Previewer · mrdemonwolf.github.io/stream-asset-preview", M, H - M + 6);

  downloadDataUrl(canvas.toDataURL("image/png"), filename);
  return true;
}

// "#rrggbb" + alpha → rgba() string.
function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}
