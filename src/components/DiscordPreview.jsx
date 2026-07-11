import { Hash } from "lucide-react";

// A faithful-enough Discord message mock so you can see a custom emoji sitting
// inline (and in a reaction), or a sticker dropped in a message — the spots that
// actually matter. Mirrors Discord's dark theme. `kind` is "demoji" | "dsticker";
// `url` is the highest-res crop (128 / 320) and we size it down with CSS.
//
// NOTE: every hex here is an intentional, locked Discord value (#313338 chat,
// #5865f2 avatar, #949ba4 meta, etc.). Do NOT swap them for design tokens — the
// mock exists to look exactly like Discord. Sample copy is fixed on purpose so
// the preview reads the same regardless of the Twitch message field.
export function DiscordPreview({ kind, url, username }) {
  const name = username || "Username";

  const Avatar = () => (
    <span className="mt-0.5 size-9 shrink-0 rounded-full bg-[#5865f2]" aria-hidden="true" />
  );
  const NameLine = () => (
    <span>
      <span className="font-semibold text-[#f2f3f5]">{name}</span>
      <span className="ml-1.5 text-[11px] text-[#949ba4]">Today at 4:20 PM</span>
    </span>
  );

  return (
    <div className="overflow-hidden rounded-xl border border-[#1f2023] bg-[#313338] text-[#dbdee1] shadow-xl">
      <div className="flex items-center gap-1.5 border-b border-black/20 bg-[#2b2d31] px-4 py-3">
        <Hash className="size-4 text-[#949ba4]" aria-hidden="true" />
        <span className="text-sm font-semibold text-[#f2f3f5]">general</span>
      </div>

      <div className="space-y-4 px-4 py-4 text-[15px] leading-relaxed">
        <div className="flex gap-3">
          <Avatar />
          <div className="min-w-0">
            <NameLine />
            {kind === "demoji" ? (
              <p className="break-words">
                this is so good{" "}
                {url && (
                  <img
                    src={url}
                    alt="Preview: your emoji inline in a Discord message"
                    className="inline-block size-[22px] align-[-0.35em]"
                  />
                )}
              </p>
            ) : (
              <div className="mt-1">
                {url ? (
                  <img
                    src={url}
                    alt="Preview: your sticker in a Discord message"
                    width={160}
                    height={160}
                    className="rounded-[10px]"
                    style={{ width: 160, height: 160 }}
                  />
                ) : (
                  <div className="size-[160px] rounded-[10px] bg-black/20" />
                )}
              </div>
            )}
          </div>
        </div>

        {kind === "demoji" && (
          <div className="flex gap-3">
            <Avatar />
            <div className="min-w-0">
              <NameLine />
              <p className="break-words">same energy</p>
              {url && (
                <span className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-[#4e5058] bg-[#2b2d31] px-2 py-0.5">
                  <img src={url} alt="Preview: your emoji as a Discord reaction" className="size-4" />
                  <span className="text-xs font-semibold text-[#c9cdfb]">3</span>
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
