// Canvas image ops shared by both tools — everything happens in the browser,
// no uploads, no deps. Two jobs live here:
//   1. The interactive crop model used by the Crop view: a square { x, y, size }
//      window over the source (see the block comment further down) that
//      cropToDataUrl() rasterizes to each platform size (Twitch 18/36/72 badges
//      & 28/56/112 emotes, Discord 48/128 & 160/320).
//   2. squareDataUrl(): the Showcase's "auto-size on drop" — contain the whole
//      image into one transparent square, no cropping.
// All output is PNG; animation is intentionally dropped (callers warn on GIF).

// Browser canvas limits are conservative on mobile Safari (~16.8M px total,
// ~4096–16384 per side). Keep our canvases well under so exports don't silently
// produce a blank bitmap or a "data:," string.
export const MAX_CANVAS_SIDE = 4096;
export const MAX_CANVAS_AREA = 16_000_000; // px²

// A decode that never fires onload/onerror (rare, but possible with a wedged
// GIF) must not hang the UI forever.
export const DECODE_TIMEOUT_MS = 15_000;

// A 2D context can come back null (context-loss, exhausted GPU memory). Callers
// must surface this rather than dereferencing null.
function get2dContext(canvas) {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser couldn't open a canvas — try a smaller image or reload.");
  return ctx;
}

// Reject a canvas that would exceed the browser's limits before we try to draw.
export function assertCanvasSize(w, h) {
  if (w > MAX_CANVAS_SIDE || h > MAX_CANVAS_SIDE || w * h > MAX_CANVAS_AREA) {
    throw new Error("That image is too large to process in the browser — resize it smaller first.");
  }
}

// Decode a File to an HTMLImageElement with a timeout and abort support. Revokes
// its object URL on every exit path. Pass an AbortSignal to cancel in flight.
/**
 * @param {File|Blob} file
 * @param {{ signal?: AbortSignal, timeoutMs?: number }} [options]
 * @returns {Promise<HTMLImageElement>}
 */
export function loadImage(file, { signal, timeoutMs = DECODE_TIMEOUT_MS } = {}) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    let settled = false;
    const cleanup = () => {
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      if (signal) signal.removeEventListener("abort", onAbort);
    };
    const finish = (fn, arg) => {
      if (settled) return;
      settled = true;
      cleanup();
      fn(arg);
    };
    const onAbort = () => finish(reject, new DOMException("aborted", "AbortError"));
    const timer = setTimeout(
      () => finish(reject, new Error("could not decode image (timed out)")),
      timeoutMs,
    );
    if (signal) {
      if (signal.aborted) return onAbort();
      signal.addEventListener("abort", onAbort);
    }
    img.onload = () => finish(resolve, img);
    img.onerror = () => finish(reject, new Error("could not decode image"));
    img.src = url;
  });
}

// Draw `img` centered + contained (letterboxed) into a transparent square of
// `size` px. High-quality smoothing since we're always downscaling from a
// larger source. Shared by squareDataUrl below.
function square(img, size) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = get2dContext(canvas);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  const scale = Math.min(size / img.width, size / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
  return canvas;
}

// Contain `file` into one transparent square PNG of `size` px — the showcase's
// auto-size on upload. Returns the data URL plus its decoded byte size (for the
// off-spec KB check) and the original dimensions.
export async function squareDataUrl(file, size, opts) {
  const img = await loadImage(file, opts);
  const canvas = square(img, size);
  const dataUrl = canvas.toDataURL("image/png");
  return {
    dataUrl,
    bytes: bytesOfDataUrl(dataUrl),
    w: img.naturalWidth,
    h: img.naturalHeight,
  };
}

// ── Interactive square crop ────────────────────────────────────────────────
// A crop is a square window on the source, in *source pixels*: { x, y, size }.
// x/y are the window's top-left (may be negative → transparent padding on that
// edge). This one model covers both "contain" (window bigger than the image,
// padded) and "cover"/tight crops (window inside the image, edges dropped).

// Whole image fits inside the square (letterbox padding) — the safe default.
export function containCrop(img) {
  const size = Math.max(img.naturalWidth, img.naturalHeight);
  return { x: (img.naturalWidth - size) / 2, y: (img.naturalHeight - size) / 2, size };
}

// Square fully covered by the image (edges cropped off).
export function coverCrop(img) {
  const size = Math.min(img.naturalWidth, img.naturalHeight);
  return { x: (img.naturalWidth - size) / 2, y: (img.naturalHeight - size) / 2, size };
}

// Keep the crop usable: size within [min, max] and its center over the image,
// so you can never drag/zoom to a fully-empty result.
export function clampCrop(crop, natW, natH, min = 8, max = Infinity) {
  const hi = Math.max(min, max); // never let a tiny source invert the bounds
  const size = Math.min(Math.max(crop.size, min), hi);
  const cx = Math.min(Math.max(crop.x + crop.size / 2, 0), natW);
  const cy = Math.min(Math.max(crop.y + crop.size / 2, 0), natH);
  return { x: cx - size / 2, y: cy - size / 2, size };
}

// Resize a crop to `size` px while keeping its center fixed — the shared math
// behind zoom (wheel, slider, +/− keys) and the Center button.
export function recenter(crop, size) {
  return {
    x: crop.x + crop.size / 2 - size / 2,
    y: crop.y + crop.size / 2 - size / 2,
    size,
  };
}

// Draw the square crop into an N×N canvas context. Intersects the crop with the
// image bounds ourselves and maps only the overlap into a proportional dest
// rect — anything outside the image stays transparent. Doing the intersection
// here (instead of leaning on drawImage's out-of-bounds handling) keeps padding
// correct across browsers.
function drawSquareCrop(ctx, img, crop, N) {
  ctx.clearRect(0, 0, N, N);
  const natW = img.naturalWidth;
  const natH = img.naturalHeight;
  const scale = N / crop.size; // dest px per source px

  const ix0 = Math.max(crop.x, 0);
  const iy0 = Math.max(crop.y, 0);
  const ix1 = Math.min(crop.x + crop.size, natW);
  const iy1 = Math.min(crop.y + crop.size, natH);
  if (ix1 <= ix0 || iy1 <= iy0) return; // crop entirely off the image

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  // Single high-quality downscale. If the smallest sizes (28px) ever look soft,
  // add stepped halving here.
  ctx.drawImage(
    img,
    ix0,
    iy0,
    ix1 - ix0,
    iy1 - iy0,
    (ix0 - crop.x) * scale,
    (iy0 - crop.y) * scale,
    (ix1 - ix0) * scale,
    (iy1 - iy0) * scale,
  );
}

// Rasterize one square crop to a PNG data URL (+ its decoded byte size).
export function cropToDataUrl(img, crop, size) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  drawSquareCrop(get2dContext(canvas), img, crop, size);
  const dataUrl = canvas.toDataURL("image/png");
  return { dataUrl, bytes: bytesOfDataUrl(dataUrl) };
}

// Approximate decoded byte length of a base64 data URL without decoding it.
export function bytesOfDataUrl(dataUrl) {
  if (!dataUrl) return 0;
  const b64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const pad = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - pad;
}

// Trigger a download of one generated size (data URL or object URL).
export function downloadDataUrl(dataUrl, filename) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// Download a Blob via a short-lived object URL (revoked after the click) — used
// for large exports so the whole PNG isn't held in memory as a base64 string.
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  downloadDataUrl(url, filename);
  // Revoke on the next tick so the click has consumed the URL.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

// Encode a canvas to a Blob, rejecting instead of hanging if the browser hands
// back null (CORS-tainted canvas, allocation failure, encoder error).
export function canvasToBlob(canvas, type = "image/png") {
  return new Promise((resolve, reject) => {
    let done = false;
    try {
      canvas.toBlob((blob) => {
        done = true;
        if (blob) resolve(blob);
        else
          reject(new Error("Couldn't encode the image (the canvas may be too large or tainted)."));
      }, type);
    } catch (e) {
      // Keep the browser's own reason (e.g. "Tainted canvases may not be
      // exported.") — a bare "couldn't encode" hides why the export failed.
      const why = e?.message ? ` (${e.message})` : "";
      reject(new Error(`Couldn't encode the image${why}`, { cause: e }));
      return;
    }
    // toBlob is async with no error channel; guard against a silent no-callback.
    setTimeout(() => {
      if (!done) reject(new Error("Encoding the image timed out."));
    }, 10_000);
  });
}

// Make a user-supplied name safe as a download filename: keep only letters,
// digits, dot, dash, underscore and spaces (drops control chars, path
// separators and Windows-hostile characters), collapse whitespace, cap length.
export function safeFilename(name) {
  const cleaned = String(name ?? "")
    .replace(/[^A-Za-z0-9._ -]+/g, " ")
    .replace(/\s+/g, "-")
    .replace(/^[.-]+|[.-]+$/g, "")
    .slice(0, 80);
  return cleaned || "export";
}
