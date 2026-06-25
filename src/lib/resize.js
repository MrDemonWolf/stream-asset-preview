// Client-side downscale: upload one high-res source, get the exact sizes
// Twitch wants. Badges ship 18/36/72, emotes 28/56/112 — you design at the
// largest and this generates the rest. Canvas only, no deps.

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

// Draw `img` centered+contained into a transparent square of `size` px.
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

// Returns { name, files: { "<size>": dataURL }, single } — the same shape the
// rest of the app consumes, so AssetCard / ChatPreview render it unchanged.
export async function resizeSet(file, sizes) {
  const img = await loadImage(file);
  const files = {};
  for (const size of sizes) files[String(size)] = square(img, size).toDataURL("image/png");
  return {
    name: file.name.replace(/\.[^.]+$/, ""),
    files,
    single: files[String(Math.max(...sizes))],
  };
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
