// Parse a "#rrggbb" (or "rrggbb") hex color into [r, g, b] byte values, or null
// if it isn't a valid 6-digit hex. Shared by the chat-color contrast check
// (App) and the canvas export palette (exportGrid). scripts/gen-og.mjs keeps its
// own tiny copy on purpose so that build script stays dependency-free.
export function hexToRgb(hex) {
  const c = /^#?[0-9a-f]{6}$/i.test(hex?.trim() ?? "") ? hex.trim().replace(/^#/, "") : null;
  if (!c) return null;
  return [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16));
}
