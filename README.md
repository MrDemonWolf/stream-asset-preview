# Stream Asset Previewer - Resize Twitch Badges & Emotes

Stream Asset Previewer is a single-page browser tool for prepping Twitch
chat badges and event/sub badges and emotes. Drop one image at any size and
it auto-resizes to Twitch's exact specs, flags anything that breaks the
rules, previews it in a real chat line, and hands you download-ready PNGs.
Nothing is ever uploaded - it all runs in your browser.

Design it once. Ship every size.

## Features

- **Badge or emote** - one toggle switches the target spec and preview.
- **Any size in, Twitch sizes out** - badges export 18 / 36 / 72 plus a
  120px upload file; emotes export 28 / 56 / 112. Resized on an HTML canvas.
- **Spec warnings** - flags non-square sources, upscaling, animated badges,
  and files over Twitch's limit (25KB per badge, 1MB per emote).
- **File weight per size** - every generated PNG shows its KB so you stay
  under the cap.
- **Live chat preview** - see the badge beside a username or the emote inline
  in a mock Twitch chat, with editable channel, username, color, and message.
- **One-click download** - per size or download all.
- **Guided next steps** - an in-app checklist walks you through the Twitch
  Creator Dashboard upload flow.
- **100% client-side** - no upload, no sign-up, no backend.

## Getting Started

1. Open the live tool: <https://mrdemonwolf.github.io/stream-asset-preview/>
2. Pick **Badge** or **Emote**.
3. Drop in an image (any size, square recommended).
4. Review the generated sizes and any warnings, then download.
5. Follow the **Next steps** panel to upload on Twitch.

## Usage

| Step            | What happens                                              |
| --------------- | --------------------------------------------------------- |
| Choose type     | Badge (18/36/72 + 120 upload) or Emote (28/56/112)        |
| Drop an image   | Auto-resized on canvas to the spec, letterboxed if needed |
| Read warnings   | Non-square, upscaled, animated, or over the size cap      |
| Download        | Per size, or "Download all"                               |
| Tweak the chat  | Edit channel / username / name color / message            |
| Ship it         | Follow the in-app steps to the Twitch dashboard           |

Twitch specs this tool targets:

- **Event / sub badge**: one square, non-animated PNG, at least 120×120, under
  25KB. Twitch generates the 18 / 36 / 72 chat sizes.
- **Emote**: square PNG, transparent, under 1MB, at 28 / 56 / 112.

## Tech Stack

| Layer      | Technology                          |
| ---------- | ----------------------------------- |
| Framework  | React 19                            |
| Build      | Vite 6                              |
| Styling    | Tailwind CSS v4                     |
| Components | shadcn/ui (new-york), Radix UI      |
| Resizing   | HTML Canvas API                     |
| Icons      | lucide-react                        |
| Fonts      | Bricolage Grotesque, JetBrains Mono |
| Hosting    | GitHub Pages (GitHub Actions)       |

## Development

### Prerequisites

- Node.js 20+
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
- `node scripts/gen-og.mjs` - regenerate the 1200×630 social card
  (`public/og.png`); only needed if the brand mark changes.

### Code Quality

- No runtime CDN dependencies - React, Tailwind, and fonts are all bundled.
- Raster-only image intake (SVG rejected) to avoid canvas tainting.
- Pure static output deployable to any static host.

## Project Structure

```text
stream-asset-preview/
├── .github/workflows/   # GitHub Pages deploy workflow
├── public/              # favicon, og.png, robots.txt, sitemap.xml
├── scripts/             # gen-og.mjs (one-shot social card)
├── src/
│   ├── components/      # ChatPreview, ui/ (shadcn primitives)
│   ├── lib/             # resize (canvas), utils
│   ├── App.jsx          # the single-page tool
│   └── index.css        # Tailwind theme + brand tokens
├── index.html           # SEO meta, Open Graph, JSON-LD
└── vite.config.js       # base path + React/Tailwind plugins
```

## License

![GitHub license](https://img.shields.io/github/license/mrdemonwolf/stream-asset-preview.svg?style=for-the-badge&logo=github)

## Contact

Have a question or some feedback?

- Discord: [Join my server](https://mrdwolf.net/discord)
- Web: [mrdemonwolf.com](https://www.mrdemonwolf.com)

Made with love by [MrDemonWolf, Inc.](https://www.mrdemonwolf.com)
