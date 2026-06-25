import { useRef, useState } from "react";
import { Download, ImagePlus } from "lucide-react";

import { ChatPreview } from "@/components/ChatPreview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { downloadDataUrl, resizeSet } from "@/lib/resize";
import { cn } from "@/lib/utils";

const BADGE_SIZES = [18, 36, 72];
const EMOTE_SIZES = [28, 56, 112];

// Upload one high-res source → auto-resized to the Twitch size set, downloadable,
// and previewed live in a mock chat line.
export function ChatStudio() {
  const [badge, setBadge] = useState(null);
  const [emote, setEmote] = useState(null);
  const [channel, setChannel] = useState("mrdemonwolf");
  const [username, setUsername] = useState("MrDemonWolf");
  const [color, setColor] = useState("#00aced");
  const [message, setMessage] = useState("test");

  return (
    <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="space-y-6">
        <Uploader
          title="Custom badge"
          hint="Upload your 72px source — exported at 18 / 36 / 72."
          sizes={BADGE_SIZES}
          set={badge}
          onFile={async (f) => setBadge(await resizeSet(f, BADGE_SIZES))}
        />
        <Uploader
          title="Custom emote"
          hint="Upload your 112px source — exported at 28 / 56 / 112."
          sizes={EMOTE_SIZES}
          set={emote}
          onFile={async (f) => setEmote(await resizeSet(f, EMOTE_SIZES))}
        />
      </div>

      <div className="space-y-4">
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
          channel={channel}
          username={username}
          color={color}
          badgeUrl={badge?.files["18"]}
          emoteUrl={emote?.files["28"]}
          message={message}
        />
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

function Uploader({ title, hint, sizes, set, onFile }) {
  const input = useRef(null);
  const [over, setOver] = useState(false);
  const base = set?.name || title.toLowerCase().replace(/\s+/g, "-");

  function take(files) {
    const img = Array.from(files).find((f) => /^image\//.test(f.type) || /\.(png|gif|jpe?g|webp)$/i.test(f.name));
    if (img) onFile(img);
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="font-display font-semibold">{title}</p>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => input.current?.click()}>
          <ImagePlus /> Upload
        </Button>
      </div>

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
            take(e.dataTransfer.files);
          }}
          className={cn(
            "flex w-full items-center justify-center rounded-lg border border-dashed border-border px-4 py-8 text-sm text-muted-foreground transition-colors hover:border-primary/60",
            over && "border-primary bg-primary/5",
          )}
        >
          Drop an image or click to upload
        </button>
      ) : (
        <div className="checker flex items-end justify-center gap-5 rounded-lg px-4 py-5">
          {sizes.map((size) => (
            <div key={size} className="flex flex-col items-center gap-2">
              <img
                src={set.files[String(size)]}
                alt={`${base} at ${size}px`}
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
                onClick={() => downloadDataUrl(set.files[String(size)], `${base}-${size}.png`)}
              >
                <Download className="!size-3" />
                PNG
              </Button>
            </div>
          ))}
        </div>
      )}

      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => e.target.files?.length && take(e.target.files)}
      />
    </div>
  );
}
