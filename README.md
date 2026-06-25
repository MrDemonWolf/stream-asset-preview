# Stream Asset Previewer - Badges & Emotes at Every Broadcast Size

Stream Asset Previewer is a static web tool for previewing Twitch-style
chat badges and emotes at the exact pixel sizes they ship at. It auto-scans
the served `badges/` and `emotes/` folders, or lets you drag a folder
straight into the browser - nothing is ever uploaded. Built for streamers
and channel designers checking how their art holds up small.

See it crisp before it ever hits chat.

## Features

- **Real broadcast sizes** - badges render at 18 / 36 / 72px and emotes at
  28 / 56 / 112px, side by side, so you judge legibility at the size viewers
  actually see.
- **Tabbed browsing** - separate Badges and Emotes tabs, each with a live
  count.
- **Live search** - filter by asset name or emote code as you type.
- **Auto-scan** - a build-time manifest lists every asset, so the deployed
  site loads your committed art automatically.
- **Drag-and-drop fallback** - drop a folder (or pick one) to preview local
  assets with no server and no upload; files stay in your browser.
- **Copy to clipboard** - one click copies a badge name or emote code.
- **Transparency-aware** - a checkerboard backing keeps transparent edges
  legible at every size.

## Getting Started

1. Clone the repository and install dependencies (see Development below).
2. Drop your art under `public/badges/<name>/<size>.png` and
   `public/emotes/<code>/<size>.png`.
3. Run `npm run dev` and open the local URL.
4. Or skip setup entirely and drag a folder of assets onto the page.

## Usage

Assets follow a simple folder convention:

```text
public/
  badges/
    moderator/
      18.png
      36.png
      72.png
  emotes/
    wolfHype/
      28.png
      56.png
      112.png
    pogChamp.png        # a single file is auto-scaled to all sizes
```

| Action            | How                                                      |
| ----------------- | ------------------------------------------------------- |
| Preview committed | Run the app while served; assets load from the manifest |
| Preview local     | Drag a folder onto the page, or use "Choose folder"     |
| Filter            | Type a name or code into the search box                 |
| Copy a name       | Click "Copy" on any card                                |

Live site: <https://mrdemonwolf.github.io/stream-asset-preview/>

## Tech Stack

| Layer     | Technology                          |
| --------- | ----------------------------------- |
| Framework | React 19                            |
| Build     | Vite 6                              |
| Styling   | Tailwind CSS v4                     |
| Components| shadcn/ui (new-york), Radix UI      |
| Icons     | lucide-react                        |
| Fonts     | Bricolage Grotesque, JetBrains Mono |
| Hosting   | GitHub Pages (GitHub Actions)       |

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

- `npm run dev` - regenerate the asset manifest and start Vite in dev mode.
- `npm run build` - regenerate the manifest and build the static site to `dist/`.
- `npm run preview` - serve the production build locally.
- `npm run manifest` - scan `public/badges` and `public/emotes` and write
  `public/manifest.json`.

### Code Quality

- No runtime CDN dependencies - React, Tailwind, and fonts are all bundled.
- Pure static output deployable to any static host.
- Single shared `AssetCard` renders both badges and emotes.

## Project Structure

```text
stream-asset-preview/
├── .github/workflows/   # GitHub Pages deploy workflow
├── public/              # static assets scanned into the manifest
│   ├── badges/          # badges/<name>/<size>.png
│   └── emotes/          # emotes/<code>/<size>.png
├── scripts/             # gen-manifest.mjs (build-time auto-scan)
├── src/
│   ├── components/      # AssetCard, DropZone, ui/ (shadcn primitives)
│   ├── lib/             # loadAssets, clipboard, utils
│   ├── App.jsx          # tabs, search, data sources
│   └── index.css        # Tailwind theme + brand tokens
├── index.html
└── vite.config.js       # base path + React/Tailwind plugins
```

## License

![GitHub license](https://img.shields.io/github/license/mrdemonwolf/stream-asset-preview.svg?style=for-the-badge&logo=github)

## Contact

Have a question or some feedback?

- Discord: [Join my server](https://mrdwolf.net/discord)
- Web: [mrdemonwolf.com](https://www.mrdemonwolf.com)

Made with love by [MrDemonWolf, Inc.](https://www.mrdemonwolf.com)
