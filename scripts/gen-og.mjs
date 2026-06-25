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

// canvas
rect(0, 0, W, H, BG);
// soft purple glow from top-center
for (let y = 0; y < H; y++)
  for (let x = 0; x < W; x++) {
    const d = Math.hypot(x - W / 2, y + 80) / 520;
    if (d < 1) px(x, y, GLOW, (1 - d) * 0.18);
  }

// logo tile
const S = 300, lx = (W - S) / 2, ly = (H - S) / 2 - 20;
roundRect(lx, ly, S, S, 64, PURPLE);
// eyes
circle(lx + 110, ly + 130, 24, WHITE);
circle(lx + 190, ly + 130, 24, WHITE);
// mouth bar
roundRect(lx + 95, ly + 195, 110, 26, 13, WHITE);

// accent underline
rect((W - 160) / 2, ly + S + 36, 160, 6, PURPLE);

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
