import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Download, ExternalLink, ImagePlus, ListChecks, Radio, RotateCcw } from "lucide-react";

import { ChatPreview } from "@/components/ChatPreview";
import { CropStage } from "@/components/CropStage";
import { DiscordPreview } from "@/components/DiscordPreview";
import { Showcase } from "@/components/Showcase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

// Raster only — SVG can taint the canvas and toDataURL would throw, and the
// platforms want PNG anyway.
const ACCEPT = /\.(png|gif|jpe?g|webp)$/i;
const ACCEPT_TYPE = /^image\/(png|gif|jpeg|webp)$/;

export default function App() {
  const [view, setView] = useState("resize");
  const [mode, setMode] = useState("emote");
  const [img, setImg] = useState(null); // decoded HTMLImageElement
  const [srcUrl, setSrcUrl] = useState(null); // persistent object URL for display
  const [source, setSource] = useState(null); // { name, width, height, bytes, type }
  const [crop, setCrop] = useState(null); // { x, y, size } in source px
  const [out, setOut] = useState(null); // { files: {size:dataURL}, bytes: {size:n} }
  const [error, setError] = useState(null);
  const [username, setUsername] = useState("MrDemonWolf");
  const [color, setColor] = useState("#00aced");
  const [channel, setChannel] = useState("mrdemonwolf");
  const [message, setMessage] = useState("test");

  const spec = SPECS[mode];
  const platform = spec.platform;

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
      if (live) setOut({ files, bytes });
    }, 80);
    return () => {
      live = false;
      clearTimeout(id);
    };
  }, [img, crop, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  async function take(files) {
    const file = Array.from(files ?? []).find(
      (f) => ACCEPT_TYPE.test(f.type) || ACCEPT.test(f.name),
    );
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
        name: file.name.replace(/\.[^.]+$/, ""),
        width: image.naturalWidth,
        height: image.naturalHeight,
        bytes: file.size,
        type: file.type,
      });
      setCrop(containCrop(image)); // start showing the whole image, nothing lost
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
  }

  const warnings = specWarnings({ crop, out, source, spec });

  return (
    <div className="mx-auto min-h-dvh max-w-5xl px-5 pb-12 pt-8 sm:px-8">
      <header className="mb-6 text-center">
        <div className="flex items-center justify-center gap-2 text-primary">
          <Radio className="size-4" aria-hidden="true" />
          <span className="font-mono text-xs uppercase tracking-[0.3em]">
            Stream Asset Previewer
          </span>
        </div>
        {view === "resize" ? (
          <>
            <h1 className="mx-auto mt-3 max-w-2xl font-display text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              Crop any image to a Twitch or Discord emote.
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
              Drop a sticker or drawing, drag and zoom to frame it, and see exactly
              what makes the cut. Export every size for Twitch emotes &amp; badges or
              Discord emoji &amp; stickers. Nothing leaves your browser.
            </p>
          </>
        ) : (
          <>
            <h1 className="mx-auto mt-3 max-w-2xl font-display text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              Build an emote showcase.
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
              Drop your whole set — sorted into Twitch tiers or Discord boost-level
              slots, so you know exactly where each one uploads. Preview PNGs and
              GIFs, then export one image to advertise the lot. Nothing leaves your
              browser.
            </p>
          </>
        )}
      </header>

      {/* Top view switcher — resizer vs. showcase organizer */}
      <div className="mb-5 flex justify-center">
        <div role="group" aria-label="Tool" className="inline-flex rounded-lg bg-muted p-[3px]">
          {[
            ["resize", "Crop one"],
            ["showcase", "Build a showcase"],
          ].map(([key, text]) => (
            <button
              key={key}
              type="button"
              aria-pressed={view === key}
              onClick={() => setView(key)}
              className={cn(
                "rounded-md px-5 py-1.5 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                view === key
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {text}
            </button>
          ))}
        </div>
      </div>

      {view === "showcase" && <Showcase />}

      {view === "resize" && (
        <>
          {/* Platform + asset toggles */}
          <div className="mb-5 flex flex-col items-center gap-3">
            <Segmented
              label="Platform"
              value={platform}
              options={Object.entries(PLATFORMS).map(([k, p]) => [k, p.label])}
              onChange={(p) => setMode(PLATFORMS[p].assets[0])}
            />
            <Segmented
              label="Asset type"
              value={mode}
              options={PLATFORMS[platform].assets.map((k) => [k, SPECS[k].label])}
              onChange={setMode}
            />
          </div>

          <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
            {/* Left: upload / crop editor + generated sizes */}
            <section aria-label="Source and generated sizes" className="space-y-4">
              <div className="rounded-xl border border-border bg-card p-4">
                {!img ? (
                  <Dropzone spec={spec} onFiles={take} />
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

                    <CropStage img={img} src={srcUrl} crop={crop} onChange={setCrop} />
                  </div>
                )}
              </div>

              {error && (
                <p role="alert" className="flex items-center gap-2 text-sm text-destructive">
                  <AlertTriangle className="size-4" /> {error}
                </p>
              )}

              {warnings.length > 0 && (
                <ul className="space-y-1 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-foreground">
                  {warnings.map((w) => (
                    <li key={w} className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
                      <span>{w}</span>
                    </li>
                  ))}
                </ul>
              )}

              {out && (
                <SizeGrid mode={mode} spec={spec} out={out} name={source.name} />
              )}

              <p className="text-xs text-muted-foreground">{spec.note}</p>

              {out && <NextSteps mode={mode} spec={spec} />}
            </section>

            {/* Right: live preview + controls */}
            <section aria-label="Preview" className="space-y-4">
              {platform === "twitch" ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Channel">
                      <Input value={channel} onChange={(e) => setChannel(e.target.value)} className="font-mono" />
                    </Field>
                    <Field label="Username">
                      <Input value={username} onChange={(e) => setUsername(e.target.value)} className="font-mono" />
                    </Field>
                    <Field label="Name color">
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={color}
                          onChange={(e) => setColor(e.target.value)}
                          className="size-9 shrink-0 cursor-pointer rounded-md border border-input bg-transparent"
                          aria-label="Username color"
                        />
                        <Input value={color} onChange={(e) => setColor(e.target.value)} className="font-mono" />
                      </div>
                    </Field>
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
                  <DiscordPreview
                    kind={mode}
                    url={out?.files[spec.upload]}
                    username={username}
                    message={message}
                  />
                </>
              )}
            </section>
          </div>
        </>
      )}

      <Footer />
    </div>
  );
}

function Segmented({ label, value, options, onChange }) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-lg bg-muted p-[3px]">
      {options.map(([key, text]) => (
        <button
          key={key}
          type="button"
          aria-pressed={value === key}
          onClick={() => onChange(key)}
          className={cn(
            "rounded-md px-5 py-1.5 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
            value === key
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

function Dropzone({ spec, onFiles }) {
  const input = useRef(null);
  const [over, setOver] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          onFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex w-full flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border px-6 py-14 text-center transition-colors hover:border-primary/60 outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring",
          over && "border-primary bg-primary/5",
        )}
      >
        <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <ImagePlus className="size-6" />
        </span>
        <span className="font-display font-medium text-foreground">
          Drop a {spec.label.toLowerCase()} image, or click to upload
        </span>
        <span className="text-xs text-muted-foreground">
          Any size — you'll crop it to {spec.sizes.join(" / ")}px
        </span>
      </button>
      <input
        ref={input}
        type="file"
        accept="image/png,image/gif,image/jpeg,image/webp"
        hidden
        onChange={(e) => e.target.files?.length && onFiles(e.target.files)}
      />
    </>
  );
}

function SizeGrid({ spec, out, name }) {
  const uploadDest = spec.platform === "twitch" ? "Twitch" : "Discord";
  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="font-display text-sm font-semibold text-foreground">Export sizes</p>
        <Button
          size="sm"
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
              <span className="font-mono text-[10px] text-muted-foreground">
                {size}px · {fmtBytes(out.bytes[String(size)])}
              </span>
              {isUpload && (
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
                  Upload to {uploadDest}
                </span>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-[10px]"
                onClick={() => downloadDataUrl(out.files[String(size)], `${name}-${size}.png`)}
                aria-label={`Download ${size}px PNG`}
              >
                <Download className="!size-3" /> PNG
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
        <a href="https://www.mrdemonwolf.com" target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline">
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
      <p className="mb-2 flex items-center gap-2 font-display text-sm font-semibold text-foreground">
        <ListChecks className="size-4 text-primary" />
        Next: add this to {PLATFORMS[spec.platform].dashLabel}
      </p>
      <ol className="ml-1 list-inside list-decimal space-y-1 text-sm text-muted-foreground marker:text-primary">
        {STEPS[mode].map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      <a
        href={dash.href}
        target="_blank"
        rel="noreferrer"
        className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
      >
        {dash.label} <ExternalLink className="size-3.5" />
      </a>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[11px] uppercase tracking-widest text-muted-foreground">{label}</span>
      {children}
    </label>
  );
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
