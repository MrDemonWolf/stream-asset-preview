// Single-page, 100%-client-side tool. Two views switched by the top Segmented:
//   • "resize"  (this file) — drop one image, crop it square in CropStage, and
//     rasterize every platform size via lib/resize; live Twitch/Discord preview.
//   • "showcase" (components/Showcase) — organise a whole emote set into slots.
// No backend, no uploads: images are decoded to object URLs / canvas locally.
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Download, ExternalLink, ImagePlus, ListChecks, Radio, RotateCcw } from "lucide-react";

import { ChatPreview } from "@/components/ChatPreview";
import { CropStage } from "@/components/CropStage";
import { DiscordPreview } from "@/components/DiscordPreview";
import { Showcase } from "@/components/Showcase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { useFileDrop } from "@/hooks/useFileDrop";
import { hexToRgb } from "@/lib/color";
import { isRasterImage, stripExt } from "@/lib/image";
import { containCrop, cropToDataUrl, downloadDataUrl } from "@/lib/resize";
import { cn } from "@/lib/utils";

// Published asset specs — the sizes and limits this tool crops to. `upload` is
// the file you hand the platform; `chat` is the size shown in the preview.
// `maxBytes` is the per-file cap. Every export is a square PNG built from the
// crop, so animation is always dropped (we warn on GIF sources).
const SPECS = {
  emote: {
    platform: "twitch",
    label: "Emote",
    sizes: [28, 56, 112],
    upload: "112",
    chat: "28",
    maxBytes: 1024 * 1024,
    note: "Twitch emote: 28 / 56 / 112px PNG, transparent, square, under 1 MB each. The 112 is the one you upload.",
    guide: "https://help.twitch.tv/s/article/emote-guidelines",
  },
  badge: {
    platform: "twitch",
    label: "Badge",
    sizes: [18, 36, 72, 120],
    upload: "120",
    chat: "18",
    maxBytes: 25 * 1024,
    note: "Twitch event badge: upload one square, non-animated PNG, at least 120×120 and under 25 KB. Twitch generates the 18 / 36 / 72 chat sizes from it.",
    guide: "https://help.twitch.tv/s/article/subscriber-badge-guide",
  },
  demoji: {
    platform: "discord",
    label: "Emoji",
    sizes: [48, 128],
    upload: "128",
    chat: "128",
    maxBytes: 256 * 1024,
    note: "Discord emoji: upload up to 128×128 under 256 KB (PNG). Shows ~22px inline in chat.",
    guide: "https://support.discord.com/hc/en-us/articles/360036479811",
  },
  dsticker: {
    platform: "discord",
    label: "Sticker",
    sizes: [160, 320],
    upload: "320",
    chat: "320",
    maxBytes: 512 * 1024,
    note: "Discord sticker: 320×320 PNG under 512 KB. Shows ~160px in chat.",
    guide: "https://support.discord.com/hc/en-us/articles/360036479811",
  },
};

const PLATFORMS = {
  twitch: { label: "Twitch", assets: ["emote", "badge"], dashLabel: "Twitch" },
  discord: { label: "Discord", assets: ["demoji", "dsticker"], dashLabel: "Discord" },
};

export default function App() {
  const [view, setView] = useState("resize");
  const [mode, setMode] = useState("emote");
  const [img, setImg] = useState(null); // decoded HTMLImageElement
  const [srcUrl, setSrcUrl] = useState(null); // persistent object URL for display
  const [source, setSource] = useState(null); // { name, width, height, bytes, type }
  const [crop, setCrop] = useState(null); // { x, y, size } in source px
  const [out, setOut] = useState(null); // { files: {size:dataURL}, bytes: {size:n} }
  const [error, setError] = useState(null);
  const [announce, setAnnounce] = useState(""); // sr-only live status
  const [username, setUsername] = useState("MrDemonWolf");
  const [color, setColor] = useState("#00aced");
  const [channel, setChannel] = useState("mrdemonwolf");
  const [message, setMessage] = useState("test");

  const spec = SPECS[mode];
  const platform = spec.platform;
  // True once an image has ever loaded — lets replace() send focus back to the
  // dropzone (without autofocusing it on the very first page load).
  const hadImage = useRef(false);
  const dropRef = useRef(null);

  // Rasterize the crop into every target size — debounced so dragging stays
  // smooth (the editor itself gives live feedback; the PNGs catch up on pause).
  useEffect(() => {
    if (!img || !crop) {
      setOut(null);
      return;
    }
    let live = true;
    const id = setTimeout(() => {
      if (!live) return;
      const files = {};
      const bytes = {};
      for (const size of spec.sizes) {
        const { dataUrl, bytes: b } = cropToDataUrl(img, crop, size);
        files[String(size)] = dataUrl;
        bytes[String(size)] = b;
      }
      setOut({ files, bytes });
    }, 80);
    return () => {
      live = false;
      clearTimeout(id);
    };
  }, [img, crop, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  async function take(files) {
    const file = Array.from(files ?? []).find(isRasterImage);
    if (!file) {
      setError("Use a PNG, GIF, JPG, or WEBP image.");
      return;
    }
    // One object URL, kept alive for both the decode and the on-screen <img>
    // (revoked in replace() / on the next upload) so the crop editor can display
    // the source. Canvas rasterization reuses the same decoded bitmap.
    const url = URL.createObjectURL(file);
    try {
      const image = await new Promise((res, rej) => {
        const i = new Image();
        i.onload = () => res(i);
        i.onerror = () => rej(new Error("decode failed"));
        i.src = url;
      });
      setError(null);
      setSrcUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
      setImg(image);
      setSource({
        name: stripExt(file.name),
        width: image.naturalWidth,
        height: image.naturalHeight,
        bytes: file.size,
        type: file.type,
      });
      setCrop(containCrop(image)); // start showing the whole image, nothing lost
      hadImage.current = true;
      setAnnounce("Image loaded. Crop editor ready.");
    } catch {
      URL.revokeObjectURL(url);
      setError("Could not read that image.");
    }
  }

  function replace() {
    if (srcUrl) URL.revokeObjectURL(srcUrl);
    setSrcUrl(null);
    setImg(null);
    setSource(null);
    setCrop(null);
    setOut(null);
    setAnnounce("Image removed. Upload another to start again.");
    // Send focus back to the dropzone so keyboard users aren't stranded on <body>.
    requestAnimationFrame(() => dropRef.current?.focus());
  }

  const warnings = specWarnings({ crop, out, source, spec });

  const HEADINGS = {
    resize: {
      h1: "Crop any image to a Twitch or Discord emote.",
      sub: "Drop a sticker or drawing, drag and zoom to frame it, and see exactly what makes the cut. Export every size for Twitch emotes & badges or Discord emoji & stickers. Nothing leaves your browser.",
    },
    showcase: {
      h1: "Build an emote showcase.",
      sub: "Drop your whole set — sorted into Twitch tiers or Discord boost-level slots, so you know exactly where each one uploads. Preview PNGs and GIFs, then export one image to advertise the lot. Nothing leaves your browser.",
    },
  };
  const head = HEADINGS[view];

  return (
    <div className="mx-auto min-h-dvh max-w-5xl px-5 pb-12 pt-6 sm:px-8">
      <a
        href="#main"
        className="sr-only rounded-md bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50"
      >
        Skip to content
      </a>

      <header className="mb-6 text-center">
        <div className="mb-4 flex items-center justify-center gap-2">
          <Radio className="size-4 text-primary-text" aria-hidden="true" />
          <span className="u-label">Stream Asset Previewer</span>
        </div>

        {/* View switcher — the primary decision, first interactive element,
            deliberately larger/distinct from the config toggles below. */}
        <Segmented
          label="Tool"
          value={view}
          onChange={setView}
          size="lg"
          options={[
            ["resize", "Crop one"],
            ["showcase", "Build a showcase"],
          ]}
          className="mx-auto flex w-full max-w-md"
        />

        <h1 className="mx-auto mt-6 max-w-2xl font-display text-3xl font-bold tracking-tight text-foreground text-balance sm:text-4xl">
          {head.h1}
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground text-pretty sm:text-base">
          {head.sub}
        </p>
      </header>

      <main id="main">
        {view === "showcase" && <Showcase />}

        {view === "resize" && (
          <>
            {/* Config strip — Platform + Asset type, both captioned, set apart
                from the view switcher by a bordered console panel + divider. */}
            <div className="panel mb-6 flex flex-col items-center gap-4 p-4 sm:flex-row sm:justify-center sm:gap-8">
              <Segmented
                label="Platform"
                showLabel
                value={platform}
                options={Object.entries(PLATFORMS).map(([k, p]) => [k, p.label])}
                onChange={(p) => setMode(PLATFORMS[p].assets[0])}
              />
              <div className="hidden h-10 w-px self-end bg-border sm:block" aria-hidden="true" />
              <Segmented
                label="Asset type"
                showLabel
                value={mode}
                options={PLATFORMS[platform].assets.map((k) => [k, SPECS[k].label])}
                onChange={setMode}
              />
            </div>

            <p className="mx-auto mb-6 max-w-2xl text-center text-xs text-muted-foreground sm:text-sm">
              {spec.note}
            </p>

            <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
              {/* Left: upload / crop editor + generated sizes */}
              <section aria-label="Source and generated sizes" className="space-y-6">
                <div className="panel p-4">
                  {!img ? (
                    <Dropzone spec={spec} onFiles={take} buttonRef={dropRef} />
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-mono text-sm text-foreground">{source.name}</p>
                          <p className="text-xs text-muted-foreground">
                            source {source.width}×{source.height}px · {fmtBytes(source.bytes)}
                          </p>
                        </div>
                        <Button size="sm" variant="ghost" onClick={replace}>
                          <RotateCcw /> Replace
                        </Button>
                      </div>

                      <CropStage img={img} src={srcUrl} crop={crop} onChange={setCrop} autoFocus />
                    </div>
                  )}
                </div>

                {error && (
                  <p role="alert" className="flex items-center gap-2 text-sm text-destructive-text">
                    <AlertTriangle className="size-4 shrink-0" aria-hidden="true" /> {error}
                  </p>
                )}

                {warnings.length > 0 && (
                  <ul
                    role="status"
                    aria-live="polite"
                    className="space-y-1 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-foreground"
                  >
                    {warnings.map((w) => (
                      <li key={w} className="flex items-start gap-2">
                        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive-text" aria-hidden="true" />
                        <span>{w}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {out && <SizeGrid spec={spec} out={out} name={source.name} />}

                {out && <NextSteps mode={mode} spec={spec} />}
              </section>

              {/* Right: live preview + controls */}
              <section aria-label="Preview" className="space-y-4">
                {platform === "twitch" ? (
                  <>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <Field label="Channel">
                        <Input value={channel} onChange={(e) => setChannel(e.target.value)} className="font-mono" />
                      </Field>
                      <Field label="Username">
                        <Input value={username} onChange={(e) => setUsername(e.target.value)} className="font-mono" />
                      </Field>
                      <div role="group" aria-label="Name color" className="block space-y-1.5">
                        <span className="u-label block">Name color</span>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={color}
                            onChange={(e) => setColor(e.target.value)}
                            className="size-11 shrink-0 cursor-pointer rounded-md border border-input bg-transparent sm:size-9"
                            aria-label="Name color picker"
                          />
                          <Input
                            value={color}
                            onChange={(e) => setColor(e.target.value)}
                            className="font-mono"
                            aria-label="Name color hex value"
                          />
                        </div>
                        {lowContrast(color) && (
                          <p className="text-xs text-warning-text">
                            Low contrast on dark chat — hard to read.
                          </p>
                        )}
                      </div>
                      <Field label="Message">
                        <Input value={message} onChange={(e) => setMessage(e.target.value)} />
                      </Field>
                    </div>

                    <ChatPreview
                      mode={mode}
                      channel={channel}
                      username={username}
                      color={color}
                      badgeUrl={out?.files[spec.chat]}
                      emoteUrl={out?.files[spec.chat]}
                      message={message}
                    />
                  </>
                ) : (
                  <>
                    <Field label="Username">
                      <Input value={username} onChange={(e) => setUsername(e.target.value)} className="font-mono" />
                    </Field>
                    <DiscordPreview kind={mode} url={out?.files[spec.upload]} username={username} />
                  </>
                )}
              </section>
            </div>
          </>
        )}
      </main>

      <p aria-live="polite" className="sr-only">
        {announce}
      </p>

      <Footer />
    </div>
  );
}

function Dropzone({ spec, onFiles, buttonRef }) {
  const { isOver, dropHandlers, open, inputProps } = useFileDrop(onFiles);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={open}
        {...dropHandlers}
        className={cn(
          "flex w-full flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border px-6 py-14 text-center transition-all duration-150 hover:border-primary/60 outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring",
          isOver && "scale-[0.99] border-primary bg-primary/5",
        )}
      >
        <span className="flex size-12 items-center justify-center rounded-full bg-primary/15 text-primary-text">
          <ImagePlus className="size-6" />
        </span>
        <span className="font-display font-medium text-foreground">
          Drop your {spec.label.toLowerCase()} here, or click to upload
        </span>
        <span className="text-xs text-muted-foreground">
          Any size — you'll crop it to {spec.sizes.join(" / ")}px
        </span>
      </button>
      <input {...inputProps} />
    </>
  );
}

function SizeGrid({ spec, out, name }) {
  const uploadDest = spec.platform === "twitch" ? "Twitch" : "Discord";
  return (
    <div className="panel space-y-3 p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold text-foreground">Export sizes</h2>
        <Button
          onClick={() =>
            spec.sizes.forEach((s) => downloadDataUrl(out.files[String(s)], `${name}-${s}.png`))
          }
        >
          <Download /> Download all
        </Button>
      </div>
      <div className="checker flex flex-wrap items-end justify-center gap-x-6 gap-y-4 rounded-lg px-4 py-6">
        {spec.sizes.map((size) => {
          const isUpload = String(size) === spec.upload;
          const display = Math.min(size, 160);
          return (
            <div key={size} className="flex flex-col items-center gap-1.5">
              <img
                src={out.files[String(size)]}
                alt={`${name} at ${size}px`}
                width={display}
                height={display}
                className={size < 96 ? "pixelated" : undefined}
                style={{ width: display, height: display }}
              />
              <span className="font-mono text-xs text-muted-foreground">
                {size}px · {fmtBytes(out.bytes[String(size)])}
              </span>
              {isUpload && (
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-primary-text">
                  Upload to {uploadDest}
                </span>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="px-3 text-xs"
                onClick={() => downloadDataUrl(out.files[String(size)], `${name}-${size}.png`)}
                aria-label={`Download ${size}px PNG`}
              >
                <Download /> PNG
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Footer() {
  return (
    <footer className="mt-16 border-t border-border pt-8 text-center text-xs text-muted-foreground">
      <p className="mx-auto max-w-xl">
        Not affiliated with, endorsed by, or sponsored by Twitch or Discord. Asset
        specs may change — always confirm against the official{" "}
        <a
          href="https://help.twitch.tv/s/article/subscriber-badge-guide"
          target="_blank"
          rel="noreferrer"
          className="font-medium text-foreground underline-offset-2 hover:underline"
        >
          Twitch
        </a>{" "}
        and{" "}
        <a
          href="https://support.discord.com/hc/en-us/articles/360036479811"
          target="_blank"
          rel="noreferrer"
          className="font-medium text-foreground underline-offset-2 hover:underline"
        >
          Discord
        </a>{" "}
        guidelines.
      </p>
      <nav className="mt-4 flex items-center justify-center gap-4">
        <a href="https://www.mrdemonwolf.com" target="_blank" rel="noreferrer" className="hover:text-foreground">
          mrdemonwolf.com
        </a>
        <span aria-hidden="true">·</span>
        <a href="https://mrdwolf.net/discord" target="_blank" rel="noreferrer" className="hover:text-foreground">
          Discord
        </a>
        <span aria-hidden="true">·</span>
        <a href="https://github.com/mrdemonwolf/stream-asset-preview" target="_blank" rel="noreferrer" className="hover:text-foreground">
          GitHub
        </a>
      </nav>
      <p className="mt-4">
        © {new Date().getFullYear()} Made with love by{" "}
        <a href="https://www.mrdemonwolf.com" target="_blank" rel="noreferrer" className="font-medium text-primary-text hover:underline">
          MrDemonWolf, Inc.
        </a>
        {__COMMIT_HASH__ !== "dev" && (
          <>
            {" · "}
            <a
              href={`https://github.com/mrdemonwolf/stream-asset-preview/commit/${__COMMIT_HASH__}`}
              target="_blank"
              rel="noreferrer"
              className="font-mono hover:text-foreground"
            >
              {__COMMIT_HASH__}
            </a>
          </>
        )}
      </p>
    </footer>
  );
}

const STEPS = {
  badge: [
    "Download the 120px PNG above (the one tagged “Upload to Twitch”).",
    "Creator Dashboard → Viewer Rewards → Badges → Create Event.",
    "Upload it: square PNG, not animated, ≤25 KB, at least 120×120.",
    "Set Badge Name (≤25 chars), Subscription Count (1–5), and Badge Description.",
    "Pick Start/End dates (≤28 days). Optionally enable a Watch Time reward with a second badge.",
  ],
  emote: [
    "Download the 28 / 56 / 112px PNGs above.",
    "Creator Dashboard → Viewer Rewards → Emotes.",
    "Upload each tier — emotes must be square PNG, transparent, under 1 MB.",
  ],
  demoji: [
    "Download the 128px PNG above (the one tagged “Upload to Discord”).",
    "Server Settings → Emoji → Upload Emoji.",
    "Pick the file, name it (2–32 chars, letters/numbers/underscores), and save.",
  ],
  dsticker: [
    "Download the 320px PNG above (the one tagged “Upload to Discord”).",
    "Server Settings → Stickers → Upload Sticker.",
    "Add it: 320×320 PNG under 512 KB, give it a name and a related emoji.",
  ],
};

const DASH = {
  twitch: { href: "https://dashboard.twitch.tv/", label: "Open Twitch Creator Dashboard" },
  discord: { href: "https://discord.com/channels/@me", label: "Open Discord" },
};

function NextSteps({ mode, spec }) {
  const dash = DASH[spec.platform];
  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
      <h3 className="mb-2 flex items-center gap-2 font-display text-base font-semibold text-foreground">
        <ListChecks className="size-4 text-primary-text" aria-hidden="true" />
        Next: add this to {PLATFORMS[spec.platform].dashLabel}
      </h3>
      <ol className="ml-1 list-inside list-decimal space-y-1 text-sm text-muted-foreground marker:text-primary-text">
        {STEPS[mode].map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      <a
        href={dash.href}
        target="_blank"
        rel="noreferrer"
        className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary-text hover:underline"
      >
        {dash.label} <ExternalLink className="size-3.5" aria-hidden="true" />
      </a>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block space-y-1.5">
      <span className="u-label block">{label}</span>
      {children}
    </label>
  );
}

// The dark chat panel the previews sit on — a baked copy of index.css `--card`.
// Keep in sync if that token moves (canvas/JS can't read CSS custom properties).
const CHAT_BG = "#18181b";

// Is the chosen username color hard to read on the dark chat panel? Flags
// anything below WCAG AA (4.5:1) so the user gets a nudge, not a block.
function lowContrast(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return false;
  const lin = (v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  const L = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
  const fg = L(rgb.map((v) => v / 255));
  const bg = L(hexToRgb(CHAT_BG).map((v) => v / 255));
  const ratio = (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
  return ratio < 4.5;
}

function specWarnings({ crop, out, source, spec }) {
  const list = [];
  if (!out || !crop || !source) return list;

  const largest = Math.max(...spec.sizes);
  if (crop.size < largest - 0.5) {
    list.push(
      `Your crop is ${Math.round(crop.size)}px across, but the largest export is ${largest}px — it's upscaled and may look soft. Zoom out or start from a bigger image.`,
    );
  }

  if (source.type === "image/gif") {
    list.push(
      "This is a GIF — the crop exports a static PNG (first frame only). Animation is dropped.",
    );
  }

  const uploadBytes = out.bytes[spec.upload];
  if (uploadBytes > spec.maxBytes) {
    list.push(
      `The ${spec.upload}px PNG is ${fmtBytes(uploadBytes)} — the cap is ${fmtBytes(spec.maxBytes)}. Simplify the art or reduce colors.`,
    );
  }
  return list;
}

function fmtBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10 * 1024 ? 1 : 0)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}
