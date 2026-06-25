#!/usr/bin/env node
// Build-time auto-scan: walk public/badges + public/emotes and emit
// public/manifest.json. GitHub Pages can't list directories, so the deployed
// app reads this file instead. Runs on every `dev` and `build`.
//
//   badges/<name>/<size>.png        -> { name, sizes: { "<size>": "badges/<name>/<size>.png" } }
//   emotes/<code>/<size>.png        -> { code, sizes: { ... } }
//   emotes/<code>.png  (loose file) -> { code, single: "emotes/<code>.png" }

import { readdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = join(root, "public");
const IMAGE_RE = /\.(png|gif|jpe?g|webp|avif)$/i;

async function scan(category) {
  const dir = join(publicDir, category);
  if (!existsSync(dir)) return [];

  const entries = await readdir(dir, { withFileTypes: true });
  const out = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const files = (await readdir(join(dir, entry.name))).filter((f) => IMAGE_RE.test(f));
      const sizes = {};
      let single = null;
      for (const f of files) {
        const base = f.replace(IMAGE_RE, "");
        if (/^\d+$/.test(base)) sizes[base] = `${category}/${entry.name}/${f}`;
        else single = `${category}/${entry.name}/${f}`;
      }
      if (Object.keys(sizes).length || single) out.push({ name: entry.name, sizes, single });
    } else if (IMAGE_RE.test(entry.name)) {
      out.push({ name: entry.name.replace(IMAGE_RE, ""), sizes: {}, single: `${category}/${entry.name}` });
    }
  }

  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

const badges = await scan("badges");
const emotes = (await scan("emotes")).map(({ name, ...rest }) => ({ code: name, ...rest }));
const manifest = { generatedAt: null, badges, emotes };

const json = JSON.stringify(manifest, null, 2);

// self-check: must round-trip to an object carrying both keys as arrays.
const parsed = JSON.parse(json);
if (!Array.isArray(parsed.badges) || !Array.isArray(parsed.emotes)) {
  throw new Error("gen-manifest: output missing badges/emotes arrays");
}

await writeFile(join(publicDir, "manifest.json"), json + "\n");
console.log(`manifest: ${badges.length} badges, ${emotes.length} emotes`);
