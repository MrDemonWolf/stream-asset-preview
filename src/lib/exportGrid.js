// Bake the showcase into one branded PNG for advertising (Discord post, panel,
// tweet). Pure canvas — no deps. Animated GIFs are drawn as their first frame,
// which is what a still ad wants anyway.
//
// blocks: [{ label, spec, cap, items: [{ img, name }] }]  — empty sections are
// expected to be filtered out by the caller.

import { hexToRgb } from "@/lib/color";
import { canvasToBlob, downloadBlob } from "@/lib/resize";

// Device-pixel ceilings so a big showcase can't build a canvas that crashes or
// silently blanks on mobile Safari (~16.7M px area, conservative per-side).
const EXPORT_MAX_SIDE = 8192;
const EXPORT_MAX_AREA = 16_000_000;

const W = 1200; // logical px; rendered at up to 2× for crispness
const M = 48; // outer margin
const CELL = 104; // tile size
const GAP = 14;
const PER = Math.floor((W - M * 2 + GAP) / (CELL + GAP)); // tiles per row
// Height above each section's tile grid: label row (28) + spec row (18) + gap
// (12). Shared by the height measure and the draw loop so they can't drift.
const HEADER_H = 28 + 18 + 12;

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
  return HEADER_H + (r * CELL + (r - 1) * GAP) + 30; // header + grid + bottom
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

// Truncate `text` with an ellipsis so it never overflows `maxWidth` at the
// context's current font. Returns the string that fits.
function fitText(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  const ell = "…";
  let s = String(text);
  while (s.length > 1 && ctx.measureText(s + ell).width > maxWidth) s = s.slice(0, -1);
  return s + ell;
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

  // Pick the highest device-pixel ratio (2 → 1) that keeps the canvas inside the
  // browser's limits; refuse outright if even 1× is too tall to render.
  let dpr = 2;
  while (dpr > 1 && (H * dpr > EXPORT_MAX_SIDE || W * dpr * H * dpr > EXPORT_MAX_AREA)) dpr -= 1;
  if (H > EXPORT_MAX_SIDE || W * H > EXPORT_MAX_AREA) {
    throw new Error("This showcase is too large to export — split it into fewer sections.");
  }

  const canvas = document.createElement("canvas");
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser couldn't open a canvas for the export.");
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
  ctx.fillText(fitText(ctx, title, W - M - (M + 26)), M + 26, y);
  y += 30;
  ctx.fillStyle = COL.muted;
  ctx.font = '500 18px "JetBrains Mono Variable", ui-monospace, monospace';
  ctx.fillText(fitText(ctx, subtitle, W - 2 * M), M, y);
  y = titleH;

  // Sections
  for (const block of live) {
    const count =
      block.cap == null ? `${block.items.length}` : `${block.items.length} / ${block.cap}`;
    // Reserve room for the right-aligned count so a long label can't collide.
    ctx.font = '500 16px "JetBrains Mono Variable", ui-monospace, monospace';
    const countW = ctx.measureText(count).width;

    ctx.fillStyle = COL.text;
    ctx.font = '600 22px "Bricolage Grotesque Variable", system-ui, sans-serif';
    ctx.fillText(fitText(ctx, block.label, W - 2 * M - countW - 16), M, y + 20);

    ctx.fillStyle = block.cap != null && block.items.length > block.cap ? COL.over : COL.muted;
    ctx.font = '500 16px "JetBrains Mono Variable", ui-monospace, monospace';
    ctx.textAlign = "right";
    ctx.fillText(count, W - M, y + 19);
    ctx.textAlign = "left";

    ctx.fillStyle = COL.muted;
    ctx.font = '400 13px "JetBrains Mono Variable", ui-monospace, monospace';
    ctx.fillText(fitText(ctx, block.spec, W - 2 * M), M, y + 40);

    let gy = y + HEADER_H;
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
  ctx.fillText(
    "Made with MrDemonWolf Stream Asset Previewer · mrdemonwolf.github.io/stream-asset-preview",
    M,
    H - M + 6,
  );

  // toBlob (not toDataURL) so a large PNG isn't materialized as a base64 string;
  // rejects on a CORS-tainted / oversized canvas so the caller can report it.
  const blob = await canvasToBlob(canvas, "image/png");
  downloadBlob(blob, filename);
  return true;
}

// "#rrggbb" + alpha → rgba() string.
function hexA(hex, a) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}
