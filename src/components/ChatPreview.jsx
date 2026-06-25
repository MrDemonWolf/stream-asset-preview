import { Users } from "lucide-react";

// A faithful-enough Twitch chat mock so you can see a custom badge sitting next
// to the username and a custom emote inline in a message — the two spots that
// actually matter. Styling mirrors Twitch's dark chat (badge 18px, emote 28px,
// colored bold username).
export function ChatPreview({ channel, username, color, badgeUrl, emoteUrl, message }) {
  const Badge = () =>
    badgeUrl ? (
      <img
        src={badgeUrl}
        alt="badge"
        width={18}
        height={18}
        className="pixelated mr-1 inline-block size-[18px] shrink-0 rounded-[3px] align-middle"
      />
    ) : null;

  const Name = () => (
    <>
      <span className="font-bold" style={{ color }}>
        {username || "Username"}
      </span>
      <span className="text-[#adadb8]">: </span>
    </>
  );

  return (
    <div className="overflow-hidden rounded-xl border border-[#2a2a31] bg-[#18181b] text-[#efeff1] shadow-xl">
      <div className="flex items-center justify-between border-b border-[#2a2a31] px-4 py-3">
        <span className="text-sm font-semibold">Stream Chat</span>
        <Users className="size-4 text-[#adadb8]" />
      </div>

      <div className="space-y-2 px-3 py-3 text-[13px] leading-relaxed">
        <p className="px-1 text-[#adadb8]">
          Welcome to {channel || "mrdemonwolf"}'s chat room!
        </p>

        <div className="rounded px-1 py-0.5 hover:bg-white/5">
          <Badge />
          <Name />
          <span className="break-words">{message || "test"}</span>
        </div>

        <div className="rounded px-1 py-0.5 hover:bg-white/5">
          <Badge />
          <Name />
          {emoteUrl ? (
            <img
              src={emoteUrl}
              alt="emote"
              width={28}
              height={28}
              className="pixelated inline-block size-7 align-middle"
            />
          ) : (
            <span className="text-[#adadb8]">(upload an emote to see it here)</span>
          )}
        </div>
      </div>
    </div>
  );
}
