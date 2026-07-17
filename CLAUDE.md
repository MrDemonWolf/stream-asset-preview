# CLAUDE.md

Guidance for AI agents working in this repo.

## What this is

Stream Asset Previewer — a 100% client-side, single-page browser tool for
prepping streamer chat assets. Drop an image, crop it square, and it rasterizes
to each platform's spec sizes (Twitch emotes/badges, Discord emoji/stickers),
warns on spec violations, previews it in mock chat, and exports PNGs. A second
"Showcase" view organizes a whole emote set into slots and bakes one branded
advertising PNG. No backend, no image uploads — everything runs on an HTML
canvas locally.

## Stack

- React 19 + JSX (no TypeScript — `jsconfig.json`, `@/*` → `src/*`)
- Vite 6 (`vite.config.js`; base path `/stream-asset-preview/` for GitHub Pages)
- Tailwind CSS v4, CSS-first — theme tokens live in `src/index.css :root`, there
  is no `tailwind.config`
- shadcn/ui (new-york) primitives in `src/components/ui/` + Radix
- Self-hosted fonts (Bricolage Grotesque, JetBrains Mono) and all deps bundled —
  no runtime CDN

## Commands

- `npm run dev` — Vite dev server (port 5173)
- `npm run build` — static build to `dist/`
- `npm run preview` — serve the build
- `npm run lint` — ESLint (flat config in `eslint.config.js`)
- `npm run format` / `format:check` — Prettier
- `npm test` — Vitest (unit tests for pure `src/lib/` helpers)
- `node scripts/gen-og.mjs` — regenerate `public/og.png` (only if the brand mark
  changes)

CI (`.github/workflows/deploy.yml`) runs lint + test + build before deploying to
GitHub Pages on push to `main`.

## Architecture

- `src/App.jsx` — the two-view shell. `SPECS` (per asset type: sizes, upload
  size, byte cap, guide link) and `PLATFORMS` drive the whole UI. View 1 is the
  crop-and-export flow.
- `src/components/CropStage.jsx` — interactive square crop editor (pointer +
  keyboard + wheel). The crop is `{ x, y, size }` in source pixels, owned by the
  parent; the stage reports changes through `onChange`.
- `src/components/Showcase.jsx` — view 2: sort an emote set into tier/boost
  slots and export one grid PNG.
- `src/components/{ChatPreview,DiscordPreview}.jsx` — faithful mock chat lines.
- `src/lib/` — the shared logic:
  - `resize.js` — canvas crop/resize primitives (`cropToDataUrl`, `squareDataUrl`,
    `clampCrop`, `recenter`, `bytesOfDataUrl`, `downloadDataUrl`).
  - `exportGrid.js` — bakes the showcase into one branded PNG.
  - `platforms.js` — data-only slot specs for the Showcase.
  - `twitch.js` — zero-auth public GraphQL emote lookup by channel name.
  - `image.js` — image-intake predicates/constants (`isRasterImage`, `isGif`,
    `stripExt`, `ACCEPT*`).
  - `color.js` — `hexToRgb`.
  - `utils.js` — `cn()` (clsx + tailwind-merge).
- `src/hooks/useFileDrop.js` — shared drag-drop + hidden-file-input plumbing for
  both dropzones.

## Conventions & gotchas

- **Canvas colors are hand-baked copies of `index.css`.** Canvas/JS can't read
  CSS custom properties, so `exportGrid.js`'s `COL` palette and `App.jsx`'s
  `CHAT_BG` (`#18181b`, = `--card`) duplicate the theme by hand. If a token in
  `index.css :root` moves, update those copies too.
- **Locked platform hex values.** Some preview colors (Twitch/Discord chrome)
  are deliberately hardcoded to match those platforms — do not swap them for
  design tokens. Component headers call this out.
- **Raster only.** SVG is rejected on intake (it can taint the canvas so
  `toDataURL()` throws). Keep the `ACCEPT*` rules in `lib/image.js`.
- **GIFs** decode but export as a static first frame; callers warn on them.
- **Accessibility matters here** — the crop editor has full keyboard control and
  live `aria-live` framing readouts, the mode switcher is a real `radiogroup`,
  and contrast is checked. Preserve these when editing UI.
- `scripts/gen-og.mjs` runs under plain `node` (outside the Vite `@` alias) and
  keeps its own tiny `hexToRgb` copy on purpose — don't couple it to `src/`.
