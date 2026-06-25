import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Download, ImagePlus, Radio, RotateCcw } from "lucide-react";

import { ChatPreview } from "@/components/ChatPreview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { downloadDataUrl, resizeSet } from "@/lib/resize";
import { cn } from "@/lib/utils";

// Twitch's published asset specs — the sizes and limits this tool resizes to.
const SPECS = {
  badge: {
    label: "Badge",
    sizes: [18, 36, 72],
    chat: "18",
    note: "Chat badges: 18 / 36 / 72px PNG, transparent, square.",
  },
  emote: {
    label: "Emote",
    sizes: [28, 56, 112],
    chat: "28",
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
    <div className="mx-auto min-h-dvh max-w-5xl px-5 pb-24 pt-10 sm:px-8">
      <header className="mb-8 text-center">
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
      <div className="mb-6 flex justify-center">
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
                "rounded-md px-5 py-1.5 text-sm font-medium transition-colors",
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
            "flex w-full flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border px-6 py-14 text-center transition-colors hover:border-primary/60",
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

          <div className="checker flex items-end justify-center gap-6 rounded-lg px-4 py-6">
            {spec.sizes.map((size) => (
              <div key={size} className="flex flex-col items-center gap-2">
                <img
                  src={set.files[String(size)]}
                  alt={`${set.name} at ${size}px`}
                  width={size}
                  height={size}
                  className="pixelated"
                  style={{ width: size, height: size }}
                />
                <span className="font-mono text-[10px] text-muted-foreground">{size}px</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-1.5 text-[10px]"
                  onClick={() => downloadDataUrl(set.files[String(size)], `${set.name}-${size}.png`)}
                  aria-label={`Download ${size}px PNG`}
                >
                  <Download className="!size-3" /> PNG
                </Button>
              </div>
            ))}
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
  const { width, height, bytes, type } = set.source;
  const largest = Math.max(...spec.sizes);
  if (width !== height) out.push(`Source isn't square (${width}×${height}). Twitch assets must be square — it's been letterboxed into transparent padding.`);
  if (Math.min(width, height) < largest) out.push(`Source is smaller than ${largest}px, so the largest size is upscaled and may look soft. Design at ${largest}px or larger.`);
  if (bytes > 1_000_000) out.push(`Source is ${fmtBytes(bytes)} — Twitch caps each file at 1MB.`);
  if (type && type !== "image/png") out.push(`Source is ${type || "non-PNG"}; Twitch requires PNG. Exports above are PNG.`);
  return out;
}

function fmtBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}
