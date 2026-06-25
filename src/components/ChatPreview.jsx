import { Users } from "lucide-react";

// A faithful-enough Twitch chat mock so you can see a custom badge sitting next
// to the username (badge mode) or a custom emote inline in a message (emote
// mode) — the two spots that actually matter. Mirrors Twitch's dark chat:
// badge 18px, emote 28px, bold colored username.
export function ChatPreview({ mode, channel, username, color, badgeUrl, emoteUrl, message }) {
  const name = username || "Username";

  const Badge = () =>
    mode === "badge" && badgeUrl ? (
      <img
        src={badgeUrl}
        alt={`${name}'s badge`}
        width={18}
        height={18}
        className="pixelated mr-1 inline-block size-[18px] shrink-0 rounded-[3px] align-middle"
      />
    ) : null;

  const Name = () => (
    <>
      <span className="font-bold" style={{ color }}>
        {name}
      </span>
      <span className="text-[#adadb8]">: </span>
    </>
  );

  return (
    <div className="overflow-hidden rounded-xl border border-[#2a2a31] bg-[#18181b] text-[#efeff1] shadow-xl">
      <div className="flex items-center justify-between border-b border-[#2a2a31] px-4 py-3">
        <span className="text-sm font-semibold">Stream Chat</span>
        <Users className="size-4 text-[#adadb8]" aria-hidden="true" />
      </div>

      <div className="space-y-1.5 px-3 py-3 text-[13px] leading-relaxed">
        <p className="px-1 text-[#adadb8]">
          Welcome to {channel || "mrdemonwolf"}'s chat room!
        </p>

        <div className="rounded px-1 py-0.5 hover:bg-white/5">
          <Badge />
          <Name />
          {mode === "emote" && emoteUrl ? (
            <img
              src={emoteUrl}
              alt="custom emote"
              width={28}
              height={28}
              className="pixelated inline-block size-7 align-middle"
            />
          ) : (
            <span className="break-words">{message || "test"}</span>
          )}
        </div>

        <div className="rounded px-1 py-0.5 hover:bg-white/5">
          <Badge />
          <Name />
          {mode === "emote" && emoteUrl ? (
            <>
              <span className="break-words">{message || "such hype "}</span>
              <img
                src={emoteUrl}
                alt="custom emote"
                width={28}
                height={28}
                className="pixelated inline-block size-7 align-middle"
              />
            </>
          ) : (
            <span className="break-words">Looking sharp.</span>
          )}
        </div>
      </div>
    </div>
  );
}
