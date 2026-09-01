# Stream Asset Previewer - Crop & Ship Twitch and Discord Emotes

Stream Asset Previewer is a single-page browser tool for prepping streamer
chat assets. Drop one image, crop it square in an interactive editor, and it
rasterizes to every size Twitch and Discord expect, flags anything that
breaks the rules, previews it inside faithful mock chat, and hands you
download-ready PNGs. No image is ever uploaded - the cropping and resizing
all run on a canvas in your browser.

Design it once. Ship every size.

## Features

- **Two platforms, four asset types** - Twitch emotes (28 / 56 / 112) and
  sub/event badges (18 / 36 / 72, three separate files), plus Discord emoji
  (48 / 128) and stickers (160 / 320).
- **Interactive square crop** - drag to move, scroll or slide to zoom, or use
  the keyboard (arrows pan, `+` / `-` zoom). Fit, Fill, and Center presets and
  rule-of-thirds guides show exactly what will be kept.
- **Showcase builder** - a second view that sorts a whole emote set into each
  Twitch tier or Discord boost-level slot, tracks slot caps, and bakes one
  branded advertising PNG for a Discord post, panel, or tweet.
- **Load from a Twitch channel** - sign in with your Twitch account (OAuth) and
  pull a channel's current sub emotes into their tiers via Twitch's official
  Helix API, so you don't re-upload what you already have. Optional: only shown
  when the site is built with a Twitch application client-id.
- **Spec warnings** - flags an upscaled crop, a GIF exported as a static PNG
  (first frame only), and any file over the platform's byte cap.
- **File weight per size** - every generated PNG shows its KB so you stay under
  the cap.
- **Live chat preview** - see the asset inline in a mock Twitch or Discord chat
  line, with editable channel, username, name color, and message; a nudge warns
  when the chosen username color is low-contrast on the dark panel.
- **One-click download** - per size, or download all.
- **Guided next steps** - an in-app checklist walks you through the upload flow
  for the platform you're targeting.
- **100% client-side** - no image upload, no backend. (The optional "Load from
  channel" feature signs you in to Twitch via OAuth and calls Twitch's Helix API
  from your browser; the token stays in this tab and no secret is shipped.)

## Getting Started

1. Open the live tool: <https://mrdemonwolf.github.io/stream-asset-preview/>
2. Pick a view: **Crop one** asset or **Build a showcase**.
3. Choose a **Platform** (Twitch or Discord) and an **asset type**.
4. Drop in an image (any size), crop it square, and review the generated sizes
   and any warnings.
5. Download per size or all at once, then follow the **Next steps** panel to
   upload on the platform.

## Usage

| Step           | What happens                                                      |
| -------------- | ----------------------------------------------------------------- |
| Choose a view  | Crop one asset, or build a showcase of a whole set                |
| Pick platform  | Twitch (emote / badge) or Discord (emoji / sticker)               |
| Drop an image  | Crop it square in the editor - drag, zoom, or Fit / Fill / Center |
| Read warnings  | Upscaled crop, GIF exported as static PNG, or over the byte cap   |
| Download       | Per size, or "Download all"                                       |
| Tweak the chat | Edit channel / username / name color / message                    |
| Ship it        | Follow the in-app steps to the platform's dashboard               |

Specs this tool targets:

- **Twitch emote**: square, transparent PNG at 28 / 56 / 112, under 1 MB each.
  You upload the 112.
- **Twitch sub / event badge**: three separate square, non-animated PNG files -
  18x18, 36x36 and 72x72 - each under 25 KB. Twitch does not generate the smaller
  sizes for you; upload all three.
- **Discord emoji**: PNG up to 128x128, under 256 KB.
- **Discord sticker**: 320x320 PNG, under 512 KB.

## Tech Stack

| Layer      | Technology                                                 |
| ---------- | ---------------------------------------------------------- |
| Framework  | React 19                                                   |
| Build      | Vite 6                                                     |
| Styling    | Tailwind CSS v4                                            |
| Components | shadcn/ui (new-york), Radix UI                             |
| Imaging    | HTML Canvas API                                            |
| Icons      | lucide-react                                               |
| Fonts      | Bricolage Grotesque, JetBrains Mono                        |
| Tooling    | ESLint, Prettier, TypeScript (checkJs), Vitest, Playwright |
| Hosting    | GitHub Pages (GitHub Actions)                              |

## Development

### Prerequisites

- Node.js 24+
- npm

### Setup

1. Clone the repository:

   ```bash
   git clone https://github.com/mrdemonwolf/stream-asset-preview.git
   cd stream-asset-preview
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Start the dev server:

   ```bash
   npm run dev
   ```

### Development Scripts

- `npm run dev` - start Vite in dev mode.
- `npm run build` - build the static site to `dist/`.
- `npm run preview` - serve the production build locally.
- `npm run lint` - run ESLint over the project.
- `npm run format` - format the project with Prettier (`format:check` to verify).
- `npm run typecheck` - type-check the `src/lib/` helpers with `tsc` (checkJs).
- `npm test` - run the Vitest unit tests for the `lib/` helpers (specs, validation,
  crop math, canvas/abort handling, and the Twitch OAuth + API layer).
- `npm run e2e` - run the Playwright browser tests: crop and badge flows, content
  rejection, slot caps, animation policy, showcase export and keyboard nav.
  First run: `npx playwright install chromium`.
- `node scripts/gen-og.mjs` - regenerate the 1200x630 social card
  (`public/og.png`); only needed if the brand mark changes.

### Optional: Load from channel (Twitch OAuth)

The "Load from channel" feature is hidden unless the site is built with a Twitch
application client-id. To enable it, register a Twitch app (Confidential is not
required - this uses the public OAuth Implicit flow with **no secret**), add
`<origin>/stream-asset-preview/` (and your dev origin) as an OAuth Redirect URL,
and build with `VITE_TWITCH_CLIENT_ID=<your-client-id>`.

### Code Quality

- No runtime CDN dependencies - React, Tailwind, and fonts are all bundled.
- Content-sniffed, raster-only image intake (SVG and mislabeled files rejected)
  with size/dimension/pixel/count ceilings, so a bad upload can't taint the
  canvas or exhaust memory.
- A restrictive Content-Security-Policy and Referrer-Policy ship with the build.
- Pure functions in `src/lib/` are unit-tested and type-checked; ESLint, Prettier
  (`format:check`), `tsc`, Vitest, Playwright and the build all run on every PR
  (`.github/workflows/ci.yml`) and before each deploy.
- Pure static output deployable to any static host.

## Project Structure

```text
stream-asset-preview/
├── .github/
│   ├── workflows/       # ci.yml (PR checks) + deploy.yml (Pages), SHA-pinned
│   └── dependabot.yml   # weekly npm + actions updates
├── e2e/                 # Playwright smoke tests
├── public/              # favicon, og.png, robots.txt, sitemap.xml
├── scripts/             # gen-og.mjs (one-shot social card)
├── src/
│   ├── components/      # CropStage, ChatPreview, DiscordPreview, Showcase, ui/
│   ├── hooks/           # useFileDrop (shared drag-drop plumbing)
│   ├── lib/             # specs (single source of truth), validate, resize,
│   │                    #   exportGrid, twitch, image, color, utils
│   ├── App.jsx          # the two-view single-page tool
│   └── index.css        # Tailwind theme + brand tokens
├── index.html           # SEO meta, Open Graph, JSON-LD
├── tsconfig.json        # checkJs type-check gate for src/lib
└── vite.config.js       # base path + React/Tailwind plugins + build-time CSP
```

## License

[![GitHub license](https://img.shields.io/github/license/mrdemonwolf/stream-asset-preview.svg?style=for-the-badge&logo=github)](https://github.com/mrdemonwolf/stream-asset-preview/blob/main/LICENSE)

## Contact

Have a question or some feedback?

- Discord: [Join my server](https://mrdwolf.net/discord)
- Web: [mrdemonwolf.com](https://www.mrdemonwolf.com)

Made with love by [MrDemonWolf, Inc.](https://www.mrdemonwolf.com)
