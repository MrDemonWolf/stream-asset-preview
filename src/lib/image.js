// Shared image-intake rules for both views (Crop and Showcase). Raster only —
// SVG can taint the canvas so toDataURL() would throw, and every platform wants
// PNG anyway.

export const ACCEPT = /\.(png|gif|jpe?g|webp)$/i; // match by filename
export const ACCEPT_TYPE = /^image\/(png|gif|jpeg|webp)$/; // match by MIME
export const ACCEPT_ATTR = "image/png,image/gif,image/jpeg,image/webp"; // <input accept>

// Does this File look like a raster image we can decode? Checks the MIME type
// first and falls back to the extension (some browsers leave File.type empty on
// drag-and-drop).
export function isRasterImage(file) {
  return ACCEPT_TYPE.test(file.type) || ACCEPT.test(file.name);
}

// GIFs decode fine but export as a static first frame, so callers warn on them.
export function isGif(file) {
  return /gif/i.test(file.type) || /\.gif$/i.test(file.name);
}

// Drop a trailing extension so a filename can be reused as an asset name.
export function stripExt(name) {
  return name.replace(/\.[^.]+$/, "");
}
