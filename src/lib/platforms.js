// Slot specs for the showcase organizer. Two platforms, each a list of sections
// (the "levels" a streamer uploads into). `caps` is the slot limit:
//   - null      → soft (Twitch sub-emote slots grow with sub points; guide only)
//   - number    → fixed cap
//   - number[]  → cap per Discord Boost Level (index 0..3)
// `thumb` is the on-screen preview px; `spec`/`where` tell you the upload rules
// and exactly which dashboard screen the asset lands on.

export const PLATFORMS = {
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
        spec: "112×112 PNG or GIF · square · ≤1 MB",
        where: "Dashboard → Viewer Rewards → Emotes → Follower",
      },
      {
        key: "tier1",
        label: "Tier 1",
        caps: null,
        thumb: 56,
        spec: "112×112 PNG or GIF · square · ≤1 MB",
        where: "Dashboard → Viewer Rewards → Emotes → Tier 1",
      },
      {
        key: "tier2",
        label: "Tier 2",
        caps: null,
        thumb: 56,
        spec: "112×112 PNG or GIF · square · ≤1 MB",
        where: "Dashboard → Viewer Rewards → Emotes → Tier 2",
      },
      {
        key: "tier3",
        label: "Tier 3",
        caps: null,
        thumb: 56,
        spec: "112×112 PNG or GIF · square · ≤1 MB",
        where: "Dashboard → Viewer Rewards → Emotes → Tier 3",
      },
      {
        key: "animated",
        label: "Animated",
        caps: null,
        thumb: 56,
        spec: "112×112 animated GIF · square · ≤1 MB",
        where: "Dashboard → Viewer Rewards → Emotes → Animated",
      },
      {
        key: "bits",
        label: "Bit Emotes",
        caps: 3,
        thumb: 56,
        spec: "Unlock at 1k / 5k / 10k Bits · 112×112",
        where: "Dashboard → Viewer Rewards → Bits Emotes",
      },
    ],
  },

  discord: {
    key: "discord",
    label: "Discord",
    accent: "#5865f2",
    // Boost Level 0..3. Caps below are indexed by this.
    levels: ["Level 0 · No Boost", "Level 1", "Level 2", "Level 3"],
    note: "Enter your server's boost count or pick a Boost Level — every slot updates to match. Boosting raises all of them.",
    sections: [
      {
        key: "emoji",
        label: "Standard Emoji",
        caps: [50, 100, 150, 250],
        thumb: 48,
        spec: "≤256 KB · PNG / JPG / GIF · up to 128×128",
        where: "Server Settings → Emoji",
      },
      {
        key: "animated",
        label: "Animated Emoji",
        caps: [50, 100, 150, 250],
        thumb: 48,
        spec: "Animated GIF · ≤256 KB (L2+ 512 KB) · up to 128×128",
        where: "Server Settings → Emoji (animated column)",
      },
      {
        key: "stickers",
        label: "Stickers",
        caps: [5, 15, 30, 60],
        thumb: 80,
        spec: "320×320 PNG / APNG · ≤512 KB",
        where: "Server Settings → Stickers",
      },
    ],
  },
};

// Resolve a Discord section's slot cap for the current Boost Level.
export function capFor(section, level) {
  if (section.caps == null) return null;
  return Array.isArray(section.caps) ? section.caps[level] : section.caps;
}

// Twitch documented STARTING slots per status. Caps are editable in the UI —
// these are just the seed, because Twitch keeps raising the ceilings and the
// exact live count only your Creator Dashboard knows for sure.
// STARTING slots at 0 sub points. Tier-1 and animated slots then unlock one at
// a time at each milestone below (and stay unlocked forever). twitchSlotCap()
// applies that growth.
export const TWITCH_PRESETS = {
  affiliate: { follower: 5, tier1: 5, tier2: 1, tier3: 1, animated: 1, bits: 3 },
  partner: { follower: 5, tier1: 10, tier2: 6, tier3: 6, animated: 5, bits: 3 },
};

export const TWITCH_STATUS = {
  affiliate: {
    label: "Affiliate",
    start: "5×T1 · 1×T2 · 1×T3 · 1 animated",
    // +1 static (Tier 1) & +1 animated slot at each of these sub-point totals.
    milestones: [15, 25, 35, 50],
  },
  partner: {
    label: "Partner",
    start: "10×T1 · 6×T2 · 6×T3 · 5 animated",
    milestones: [65, 80, 100, 150, 200, 250],
  },
};

// A tier's live slot cap = starting slots + milestones already passed. Only the
// Tier 1 static pool and the animated pool grow with sub points.
export function twitchSlotCap(sectionKey, status, pts) {
  const base = TWITCH_PRESETS[status][sectionKey];
  if (sectionKey === "tier1" || sectionKey === "animated") {
    return base + TWITCH_STATUS[status].milestones.filter((m) => m <= (pts || 0)).length;
  }
  return base;
}

// Auto-size target (px) for uploads dropped into a section.
export function uploadPx(platform, sectionKey) {
  if (platform === "discord") return sectionKey === "stickers" ? 320 : 128;
  return 112;
}

// Next sub-point milestone above `pts`, or null once past the last listed one.
export function nextMilestone(status, pts) {
  return TWITCH_STATUS[status].milestones.find((m) => m > pts) ?? null;
}

// Discord Boost Level thresholds — boosts required to reach L0..L3.
export const BOOSTS_FOR_LEVEL = [0, 2, 7, 14];

export function levelForBoosts(n) {
  if (n >= 14) return 3;
  if (n >= 7) return 2;
  if (n >= 2) return 1;
  return 0;
}

// Upload limits used by the to-do list's off-spec check (KB cap + must-be-square).
export function offSpec(platform, sectionKey) {
  if (platform === "twitch") return { maxKB: 1024, square: true };
  if (sectionKey === "stickers") return { maxKB: 512, square: true };
  return { maxKB: sectionKey === "animated" ? 512 : 256, square: false };
}
