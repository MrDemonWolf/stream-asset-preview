// Two sources, one shape. Cards never know where the data came from.
//
//   badge = { name, files: { 18?: url, 36?: url, 72?: url } }
//   emote = { code, files: { 28?: url, 56?: url, 112?: url }, single: url|null }
//
// `files` is keyed by the numeric size found on disk; missing sizes are just absent.

const IMAGE_RE = /\.(png|gif|jpe?g|webp|avif)$/i;

// Resolve a manifest-relative path against Vite's base ("/stream-asset-preview/").
function resolve(p) {
  return import.meta.env.BASE_URL.replace(/\/$/, "") + "/" + p.replace(/^\//, "");
}

// Auto-scan path: read the build-time manifest.
export async function loadFromManifest() {
  const res = await fetch(resolve("manifest.json"), { cache: "no-cache" });
  if (!res.ok) throw new Error(`manifest ${res.status}`);
  const raw = await res.json();

  const map = (list, key) =>
    (list ?? []).map((a) => ({
      [key]: a[key] ?? a.name ?? a.code,
      files: Object.fromEntries(
        Object.entries(a.sizes ?? {}).map(([s, p]) => [s, resolve(p)]),
      ),
      single: a.single ? resolve(a.single) : null,
    }));

  return {
    badges: map(raw.badges, "name"),
    emotes: map(raw.emotes, "code"),
  };
}

// Fallback path: turn a picked / dropped FileList into the same shape.
export function parseFiles(fileList) {
  const files = Array.from(fileList).filter((f) => IMAGE_RE.test(f.name));
  const badges = new Map();
  const emotes = new Map();

  for (const file of files) {
    const rel = file.webkitRelativePath || file.name;
    const segs = rel.split("/").filter(Boolean);

    // Find the category anchor anywhere in the path (handles a wrapper folder).
    const i = segs.findIndex((s) => /^badges$/i.test(s) || /^emotes$/i.test(s));
    if (i === -1) continue;

    const isBadge = /^badges$/i.test(segs[i]);
    const rest = segs.slice(i + 1);
    if (rest.length === 0) continue;

    const url = URL.createObjectURL(file);
    const bag = isBadge ? badges : emotes;

    if (rest.length === 1) {
      // category/<asset>.png  → a single-file asset, folder-less.
      const name = rest[0].replace(IMAGE_RE, "");
      const entry = bag.get(name) ?? { name, files: {}, single: null };
      entry.single = url;
      bag.set(name, entry);
    } else {
      // category/<asset>/<size>.png  (deeper nesting → take first + last).
      const name = rest[0];
      const sizeRaw = rest[rest.length - 1].replace(IMAGE_RE, "");
      const entry = bag.get(name) ?? { name, files: {}, single: null };
      if (/^\d+$/.test(sizeRaw)) entry.files[sizeRaw] = url;
      else entry.single = url;
      bag.set(name, entry);
    }
  }

  const toArr = (bag, key) =>
    Array.from(bag.values())
      .map((e) => ({ [key]: e.name, files: e.files, single: e.single }))
      .sort((a, b) => a[key].localeCompare(b[key]));

  return { badges: toArr(badges, "name"), emotes: toArr(emotes, "code") };
}

// Pick the best source URL for a target display size:
// exact size on disk → otherwise the single file → otherwise the largest available.
export function pickSrc(asset, target) {
  const { files = {}, single = null } = asset;
  if (files[target]) return files[target];
  if (single) return single;
  const sizes = Object.keys(files)
    .map(Number)
    .sort((a, b) => b - a);
  return sizes.length ? files[sizes[0]] : null;
}
