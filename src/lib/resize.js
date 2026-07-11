// Canvas image ops shared by both tools — everything happens in the browser,
// no uploads, no deps. Two jobs live here:
//   1. The interactive crop model used by the Crop view: a square { x, y, size }
//      window over the source (see the block comment further down) that
//      cropToDataUrl() rasterizes to each platform size (Twitch 18/36/72/120 &
//      28/56/112, Discord 48/128 & 160/320).
//   2. squareDataUrl(): the Showcase's "auto-size on drop" — contain the whole
//      image into one transparent square, no cropping.
// All output is PNG; animation is intentionally dropped (callers warn on GIF).

export function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve(img);
      // revoke after decode; the canvas owns the pixels now
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("could not decode image"));
    };
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
  const ctx = canvas.getContext("2d");
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
export async function squareDataUrl(file, size) {
  const img = await loadImage(file);
  const canvas = square(img, size);
  const dataUrl = canvas.toDataURL("image/png");
  const b64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const pad = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return {
    dataUrl,
    bytes: Math.floor((b64.length * 3) / 4) - pad,
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
  // ponytail: single high-quality downscale — add stepped halving if the
  // smallest sizes (28px) ever look soft.
  ctx.drawImage(
    img,
    ix0, iy0, ix1 - ix0, iy1 - iy0,
    (ix0 - crop.x) * scale, (iy0 - crop.y) * scale, (ix1 - ix0) * scale, (iy1 - iy0) * scale,
  );
}

// Rasterize one square crop to a PNG data URL (+ its decoded byte size).
export function cropToDataUrl(img, crop, size) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  drawSquareCrop(canvas.getContext("2d"), img, crop, size);
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

// Trigger a download of one generated size.
export function downloadDataUrl(dataUrl, filename) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
