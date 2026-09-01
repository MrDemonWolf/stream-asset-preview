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

- React 19 + JSX (no TypeScript — `jsconfig.json`, `@/*` → `src/*`). Type safety
  comes from `tsc --noEmit` in **checkJs** mode over `src/lib` (`tsconfig.json`) +
  JSDoc, not `.ts` files. Node 24+ (`engines`), npm (`packageManager`).
- Vite 6 (`vite.config.js`; base path `/stream-asset-preview/` for GitHub Pages;
  a build-only plugin injects the production CSP meta)
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
- `npm run typecheck` — `tsc --noEmit` (checkJs over `src/lib`)
- `npm test` — Vitest over `src/lib/`. Node env by default; DOM-dependent files
  opt in with a `// @vitest-environment jsdom` docblock (`twitch.test.js`,
  `canvas.test.js`).
- `npm run e2e` — Playwright in `e2e/` (needs `npx playwright install chromium`
  once). `e2e/helpers.js` generates real PNG/GIF/decoy files in the page so the
  full sniff → decode → validate path runs.
- `node scripts/gen-og.mjs` — regenerate `public/og.png` (only if the brand mark
  changes)

CI: `.github/workflows/ci.yml` runs npm audit + lint + format:check + typecheck +
test + build + e2e on every PR; `deploy.yml` runs lint + format:check + typecheck

- test + build before deploying to GitHub Pages on push to `main`. Both pin
  actions to commit SHAs; Dependabot (`.github/dependabot.yml`) batches minor/patch.

## Architecture

- `src/App.jsx` — the two-view shell. It imports `SPECS` and `CROP_PLATFORMS`
  from `src/lib/specs.js` (the single source of truth); it no longer defines its
  own spec tables. View 1 is the crop-and-export flow.
- `src/components/CropStage.jsx` — interactive square crop editor (pointer +
  keyboard + wheel). The crop is `{ x, y, size }` in source pixels, owned by the
  parent; the stage reports changes through `onChange`.
- `src/components/Showcase.jsx` — view 2: sort an emote set into tier/boost
  slots and export one grid PNG.
- `src/components/{ChatPreview,DiscordPreview}.jsx` — faithful mock chat lines.
- `src/lib/` — the shared logic:
  - `specs.js` — **the single authoritative spec module.** All dimensions, byte
    caps, formats, animation policy, preview sizes, upload requirements, the
    Twitch slot model (independent static/animated milestones + full partner
    table), Discord boost levels, help URLs and step copy. App/Showcase/exportGrid
    all derive from it. There is no more `platforms.js`.
  - `validate.js` — content-based image validation: magic-byte `sniff` (format +
    animated: APNG/animated-GIF/animated-WEBP), `validateIntake` (safe ceilings),
    `validateForSection` (animation policy), and the intake limit constants.
  - `resize.js` — canvas crop/resize primitives + `loadImage` (timeout/abort),
    null-context guards, `canvasToBlob`/`downloadBlob`, `safeFilename`,
    `assertCanvasSize`.
  - `exportGrid.js` — bakes the showcase into one branded PNG (adaptive dpr +
    size cap, text truncation, blob output, throws on canvas failure).
  - `twitch.js` — Twitch **Helix** emote lookup behind OAuth Implicit auth
    (`VITE_TWITCH_CLIENT_ID`; `twitchConfigured` hides the feature when unset). No
    secret, token in sessionStorage.
  - `image.js` — filename/MIME intake predicates (`isRasterImage`, `isGif`,
    `stripExt`, `ACCEPT*`); real trust decisions go through `validate.js`.
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
- **Raster only, content-sniffed.** SVG and mislabeled files are rejected — the
  real check is `validate.js` `sniff` (magic bytes), not the extension/MIME
  predicates in `image.js`. Keep them in sync.
- **Twitch badges are three separate files (18/36/72), each ≤25 KB** — there is
  no "120px single upload / Twitch generates the rest". Badge/emote/emoji/sticker
  numbers all live in `specs.js`; never hardcode a size or cap elsewhere.
- **Twitch slot model:** Tier-1 static and animated pools grow independently at
  their own sub-point milestones (`specs.js` `TWITCH_SLOTS`); numbers are
  documented seeds and user-overridable in the UI.
- **GIFs** decode but export as a static first frame; callers warn on them.
- **Accessibility matters here** — the crop editor has full keyboard control and
  live `aria-live` framing readouts, the mode switcher is a real `radiogroup`,
  and contrast is checked. Preserve these when editing UI.
- `scripts/gen-og.mjs` runs under plain `node` (outside the Vite `@` alias) and
  keeps its own tiny `hexToRgb` copy on purpose — don't couple it to `src/`.
