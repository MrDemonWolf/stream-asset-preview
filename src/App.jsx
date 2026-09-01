// Single-page, 100%-client-side tool. Two views switched by the top Segmented:
//   • "resize"  (this file) — drop one image, crop it square in CropStage, and
//     rasterize every platform size via lib/resize; live Twitch/Discord preview.
//   • "showcase" (components/Showcase) — organise a whole emote set into slots.
// No backend, no uploads: images are decoded to object URLs / canvas locally.
import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Download,
  ExternalLink,
  ImagePlus,
  ListChecks,
  Radio,
  RotateCcw,
} from "lucide-react";

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
import { containCrop, cropToDataUrl, downloadDataUrl, loadImage, safeFilename } from "@/lib/resize";
import { CROP_PLATFORMS, DASH, GUIDES, SPECS } from "@/lib/specs";
import { captureTwitchRedirect } from "@/lib/twitch";
import { cn } from "@/lib/utils";
import { rejectionText, sniff, validateIntake } from "@/lib/validate";

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
  // Monotonic upload id + abort handle so an older, slower decode can never
  // overwrite a newer upload; `mounted` blocks setState after unmount.
  const uploadSeq = useRef(0);
  const abortRef = useRef(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    // Capture an OAuth redirect at the APP level, not inside Showcase: the app
    // opens on the crop view, so a Showcase-only handler would miss the token
    // (and leave it sitting in the URL fragment).
    captureTwitchRedirect();
    return () => {
      mounted.current = false;
      abortRef.current?.abort();
    };
  }, []);

  // Revoke the display object URL when it's replaced and on unmount.
  useEffect(() => {
    if (!srcUrl) return undefined;
    return () => URL.revokeObjectURL(srcUrl);
  }, [srcUrl]);

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
      try {
        const files = {};
        const bytes = {};
        for (const size of spec.sizes) {
          const { dataUrl, bytes: b } = cropToDataUrl(img, crop, size);
          files[String(size)] = dataUrl;
          bytes[String(size)] = b;
        }
        setOut({ files, bytes });
      } catch {
        setOut(null);
        setError("Couldn't render the crop — try a smaller image.");
      }
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
    // Claim this upload and cancel any older in-flight decode so a slow earlier
    // image can't win the race and overwrite this one.
    const seq = ++uploadSeq.current;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    const superseded = () => seq !== uploadSeq.current || !mounted.current;
    try {
      const buffer = await file.arrayBuffer();
      const info = sniff(buffer);
      const image = await loadImage(file, { signal: ac.signal });
      const { ok, reasons } = validateIntake(file, info, image);
      if (superseded()) return;
      if (!ok) {
        setError(rejectionText(file.name, reasons));
        return;
      }
      // A fresh display URL, revoked by the srcUrl effect on replace/unmount.
      const url = URL.createObjectURL(file);
      setError(null);
      setSrcUrl(url);
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
    } catch (e) {
      if (e?.name === "AbortError" || superseded()) return;
      setError("Could not read that image.");
    }
  }

  function replace() {
    // Invalidate any in-flight decode so it can't repopulate after we clear.
    uploadSeq.current++;
    abortRef.current?.abort();
    setSrcUrl(null); // effect revokes the old URL
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
                options={Object.entries(CROP_PLATFORMS).map(([k, p]) => [k, p.label])}
                onChange={(p) => setMode(CROP_PLATFORMS[p].assets[0])}
              />
              <div className="hidden h-10 w-px self-end bg-border sm:block" aria-hidden="true" />
              <Segmented
                label="Asset type"
                showLabel
                value={mode}
                options={CROP_PLATFORMS[platform].assets.map((k) => [k, SPECS[k].label])}
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
                          <p className="truncate font-mono text-sm text-foreground">
                            {source.name}
                          </p>
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
                        <AlertTriangle
                          className="mt-0.5 size-4 shrink-0 text-destructive-text"
                          aria-hidden="true"
                        />
                        <span>{w}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {out && <SizeGrid spec={spec} out={out} name={source.name} />}

                {out && <NextSteps spec={spec} />}
              </section>

              {/* Right: live preview + controls */}
              <section aria-label="Preview" className="space-y-4">
                {platform === "twitch" ? (
                  <>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <Field label="Channel">
                        <Input
                          value={channel}
                          onChange={(e) => setChannel(e.target.value)}
                          className="font-mono"
                        />
                      </Field>
                      <Field label="Username">
                        <Input
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          className="font-mono"
                        />
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
                      badgeUrl={out?.files[String(spec.previewSize)]}
                      emoteUrl={out?.files[String(spec.previewSize)]}
                      message={message}
                    />
                  </>
                ) : (
                  <>
                    <Field label="Username">
                      <Input
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="font-mono"
                      />
                    </Field>
                    <DiscordPreview
                      kind={mode}
                      url={out?.files[String(spec.previewSize)]}
                      username={username}
                    />
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
  const base = safeFilename(name);
  return (
    <div className="panel space-y-3 p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold text-foreground">Export sizes</h2>
        <Button
          onClick={() =>
            spec.sizes.forEach((s) => downloadDataUrl(out.files[String(s)], `${base}-${s}.png`))
          }
        >
          <Download /> Download all
        </Button>
      </div>
      <div className="checker flex flex-wrap items-end justify-center gap-x-6 gap-y-4 rounded-lg px-4 py-6">
        {spec.sizes.map((size) => {
          const isUpload = spec.requiredUploads.includes(size);
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
                onClick={() => downloadDataUrl(out.files[String(size)], `${base}-${size}.png`)}
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
        Not affiliated with, endorsed by, or sponsored by Twitch or Discord. Asset specs may change
        — always confirm against the official{" "}
        <a
          href={GUIDES.twitchBadge}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-foreground underline-offset-2 hover:underline"
        >
          Twitch
        </a>{" "}
        and{" "}
        <a
          href={GUIDES.discordEmoji}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-foreground underline-offset-2 hover:underline"
        >
          Discord
        </a>{" "}
        guidelines.
      </p>
      <nav className="mt-4 flex items-center justify-center gap-4">
        <a
          href="https://www.mrdemonwolf.com"
          target="_blank"
          rel="noreferrer"
          className="hover:text-foreground"
        >
          mrdemonwolf.com
        </a>
        <span aria-hidden="true">·</span>
        <a
          href="https://mrdwolf.net/discord"
          target="_blank"
          rel="noreferrer"
          className="hover:text-foreground"
        >
          Discord
        </a>
        <span aria-hidden="true">·</span>
        <a
          href="https://github.com/mrdemonwolf/stream-asset-preview"
          target="_blank"
          rel="noreferrer"
          className="hover:text-foreground"
        >
          GitHub
        </a>
      </nav>
      <p className="mt-4">
        © {new Date().getFullYear()} Made with love by{" "}
        <a
          href="https://www.mrdemonwolf.com"
          target="_blank"
          rel="noreferrer"
          className="font-medium text-primary-text hover:underline"
        >
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

function NextSteps({ spec }) {
  const dash = DASH[spec.platform];
  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
      <h3 className="mb-2 flex items-center gap-2 font-display text-base font-semibold text-foreground">
        <ListChecks className="size-4 text-primary-text" aria-hidden="true" />
        Next: add this to {CROP_PLATFORMS[spec.platform].dashLabel}
      </h3>
      <ol className="ml-1 list-inside list-decimal space-y-1 text-sm text-muted-foreground marker:text-primary-text">
        {spec.steps.map((s) => (
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

  // Every REQUIRED upload file must clear the per-file cap — Twitch badges ship
  // as three separate files, so all three are checked, not just one.
  for (const size of spec.requiredUploads) {
    const bytes = out.bytes[String(size)];
    if (bytes > spec.maxBytes) {
      list.push(
        `The ${size}px PNG is ${fmtBytes(bytes)} — the cap is ${fmtBytes(spec.maxBytes)} per file. Simplify the art or reduce colors.`,
      );
    }
  }
  return list;
}

function fmtBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10 * 1024 ? 1 : 0)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}
