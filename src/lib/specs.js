// Single authoritative source of truth for every platform number in this app.
// Dimensions, byte caps, formats, animation policy, preview sizes, upload
// requirements, slot rules, dashboard paths, help URLs and the instructional
// copy all live here — nothing else in the codebase should hardcode a spec
// number. The Crop view (App.jsx), the Showcase organizer (Showcase.jsx) and
// the export baker (exportGrid.js) all derive their behavior from these tables.
//
// Sources (verify against these when specs change):
//   - Twitch emotes:  https://help.twitch.tv/s/article/emote-guidelines
//   - Twitch badges:  https://help.twitch.tv/s/article/subscriber-badge-guide
//   - Twitch slots:   https://help.twitch.tv/s/article/emote-slots
//   - Discord emoji:  https://support.discord.com/hc/en-us/articles/360036479811
//   - Discord sticker: https://support.discord.com/hc/en-us/articles/4402687377815

const KB = 1024;
const MB = 1024 * 1024;

export const GUIDES = {
  twitchEmote: "https://help.twitch.tv/s/article/emote-guidelines",
  twitchBadge: "https://help.twitch.tv/s/article/subscriber-badge-guide?language=en_US",
  twitchSlots: "https://help.twitch.tv/s/article/emote-slots",
  discordEmoji: "https://support.discord.com/hc/en-us/articles/360036479811",
  discordSticker: "https://support.discord.com/hc/en-us/articles/4402687377815",
};

// Human byte string for spec/step copy (no dependency on App's fmtBytes).
export function fmtCap(n) {
  if (n % MB === 0) return `${n / MB} MB`;
  return `${Math.round(n / KB)} KB`;
}

// ── Crop view: published asset specs ────────────────────────────────────────
// `sizes`           — every PNG the crop view rasterizes.
// `requiredUploads` — the sizes the platform actually wants as files. Twitch
//                     badges need THREE separate files (18/36/72); everything
//                     else is a single upload.
// `previewSize`     — which rasterized size feeds the live chat/message preview.
// `maxBytes`        — the per-FILE cap applied to every required upload.
// `animated: false` — the crop view always exports a static PNG.
const cropSpecs = {
  emote: {
    platform: "twitch",
    label: "Emote",
    sizes: [28, 56, 112],
    requiredUploads: [112],
    previewSize: 28,
    maxBytes: 1 * MB,
    format: "png",
    animated: false,
    guide: GUIDES.twitchEmote,
  },
  badge: {
    platform: "twitch",
    label: "Badge",
    // Twitch requires three separate transparent PNG files, one per size —
    // it does NOT generate the smaller sizes from a single large upload.
    sizes: [18, 36, 72],
    requiredUploads: [18, 36, 72],
    previewSize: 18,
    maxBytes: 25 * KB,
    format: "png",
    animated: false,
    guide: GUIDES.twitchBadge,
  },
  demoji: {
    platform: "discord",
    label: "Emoji",
    sizes: [48, 128],
    requiredUploads: [128],
    previewSize: 128,
    maxBytes: 256 * KB,
    format: "png",
    animated: false,
    guide: GUIDES.discordEmoji,
  },
  dsticker: {
    platform: "discord",
    label: "Sticker",
    sizes: [160, 320],
    requiredUploads: [320],
    previewSize: 320,
    maxBytes: 512 * KB,
    format: "png",
    animated: false,
    guide: GUIDES.discordSticker,
  },
};

// Per-asset intro note + upload checklist, built from the numbers above so the
// spec is stated in exactly one place.
function cropNote(mode, s) {
  const cap = fmtCap(s.maxBytes);
  switch (mode) {
    case "emote":
      return `Twitch emote: ${s.sizes.join(" / ")}px PNG, transparent, square, under ${cap} each. Upload the ${Math.max(...s.sizes)} and Twitch scales the rest.`;
    case "badge":
      return `Twitch sub/event badge: three separate square, non-animated PNG files — ${s.sizes.join(", ")}px — each under ${cap}. Upload all three.`;
    case "demoji":
      return `Discord emoji: upload up to ${s.previewSize}×${s.previewSize} under ${cap} (PNG). Shows ~22px inline in chat.`;
    case "dsticker":
      return `Discord sticker: ${s.previewSize}×${s.previewSize} PNG under ${cap}. Shows ~160px in chat.`;
    default:
      return "";
  }
}

function cropSteps(mode, s) {
  const cap = fmtCap(s.maxBytes);
  switch (mode) {
    case "badge":
      return [
        `Download all three PNGs above (${s.sizes.join(", ")}px) — Twitch needs each size as its own file.`,
        "Creator Dashboard → Viewer Rewards → Sub Badges (or Badges → Create Event).",
        `Upload the ${s.sizes.join(", ")}px files into their slots: square, non-animated PNG, ≤${cap} each.`,
        "Set Badge Name (≤25 chars), Subscription Count (1–5), and Badge Description.",
        "Pick Start/End dates (≤28 days). Optionally enable a Watch Time reward with a second badge.",
      ];
    case "emote":
      return [
        `Download the ${s.sizes.join(" / ")}px PNGs above.`,
        "Creator Dashboard → Viewer Rewards → Emotes.",
        `Upload each tier — emotes must be square PNG, transparent, under ${cap}.`,
      ];
    case "demoji":
      return [
        `Download the ${s.previewSize}px PNG above (the one tagged “Upload to Discord”).`,
        "Server Settings → Emoji → Upload Emoji.",
        "Pick the file, name it (2–32 chars, letters/numbers/underscores), and save.",
      ];
    case "dsticker":
      return [
        `Download the ${s.previewSize}px PNG above (the one tagged “Upload to Discord”).`,
        "Server Settings → Stickers → Upload Sticker.",
        `Add it: ${s.previewSize}×${s.previewSize} PNG under ${cap}, give it a name and a related emoji.`,
      ];
    default:
      return [];
  }
}

// Freeze the assembled specs (note + steps baked in) as SPECS.
export const SPECS = Object.fromEntries(
  Object.entries(cropSpecs).map(([mode, s]) => [
    mode,
    { ...s, note: cropNote(mode, s), steps: cropSteps(mode, s) },
  ]),
);

// Crop-view platform grouping (which asset types each platform offers).
export const CROP_PLATFORMS = {
  twitch: { label: "Twitch", assets: ["emote", "badge"], dashLabel: "Twitch" },
  discord: { label: "Discord", assets: ["demoji", "dsticker"], dashLabel: "Discord" },
};

export const DASH = {
  twitch: { href: "https://dashboard.twitch.tv/", label: "Open Twitch Creator Dashboard" },
  discord: { href: "https://discord.com/channels/@me", label: "Open Discord" },
};

// ── Twitch emote-slot model ─────────────────────────────────────────────────
// Slots unlock at Sub Point milestones (Prime/T1 = 1 pt, T2 = 2, T3 = 6). The
// Tier-1 STATIC pool and the Tier-1 ANIMATED pool grow INDEPENDENTLY — they are
// separate ceilings on Twitch, not a shared counter. Tier 2, Tier 3 and Bits
// caps are fixed; follower is a soft seed (users override any number in the UI
// to match their real Creator Dashboard).
//
// Numbers reflect Twitch's post-2023 emote-slot expansion. The partner Tier-1
// progression below runs to 60 slots; anything beyond needs >10k sub points.
// Every value is user-overridable, so these are documented seeds, not gospel.
export const SUB_POINTS_PER_SUB = { prime: 1, tier1: 1, tier2: 2, tier3: 6 };

// Partner Tier-1 static unlock thresholds for slots 11..60 (start = 10).
function partnerTier1Milestones() {
  const m = [65, 80, 100]; //            slots 11–13
  for (let p = 125; p <= 250; p += 25) m.push(p); //   14–19 (every 25 above 100)
  for (let p = 300; p <= 500; p += 50) m.push(p); //   20–24 (every 50 above 250)
  for (let p = 600; p <= 1000; p += 100) m.push(p); // 25–29 (every 100 above 500)
  for (let p = 1200; p <= 5000; p += 200) m.push(p); //30–49 (every 200 above 1k)
  for (let p = 5400; p <= 7000; p += 400) m.push(p); //50–54 (every 400 above 5k)
  // Slots 55–60 exist but Twitch does not publish their individual thresholds —
  // only that the last ones need >10,000 sub points. These six are an explicit
  // APPROXIMATION so a very large channel still sees a sane ceiling (60) rather
  // than a cap frozen at 54; every number stays editable in the UI.
  for (let p = 7600; p <= 10_600; p += 600) m.push(p); // 55–60 (approximate)
  return m;
}
const PARTNER_T1 = partnerTier1Milestones();

// { start, milestones } → each milestone ≤ points unlocks one more slot.
export const TWITCH_SLOTS = {
  affiliate: {
    label: "Affiliate",
    follower: 1,
    tier1Static: { start: 5, milestones: [15, 25, 35, 50] },
    tier1Animated: { start: 1, milestones: [15, 25, 35, 50] },
    tier2: 1,
    tier3: 1,
    bits: 3,
  },
  partner: {
    label: "Partner",
    follower: 1,
    tier1Static: { start: 10, milestones: PARTNER_T1 },
    tier1Animated: { start: 5, milestones: PARTNER_T1 },
    tier2: 6,
    tier3: 6,
    bits: 3,
  },
};

function poolCap(pool, pts) {
  return pool.start + pool.milestones.filter((m) => m <= (pts || 0)).length;
}

// Live slot cap for a showcase section under the current status + sub points.
export function twitchSlotCap(sectionKey, status, pts) {
  const s = TWITCH_SLOTS[status];
  switch (sectionKey) {
    case "tier1":
      return poolCap(s.tier1Static, pts);
    case "animated":
      return poolCap(s.tier1Animated, pts);
    case "tier2":
      return s.tier2;
    case "tier3":
      return s.tier3;
    case "bits":
      return s.bits;
    case "follower":
      return s.follower;
    default:
      return 0;
  }
}

// Next sub-point milestone above `pts` across BOTH Tier-1 pools, with which
// pool(s) unlock there. Null once every listed slot is unlocked.
export function nextMilestone(status, pts) {
  const s = TWITCH_SLOTS[status];
  const nextStatic = s.tier1Static.milestones.find((m) => m > pts);
  const nextAnimated = s.tier1Animated.milestones.find((m) => m > pts);
  const candidates = [nextStatic, nextAnimated].filter((m) => m != null);
  if (candidates.length === 0) return null;
  const points = Math.min(...candidates);
  const pools = [];
  if (nextStatic === points) pools.push("Tier 1");
  if (nextAnimated === points) pools.push("animated");
  return { points, pools };
}

// Starting-slots summary line for the "How slots grow" disclosure.
export function slotStartLine(status) {
  const s = TWITCH_SLOTS[status];
  return `${s.tier1Static.start}×T1 · ${s.tier2}×T2 · ${s.tier3}×T3 · ${s.tier1Animated.start} animated`;
}

// Back-compat shape for StatusBar's status toggle + copy.
export const TWITCH_STATUS = {
  affiliate: { label: "Affiliate" },
  partner: { label: "Partner" },
};

// ── Discord Boost Levels ────────────────────────────────────────────────────
export const BOOSTS_FOR_LEVEL = [0, 2, 7, 14];

export function levelForBoosts(n) {
  if (n >= 14) return 3;
  if (n >= 7) return 2;
  if (n >= 2) return 1;
  return 0;
}

// ── Showcase organizer: slot sections ───────────────────────────────────────
// `caps`      — null (soft, grows with sub points), number (fixed), or number[]
//               indexed by Discord Boost Level 0..3.
// `thumb`     — on-screen preview px.
// `animation` — "static" | "animated" | "either"; drives validation of dropped
//               files (reject static in animated-only slots and vice-versa).
// `maxBytes`  — per-file cap for the off-spec check. `square` — must be square.
// `spec`      — a human string DERIVED from the above (see sectionSpec()).
export const SHOWCASE = {
  twitch: {
    key: "twitch",
    label: "Twitch",
    accent: "#9147ff",
    levels: null,
    note: "Pick Affiliate or Partner to seed your real starting slots, then edit any number to match what your Creator Dashboard shows. Slots grow with sub points; Bit emotes are fixed at 3.",
    sections: [
      {
        key: "follower",
        label: "Follower",
        caps: null,
        thumb: 56,
        uploadPx: 112,
        maxBytes: 1 * MB,
        square: true,
        animation: "either",
        where: "Dashboard → Viewer Rewards → Emotes → Follower",
      },
      {
        key: "tier1",
        label: "Tier 1",
        caps: null,
        thumb: 56,
        uploadPx: 112,
        maxBytes: 1 * MB,
        square: true,
        animation: "static",
        where: "Dashboard → Viewer Rewards → Emotes → Tier 1",
      },
      {
        key: "tier2",
        label: "Tier 2",
        caps: null,
        thumb: 56,
        uploadPx: 112,
        maxBytes: 1 * MB,
        square: true,
        animation: "static",
        where: "Dashboard → Viewer Rewards → Emotes → Tier 2",
      },
      {
        key: "tier3",
        label: "Tier 3",
        caps: null,
        thumb: 56,
        uploadPx: 112,
        maxBytes: 1 * MB,
        square: true,
        animation: "static",
        where: "Dashboard → Viewer Rewards → Emotes → Tier 3",
      },
      {
        key: "animated",
        label: "Animated",
        caps: null,
        thumb: 56,
        uploadPx: 112,
        maxBytes: 1 * MB,
        square: true,
        animation: "animated",
        where: "Dashboard → Viewer Rewards → Emotes → Animated",
      },
      {
        key: "bits",
        label: "Bit Emotes",
        caps: 3,
        thumb: 56,
        uploadPx: 112,
        maxBytes: 1 * MB,
        square: true,
        animation: "either",
        where: "Dashboard → Viewer Rewards → Bits Emotes",
      },
    ],
  },
  discord: {
    key: "discord",
    label: "Discord",
    accent: "#5865f2",
    levels: ["Level 0 · No Boost", "Level 1", "Level 2", "Level 3"],
    note: "Enter your server's boost count or pick a Boost Level — every slot updates to match. Boosting raises all of them.",
    sections: [
      {
        key: "emoji",
        label: "Standard Emoji",
        caps: [50, 100, 150, 250],
        thumb: 48,
        uploadPx: 128,
        maxBytes: 256 * KB,
        square: false,
        animation: "static",
        where: "Server Settings → Emoji",
      },
      {
        key: "animated",
        label: "Animated Emoji",
        caps: [50, 100, 150, 250],
        thumb: 48,
        uploadPx: 128,
        // Discord's emoji cap is 256 KB for BOTH static and animated — boosting
        // raises the slot COUNT, not the per-file size.
        maxBytes: 256 * KB,
        square: false,
        animation: "animated",
        where: "Server Settings → Emoji (animated column)",
      },
      // Discord accepts APNG stickers, but this tool re-encodes to a static PNG
      // (canvas flattens animation), so we do NOT claim APNG support here.
      {
        key: "stickers",
        label: "Stickers",
        caps: [5, 15, 30, 60],
        thumb: 80,
        uploadPx: 320,
        maxBytes: 512 * KB,
        square: true,
        animation: "either",
        // No JPG (Discord rejects it for stickers) and we deliberately don't
        // advertise APNG: this tool re-encodes to a static PNG, so claiming it
        // would imply animation survives the export.
        formats: "PNG / GIF",
        where: "Server Settings → Stickers",
      },
    ],
  },
};

// Human spec string derived from a section's data (no stored prose to drift).
export function sectionSpec(platform, section) {
  const cap = fmtCap(section.maxBytes);
  const dim = `${section.uploadPx}×${section.uploadPx}`;
  // An explicit `formats` on the section wins; otherwise fall back to the
  // platform default (Discord stickers, for one, do NOT accept JPG).
  const fmt =
    section.formats ??
    (section.animation === "animated"
      ? "animated GIF"
      : platform === "twitch"
        ? "PNG or GIF"
        : "PNG / JPG / GIF");
  if (section.key === "bits") return `Unlock at 1k / 5k / 10k Bits · ${dim}`;
  const bits = [`${dim} ${fmt}`];
  if (section.square) bits.push("square");
  bits.push(`≤${cap}`);
  return bits.join(" · ");
}

// Resolve a Discord section's slot cap for the current Boost Level.
export function capFor(section, level) {
  if (section.caps == null) return null;
  return Array.isArray(section.caps) ? section.caps[level] : section.caps;
}

// Auto-size target (px) for uploads dropped into a section.
export function uploadPx(platform, sectionKey) {
  const section = SHOWCASE[platform]?.sections.find((s) => s.key === sectionKey);
  return section?.uploadPx ?? (platform === "discord" ? 128 : 112);
}

// Upload limits used by the to-do list's off-spec check (KB cap + must-square).
export function offSpec(platform, sectionKey) {
  const section = SHOWCASE[platform]?.sections.find((s) => s.key === sectionKey);
  return {
    maxKB: Math.round((section?.maxBytes ?? 1 * MB) / KB),
    square: section?.square ?? false,
  };
}
