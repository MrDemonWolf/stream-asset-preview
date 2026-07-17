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
  event/sub badges (18 / 36 / 72 / 120), plus Discord emoji (48 / 128) and
  stickers (160 / 320).
- **Interactive square crop** - drag to move, scroll or slide to zoom, or use
  the keyboard (arrows pan, `+` / `-` zoom). Fit, Fill, and Center presets and
  rule-of-thirds guides show exactly what will be kept.
- **Showcase builder** - a second view that sorts a whole emote set into each
  Twitch tier or Discord boost-level slot, tracks slot caps, and bakes one
  branded advertising PNG for a Discord post, panel, or tweet.
- **Load from a Twitch channel** - pull a channel's current sub emotes by name
  into their tiers so you don't re-upload what you already have.
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
- **100% client-side** - no image upload, no sign-up, no backend. (The optional
  "Load from channel" feature sends only the channel name to Twitch's public
  API.)

## Getting Started

1. Open the live tool: <https://mrdemonwolf.github.io/stream-asset-preview/>
2. Pick a view: **Crop one** asset or **Build a showcase**.
3. Choose a **Platform** (Twitch or Discord) and an **asset type**.
4. Drop in an image (any size), crop it square, and review the generated sizes
   and any warnings.
5. Download per size or all at once, then follow the **Next steps** panel to
   upload on the platform.

## Usage

| Step             | What happens                                                     |
| ---------------- | ---------------------------------------------------------------- |
| Choose a view    | Crop one asset, or build a showcase of a whole set               |
| Pick platform    | Twitch (emote / badge) or Discord (emoji / sticker)              |
| Drop an image    | Crop it square in the editor - drag, zoom, or Fit / Fill / Center |
| Read warnings    | Upscaled crop, GIF exported as static PNG, or over the byte cap  |
| Download         | Per size, or "Download all"                                      |
| Tweak the chat   | Edit channel / username / name color / message                   |
| Ship it          | Follow the in-app steps to the platform's dashboard              |

Specs this tool targets:

- **Twitch emote**: square, transparent PNG at 28 / 56 / 112, under 1 MB each.
  You upload the 112.
- **Twitch event / sub badge**: one square, non-animated PNG, at least 120x120
  and under 25 KB. Twitch generates the 18 / 36 / 72 chat sizes.
- **Discord emoji**: PNG up to 128x128, under 256 KB.
- **Discord sticker**: 320x320 PNG, under 512 KB.

## Tech Stack

| Layer      | Technology                          |
| ---------- | ----------------------------------- |
| Framework  | React 19                            |
| Build      | Vite 6                              |
| Styling    | Tailwind CSS v4                     |
| Components | shadcn/ui (new-york), Radix UI      |
| Imaging    | HTML Canvas API                     |
| Icons      | lucide-react                        |
| Fonts      | Bricolage Grotesque, JetBrains Mono |
| Tooling    | ESLint, Prettier, Vitest            |
| Hosting    | GitHub Pages (GitHub Actions)       |

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
- `npm test` - run the Vitest unit tests for the `lib/` helpers.
- `node scripts/gen-og.mjs` - regenerate the 1200x630 social card
  (`public/og.png`); only needed if the brand mark changes.

### Code Quality

- No runtime CDN dependencies - React, Tailwind, and fonts are all bundled.
- Raster-only image intake (SVG rejected) to avoid canvas tainting.
- Pure functions in `src/lib/` are unit-tested; ESLint and Prettier are wired
  into CI alongside the build.
- Pure static output deployable to any static host.

## Project Structure

```text
stream-asset-preview/
├── .github/workflows/   # lint + test + GitHub Pages deploy workflow
├── public/              # favicon, og.png, robots.txt, sitemap.xml
├── scripts/             # gen-og.mjs (one-shot social card)
├── src/
│   ├── components/      # CropStage, ChatPreview, DiscordPreview, Showcase, ui/
│   ├── hooks/           # useFileDrop (shared drag-drop plumbing)
│   ├── lib/             # resize, exportGrid, platforms, twitch, image, color, utils
│   ├── App.jsx          # the two-view single-page tool
│   └── index.css        # Tailwind theme + brand tokens
├── index.html           # SEO meta, Open Graph, JSON-LD
└── vite.config.js       # base path + React/Tailwind plugins
```

## License

[![GitHub license](https://img.shields.io/github/license/mrdemonwolf/stream-asset-preview.svg?style=for-the-badge&logo=github)](https://github.com/mrdemonwolf/stream-asset-preview/blob/main/LICENSE)

## Contact

Have a question or some feedback?

- Discord: [Join my server](https://mrdwolf.net/discord)
- Web: [mrdemonwolf.com](https://www.mrdemonwolf.com)

Made with love by [MrDemonWolf, Inc.](https://www.mrdemonwolf.com)
