import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Download, ExternalLink, ImagePlus, ListChecks, Radio, RotateCcw } from "lucide-react";

import { ChatPreview } from "@/components/ChatPreview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { downloadDataUrl, resizeSet } from "@/lib/resize";
import { cn } from "@/lib/utils";

// Twitch's published asset specs — the sizes and limits this tool resizes to.
// `upload` is the file you actually hand Twitch; `chat` is the size shown in the
// chat preview. `maxBytes` is the per-file cap Twitch enforces on upload.
const SPECS = {
  badge: {
    label: "Badge",
    // Twitch's Create Event badge upload wants one ≥120×120 square; it generates
    // the 18/36/72 chat sizes itself. We export all four so you can preview chat
    // and grab the 120 for upload.
    sizes: [18, 36, 72, 120],
    upload: "120",
    chat: "18",
    maxBytes: 25 * 1024,
    note: "Twitch event badge: upload one square, non-animated PNG, at least 120×120 and under 25KB. Twitch generates the 18 / 36 / 72 chat sizes from it.",
  },
  emote: {
    label: "Emote",
    sizes: [28, 56, 112],
    upload: "112",
    chat: "28",
    maxBytes: 1024 * 1024,
    note: "Emotes: 28 / 56 / 112px PNG, transparent, square, under 1MB each.",
  },
};

// Raster only — SVG can taint the canvas and toDataURL would throw, and Twitch
// wants PNG anyway.
const ACCEPT = /\.(png|gif|jpe?g|webp)$/i;
const ACCEPT_TYPE = /^image\/(png|gif|jpeg|webp)$/;

export default function App() {
  const [mode, setMode] = useState("badge");
  const [file, setFile] = useState(null);
  const [set, setSet] = useState(null);
  const [error, setError] = useState(null);
  const [username, setUsername] = useState("MrDemonWolf");
  const [color, setColor] = useState("#00aced");
  const [channel, setChannel] = useState("mrdemonwolf");
  const [message, setMessage] = useState("test");

  const spec = SPECS[mode];

  // Re-resize whenever the source or the chosen mode changes. A token guards
  // against an out-of-order async result overwriting a newer one.
  useEffect(() => {
    if (!file) {
      setSet(null);
      return;
    }
    let live = true;
    resizeSet(file, SPECS[mode].sizes)
      .then((s) => live && setSet(s))
      .catch(() => live && setError("Could not read that image."));
    return () => {
      live = false;
    };
  }, [file, mode]);

  function take(files) {
    const img = Array.from(files ?? []).find(
      (f) => ACCEPT_TYPE.test(f.type) || ACCEPT.test(f.name),
    );
    if (!img) {
      setError("Use a PNG, GIF, JPG, or WEBP image.");
      return;
    }
    setError(null);
    setFile(img);
  }

  const warnings = set ? specWarnings(set, spec) : [];

  return (
    <div className="mx-auto min-h-dvh max-w-5xl px-5 pb-12 pt-8 sm:px-8">
      <header className="mb-6 text-center">
        <div className="flex items-center justify-center gap-2 text-primary">
          <Radio className="size-4" aria-hidden="true" />
          <span className="font-mono text-xs uppercase tracking-[0.3em]">
            Stream Asset Previewer
          </span>
        </div>
        <h1 className="mx-auto mt-3 max-w-2xl font-display text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Drop one image. Get every Twitch size.
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
          Upload a badge or emote at any size — it's auto-resized to Twitch's
          exact specs, previewed in a real chat line, and ready to download.
          Nothing leaves your browser.
        </p>
      </header>

      {/* Mode toggle — choose what you're making */}
      <div className="mb-5 flex justify-center">
        <div
          role="group"
          aria-label="Asset type"
          className="inline-flex rounded-lg bg-muted p-[3px]"
        >
          {Object.entries(SPECS).map(([key, s]) => (
            <button
              key={key}
              type="button"
              aria-pressed={mode === key}
              onClick={() => setMode(key)}
              className={cn(
                "rounded-md px-5 py-1.5 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                mode === key
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        {/* Left: upload + generated sizes */}
        <section aria-label="Source and generated sizes" className="space-y-4">
          <Uploader
            mode={mode}
            spec={spec}
            set={set}
            onFiles={take}
            onReplace={() => {
              setFile(null);
              setSet(null);
            }}
          />

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

          <p className="text-xs text-muted-foreground">{spec.note}</p>

          {set && <NextSteps mode={mode} spec={spec} />}
        </section>

        {/* Right: chat preview + controls */}
        <section aria-label="Chat preview" className="space-y-4">
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
            badgeUrl={set?.files[spec.chat]}
            emoteUrl={set?.files[spec.chat]}
            message={message}
          />
        </section>
      </div>

      <Footer />
    </div>
  );
}

function Footer() {
  return (
    <footer className="mt-16 border-t border-border pt-8 text-center text-xs text-muted-foreground">
      <p className="mx-auto max-w-xl">
        Not affiliated with, endorsed by, or sponsored by Twitch. Twitch is a
        trademark of Twitch Interactive, Inc. Asset specs may change — always
        confirm against the official{" "}
        <a
          href="https://help.twitch.tv/s/article/subscriber-badge-guide"
          target="_blank"
          rel="noreferrer"
          className="font-medium text-foreground underline-offset-2 hover:underline"
        >
          Twitch guidelines
        </a>
        .
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
      </p>
    </footer>
  );
}

const STEPS = {
  badge: [
    "Download the 120px PNG above (the one tagged “Upload to Twitch”).",
    "Creator Dashboard → Viewer Rewards → Badges → Create Event.",
    "Upload it: square PNG, not animated, ≤25KB, at least 120×120.",
    "Set Badge Name (≤25 chars), Subscription Count (1–5), and Badge Description.",
    "Pick Start/End dates (≤28 days). Optionally enable a Watch Time reward with a second badge.",
  ],
  emote: [
    "Download the 28 / 56 / 112px PNGs above.",
    "Creator Dashboard → Viewer Rewards → Emotes.",
    "Upload each tier — emotes must be square PNG, transparent, under 1MB.",
  ],
};

function NextSteps({ mode }) {
  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
      <p className="mb-2 flex items-center gap-2 font-display text-sm font-semibold text-foreground">
        <ListChecks className="size-4 text-primary" />
        Next: add this to Twitch
      </p>
      <ol className="ml-1 list-inside list-decimal space-y-1 text-sm text-muted-foreground marker:text-primary">
        {STEPS[mode].map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      <a
        href="https://dashboard.twitch.tv/"
        target="_blank"
        rel="noreferrer"
        className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
      >
        Open Twitch Creator Dashboard <ExternalLink className="size-3.5" />
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

function Uploader({ mode, spec, set, onFiles, onReplace }) {
  const input = useRef(null);
  const [over, setOver] = useState(false);

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      {!set ? (
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
            Any size — resized to {spec.sizes.join(" / ")}px
          </span>
        </button>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="truncate font-mono text-sm text-foreground">{set.name}</p>
              <p className="text-xs text-muted-foreground">
                source {set.source.width}×{set.source.height}px · {fmtBytes(set.source.bytes)}
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={onReplace}>
                <RotateCcw /> Replace
              </Button>
              <Button
                size="sm"
                onClick={() => spec.sizes.forEach((s) => downloadDataUrl(set.files[String(s)], `${set.name}-${s}.png`))}
              >
                <Download /> Download all
              </Button>
            </div>
          </div>

          <div className="checker flex flex-wrap items-end justify-center gap-x-6 gap-y-4 rounded-lg px-4 py-6">
            {spec.sizes.map((size) => {
              const isUpload = String(size) === spec.upload;
              return (
                <div key={size} className="flex flex-col items-center gap-1.5">
                  <img
                    src={set.files[String(size)]}
                    alt={`${set.name} at ${size}px`}
                    width={size}
                    height={size}
                    className="pixelated"
                    style={{ width: size, height: size }}
                  />
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {size}px · {fmtBytes(bytesOfDataUrl(set.files[String(size)]))}
                  </span>
                  {isUpload && (
                    <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
                      Upload to Twitch
                    </span>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-[10px]"
                    onClick={() => downloadDataUrl(set.files[String(size)], `${set.name}-${size}.png`)}
                    aria-label={`Download ${size}px PNG`}
                  >
                    <Download className="!size-3" /> PNG
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <input
        ref={input}
        type="file"
        accept="image/png,image/gif,image/jpeg,image/webp"
        hidden
        onChange={(e) => e.target.files?.length && onFiles(e.target.files)}
      />
    </div>
  );
}

function specWarnings(set, spec) {
  const out = [];
  const { width, height, type } = set.source;
  const largest = Math.max(...spec.sizes);
  if (width !== height) out.push(`Source isn't square (${width}×${height}). Twitch assets must be square — it's been letterboxed into transparent padding.`);
  if (Math.min(width, height) < largest) out.push(`Source is smaller than ${largest}px, so the largest size is upscaled and may look soft. Design at ${largest}px or larger.`);
  if (spec.label === "Badge" && type === "image/gif") out.push("Event badges can't be animated. The export is a flattened static PNG — start from a still image to be safe.");

  // The real gate is the upload file's size, not the source's.
  const uploadBytes = bytesOfDataUrl(set.files[spec.upload]);
  if (uploadBytes > spec.maxBytes) {
    out.push(`The ${spec.upload}px PNG is ${fmtBytes(uploadBytes)} — Twitch caps ${spec.label.toLowerCase()} uploads at ${fmtBytes(spec.maxBytes)}. Simplify the art or reduce colors.`);
  }
  return out;
}

// Approximate decoded byte length of a base64 data URL without decoding it.
function bytesOfDataUrl(dataUrl) {
  if (!dataUrl) return 0;
  const b64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const pad = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - pad;
}

function fmtBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10 * 1024 ? 1 : 0)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}
