// Content-based image validation. Extensions and MIME strings lie (a renamed
// .exe, an SVG served as image/png), so we sniff the actual bytes and inspect
// the decoded bitmap before trusting a file. Also enforces the safe-intake
// ceilings so a hostile or accidental huge upload can't wedge the browser.

const KB = 1024;
const MB = 1024 * 1024;

// Safe-intake ceilings.
export const MAX_FILE_BYTES = 25 * MB; // source file on disk
export const MAX_DIMENSION = 8192; // longest decoded side
export const MAX_PIXELS = 40 * 1_000_000; // decoded area (40 MP)
export const MAX_FILES_PER_ADD = 60; // per drop / picker batch
export const MAX_SHOWCASE_ITEMS = 600; // aggregate across all sections

const FORMATS = ["png", "gif", "jpeg", "webp"];

// Does the byte range at `off` match these ASCII/byte values?
function matches(bytes, off, sig) {
  for (let i = 0; i < sig.length; i++) if (bytes[off + i] !== sig[i]) return false;
  return true;
}
function ascii(s) {
  return [...s].map((c) => c.charCodeAt(0));
}

// Find an ASCII marker (e.g. a PNG chunk name) anywhere in the buffer.
function contains(bytes, marker) {
  const sig = ascii(marker);
  outer: for (let i = 0; i <= bytes.length - sig.length; i++) {
    for (let j = 0; j < sig.length; j++) if (bytes[i + j] !== sig[j]) continue outer;
    return true;
  }
  return false;
}

// Sniff the real format + whether it's animated, from the file's header bytes.
// Returns { format, animated }; format is null if it's not a raster we accept.
export function sniff(buffer) {
  const b = new Uint8Array(buffer);
  if (matches(b, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    // APNG = a PNG carrying an animation-control (acTL) chunk.
    return { format: "png", animated: contains(b.subarray(0, 4096), "acTL") };
  }
  if (matches(b, 0, ascii("GIF87a")) || matches(b, 0, ascii("GIF89a"))) {
    // Treat every GIF as potentially animated (single-frame GIFs are rare and
    // this is the safe assumption for an animated-only slot).
    return { format: "gif", animated: true };
  }
  if (matches(b, 0, [0xff, 0xd8, 0xff])) return { format: "jpeg", animated: false };
  if (matches(b, 0, ascii("RIFF")) && matches(b, 8, ascii("WEBP"))) {
    return { format: "webp", animated: contains(b.subarray(0, 64), "ANIM") };
  }
  return { format: null, animated: false };
}

// Basic intake gate applied to EVERY file before decoding/organizing. `info` is
// sniff() output; `img` is the decoded HTMLImageElement (may be null if decode
// failed upstream). Returns { ok, reasons } — reasons is a list for the user.
export function validateIntake(file, info, img) {
  const reasons = [];
  if (!info || !FORMATS.includes(info.format)) {
    reasons.push("not a PNG, GIF, JPEG or WEBP image");
  }
  if (file.size > MAX_FILE_BYTES) {
    reasons.push(`file is ${Math.round(file.size / MB)} MB (max ${MAX_FILE_BYTES / MB} MB)`);
  }
  if (img) {
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    if (w > MAX_DIMENSION || h > MAX_DIMENSION) {
      reasons.push(`${w}×${h}px exceeds the ${MAX_DIMENSION}px limit`);
    }
    if (w * h > MAX_PIXELS) {
      reasons.push(
        `${((w * h) / 1_000_000).toFixed(1)} MP exceeds the ${MAX_PIXELS / 1_000_000} MP limit`,
      );
    }
  }
  return { ok: reasons.length === 0, reasons };
}

// Section-aware validation for the showcase: intake gate PLUS the slot's
// animation policy ("static" | "animated" | "either"). Format, dimensions and
// file size are hard limits; squareness and the per-file KB cap stay soft
// (surfaced as to-dos) so you can still organize off-spec art and fix it later.
export function validateForSection(file, info, img, section) {
  const { ok, reasons } = validateIntake(file, info, img);
  const all = [...reasons];
  if (info?.format) {
    if (section.animation === "animated" && !info.animated) {
      all.push(`the ${section.label} slot needs an animated file (this one is static)`);
    }
    if (section.animation === "static" && info.animated) {
      all.push(`the ${section.label} slot is static only (this one is animated)`);
    }
  }
  return { ok: ok && all.length === reasons.length, reasons: all };
}

// One-line human summary for a rejected file.
export function rejectionText(name, reasons) {
  return `Skipped “${name}” — ${reasons.join("; ")}.`;
}

export { KB, MB };
