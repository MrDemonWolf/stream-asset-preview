#!/usr/bin/env node
// One-shot: render the 1200x630 social card (public/og.png) used by og:image /
// twitter:image. Pure Node — no canvas dep. Re-run if the brand mark changes.
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const W = 1200, H = 630;
const buf = Buffer.alloc(W * H * 4);

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const BG = hex("#0e0e10"), PURPLE = hex("#9147ff"), WHITE = [255, 255, 255], GLOW = hex("#9147ff");

function px(x, y, [r, g, b], a = 1) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 4;
  buf[i] = buf[i] * (1 - a) + r * a;
  buf[i + 1] = buf[i + 1] * (1 - a) + g * a;
  buf[i + 2] = buf[i + 2] * (1 - a) + b * a;
  buf[i + 3] = 255;
}
function rect(x0, y0, w, h, c, a = 1) {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) px(x, y, c, a);
}
function roundRect(x0, y0, w, h, rad, c) {
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const dx = Math.min(x, w - 1 - x), dy = Math.min(y, h - 1 - y);
      if (dx < rad && dy < rad) {
        const d = Math.hypot(rad - dx, rad - dy);
        if (d > rad) continue;
      }
      px(x0 + x, y0 + y, c);
    }
}
function circle(cx, cy, r, c) {
  for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r) px(cx + x, cy + y, c);
}
// one side of a broadcast arc ring (side>0 = right, side<0 = left), ±halfDeg span
function arcRing(cx, cy, r, w, side, halfDeg, c) {
  const r0 = r - w / 2, r1 = r + w / 2;
  for (let y = Math.floor(cy - r1); y <= Math.ceil(cy + r1); y++)
    for (let x = Math.floor(cx - r1); x <= Math.ceil(cx + r1); x++) {
      const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy);
      if (d < r0 || d > r1) continue;
      const a = (Math.atan2(dy, dx) * 180) / Math.PI;
      if (side > 0 ? Math.abs(a) <= halfDeg : Math.abs(a) >= 180 - halfDeg) px(x, y, c);
    }
}
// purple tile + broadcast signal (dot + radiating arcs), like the favicon
function badge(x, y, s) {
  roundRect(x, y, s, s, s * 0.22, PURPLE);
  const cx = x + s / 2, cy = y + s / 2 + s * 0.016, w = s * 0.072;
  for (const side of [1, -1]) {
    arcRing(cx, cy, s * 0.1875, w, side, 50, WHITE);
    arcRing(cx, cy, s * 0.297, w, side, 50, WHITE);
  }
  circle(cx, cy, s * 0.081, WHITE);
}

// canvas
rect(0, 0, W, H, BG);
// soft purple glow from top-center
for (let y = 0; y < H; y++)
  for (let x = 0; x < W; x++) {
    const d = Math.hypot(x - W / 2, y + 80) / 520;
    if (d < 1) px(x, y, GLOW, (1 - d) * 0.18);
  }

// hero mark + "one image → every size" progression, bottom-aligned on a baseline
const baseline = 430;
badge(150, baseline - 300, 300);
const chips = [[560, 150], [760, 100], [905, 64]];
for (const [x, s] of chips) badge(x, baseline - s, s);
// connecting baseline rule under the chips
rect(560, baseline + 14, 409, 4, PURPLE);
// accent underline beneath the hero mark
rect(150 + (300 - 160) / 2, baseline + 36, 160, 6, PURPLE);

// ---- encode PNG (RGBA) ----
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (b) => {
  let c = 0xffffffff;
  for (const x of b) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6;
const raw = Buffer.alloc(H * (W * 4 + 1));
for (let y = 0; y < H; y++) {
  raw[y * (W * 4 + 1)] = 0;
  buf.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4);
}
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk("IHDR", ihdr),
  chunk("IDAT", deflateSync(raw)),
  chunk("IEND", Buffer.alloc(0)),
]);
const out = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "og.png");
writeFileSync(out, png);
console.log(`og.png ${W}x${H} ${(png.length / 1024).toFixed(0)}KB`);
