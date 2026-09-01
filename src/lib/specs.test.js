import { describe, expect, it } from "vitest";

import {
  BOOSTS_FOR_LEVEL,
  CROP_PLATFORMS,
  DASH,
  GUIDES,
  SPECS,
  SUB_POINTS_PER_SUB,
  TWITCH_SLOTS,
  capFor,
  fmtCap,
  levelForBoosts,
  nextMilestone,
  offSpec,
  sectionSpec,
  SHOWCASE,
  slotStartLine,
  twitchSlotCap,
  uploadPx,
} from "./specs";

describe("Twitch badge spec (item 1)", () => {
  it("requires three separate files at 18/36/72 — no 120 single upload", () => {
    expect(SPECS.badge.sizes).toEqual([18, 36, 72]);
    expect(SPECS.badge.requiredUploads).toEqual([18, 36, 72]);
    expect(SPECS.badge.sizes).not.toContain(120);
  });
  it("caps every badge file at 25 KB", () => {
    expect(SPECS.badge.maxBytes).toBe(25 * 1024);
  });
  it("emote uploads only the 112 (Twitch scales the rest)", () => {
    expect(SPECS.emote.requiredUploads).toEqual([112]);
  });
  it("bakes numbers into the note + steps without stale prose", () => {
    expect(SPECS.badge.note).toContain("18, 36, 72");
    expect(SPECS.badge.steps.join(" ")).not.toContain("120");
  });
});

describe("fmtCap", () => {
  it("formats MB and KB", () => {
    expect(fmtCap(1024 * 1024)).toBe("1 MB");
    expect(fmtCap(25 * 1024)).toBe("25 KB");
    expect(fmtCap(512 * 1024)).toBe("512 KB");
  });
});

describe("Twitch emote-slot model (item 2)", () => {
  // Table of [status, pool, subPoints, expectedCap] boundaries.
  const cases = [
    // Affiliate Tier-1 STATIC: start 5, +1 at 15/25/35/50
    ["affiliate", "tier1", 0, 5],
    ["affiliate", "tier1", 14, 5],
    ["affiliate", "tier1", 15, 6],
    ["affiliate", "tier1", 24, 6],
    ["affiliate", "tier1", 50, 9],
    ["affiliate", "tier1", 999, 9],
    // Affiliate ANIMATED grows INDEPENDENTLY: start 1, same milestones
    ["affiliate", "animated", 0, 1],
    ["affiliate", "animated", 15, 2],
    ["affiliate", "animated", 50, 5],
    // Affiliate fixed pools
    ["affiliate", "tier2", 0, 1],
    ["affiliate", "tier3", 999, 1],
    ["affiliate", "bits", 0, 3],
    ["affiliate", "follower", 0, 1],
    // Partner Tier-1 STATIC: start 10, +1 at 65/80/100/...
    ["partner", "tier1", 0, 10],
    ["partner", "tier1", 64, 10],
    ["partner", "tier1", 65, 11],
    ["partner", "tier1", 100, 13],
    // Partner fixed pools
    ["partner", "tier2", 0, 6],
    ["partner", "tier3", 0, 6],
    ["partner", "bits", 0, 3],
  ];
  it.each(cases)("%s %s @ %i pts → %i", (status, pool, pts, expected) => {
    expect(twitchSlotCap(pool, status, pts)).toBe(expected);
  });

  it("static and animated pools do not share a counter", () => {
    // At 15 pts affiliate has 6 static AND 2 animated — different values prove
    // they are tracked independently, not off one shared milestone count.
    expect(twitchSlotCap("tier1", "affiliate", 15)).toBe(6);
    expect(twitchSlotCap("animated", "affiliate", 15)).toBe(2);
  });

  it("nextMilestone reports the point + which pools unlock", () => {
    expect(nextMilestone("affiliate", 0)).toEqual({ points: 15, pools: ["Tier 1", "animated"] });
    expect(nextMilestone("affiliate", 15)).toEqual({ points: 25, pools: ["Tier 1", "animated"] });
    expect(nextMilestone("partner", 60)).toEqual({ points: 65, pools: ["Tier 1", "animated"] });
  });
});

describe("Discord boost + caps", () => {
  it("levelForBoosts thresholds", () => {
    expect(levelForBoosts(0)).toBe(0);
    expect(levelForBoosts(1)).toBe(0);
    expect(levelForBoosts(2)).toBe(1);
    expect(levelForBoosts(7)).toBe(2);
    expect(levelForBoosts(14)).toBe(3);
  });
  it("capFor resolves array caps per level", () => {
    const emoji = SHOWCASE.discord.sections.find((s) => s.key === "emoji");
    expect(capFor(emoji, 0)).toBe(50);
    expect(capFor(emoji, 3)).toBe(250);
  });
});

describe("sectionSpec + offSpec derive from data (item 3)", () => {
  const tier1 = SHOWCASE.twitch.sections.find((s) => s.key === "tier1");
  const animated = SHOWCASE.twitch.sections.find((s) => s.key === "animated");
  const stickers = SHOWCASE.discord.sections.find((s) => s.key === "stickers");
  const animatedEmoji = SHOWCASE.discord.sections.find((s) => s.key === "animated");

  it("builds spec strings without stored prose", () => {
    expect(sectionSpec("twitch", tier1)).toBe("112×112 PNG or GIF · square · ≤1 MB");
    expect(sectionSpec("twitch", animated)).toContain("animated GIF");
  });
  it("drops the APNG claim from stickers (we re-encode to a static PNG)", () => {
    expect(sectionSpec("discord", stickers)).not.toContain("APNG");
  });
  it("does not offer JPG for stickers — Discord rejects it", () => {
    expect(sectionSpec("discord", stickers)).not.toContain("JPG");
    expect(sectionSpec("discord", stickers)).toBe("320×320 PNG / GIF · square · ≤512 KB");
  });
  it("offSpec reads caps from the section data", () => {
    expect(offSpec("twitch", "tier1")).toEqual({ maxKB: 1024, square: true });
    expect(offSpec("discord", "stickers")).toEqual({ maxKB: 512, square: true });
    expect(offSpec("discord", "emoji")).toEqual({ maxKB: 256, square: false });
  });
  it("Discord animated emoji is capped at 256 KB, same as static (boosting adds slots, not bytes)", () => {
    expect(offSpec("discord", "animated")).toEqual({ maxKB: 256, square: false });
    expect(sectionSpec("discord", animatedEmoji)).toContain("≤256 KB");
  });
  it("bits sections keep their unlock copy", () => {
    const bitsSection = SHOWCASE.twitch.sections.find((s) => s.key === "bits");
    expect(sectionSpec("twitch", bitsSection)).toBe("Unlock at 1k / 5k / 10k Bits · 112×112");
  });
});

describe("uploadPx", () => {
  it("returns each section's real upload target", () => {
    expect(uploadPx("twitch", "tier1")).toBe(112);
    expect(uploadPx("discord", "emoji")).toBe(128);
    expect(uploadPx("discord", "stickers")).toBe(320);
  });
  it("falls back sanely for an unknown section", () => {
    expect(uploadPx("twitch", "nope")).toBe(112);
    expect(uploadPx("discord", "nope")).toBe(128);
  });
});

describe("slotStartLine + sub points", () => {
  it("summarises the starting slots", () => {
    expect(slotStartLine("affiliate")).toBe("5×T1 · 1×T2 · 1×T3 · 1 animated");
    expect(slotStartLine("partner")).toBe("10×T1 · 6×T2 · 6×T3 · 5 animated");
  });
  it("documents the sub-point weights (T1=1, T2=2, T3=6)", () => {
    expect(SUB_POINTS_PER_SUB).toEqual({ prime: 1, tier1: 1, tier2: 2, tier3: 6 });
  });
});

describe("milestone tables are well-formed", () => {
  for (const status of ["affiliate", "partner"]) {
    for (const pool of ["tier1Static", "tier1Animated"]) {
      it(`${status}.${pool} is strictly ascending and positive`, () => {
        const m = TWITCH_SLOTS[status][pool].milestones;
        expect(m.length).toBeGreaterThan(0);
        expect(m.every((v) => Number.isInteger(v) && v > 0)).toBe(true);
        expect([...m].sort((a, b) => a - b)).toEqual(m);
        expect(new Set(m).size).toBe(m.length); // no duplicates
      });
    }
  }
  it("partner Tier 1 reaches 60 slots", () => {
    const p = TWITCH_SLOTS.partner.tier1Static;
    expect(p.start + p.milestones.length).toBeGreaterThanOrEqual(60);
  });
  it("nextMilestone returns null once every listed slot is unlocked", () => {
    expect(nextMilestone("affiliate", 999_999)).toBeNull();
    expect(nextMilestone("partner", 999_999)).toBeNull();
  });
  it("caps never decrease as sub points grow", () => {
    let prev = 0;
    for (const pts of [0, 15, 25, 35, 50, 100, 1000]) {
      const cap = twitchSlotCap("tier1", "affiliate", pts);
      expect(cap).toBeGreaterThanOrEqual(prev);
      prev = cap;
    }
  });
  it("treats missing/zero sub points as zero, not NaN", () => {
    expect(twitchSlotCap("tier1", "affiliate", undefined)).toBe(5);
    expect(twitchSlotCap("tier1", "affiliate", null)).toBe(5);
  });
  it("returns 0 for an unknown section rather than NaN", () => {
    expect(twitchSlotCap("nonsense", "affiliate", 100)).toBe(0);
  });
});

describe("crop specs are internally consistent (item 3 invariants)", () => {
  const modes = Object.keys(SPECS);

  it.each(modes)("%s: every required upload is actually rasterized", (mode) => {
    const s = SPECS[mode];
    for (const size of s.requiredUploads) expect(s.sizes).toContain(size);
  });

  it.each(modes)("%s: the preview size is one we generate", (mode) => {
    const s = SPECS[mode];
    expect(s.sizes).toContain(s.previewSize);
  });

  it.each(modes)("%s: sizes ascend, caps are positive, guide is https", (mode) => {
    const s = SPECS[mode];
    expect([...s.sizes].sort((a, b) => a - b)).toEqual(s.sizes);
    expect(s.maxBytes).toBeGreaterThan(0);
    expect(s.guide).toMatch(/^https:\/\//);
    expect(s.steps.length).toBeGreaterThan(0);
    expect(s.note).not.toHaveLength(0);
  });

  it("every crop asset belongs to a platform that lists it", () => {
    for (const [mode, s] of Object.entries(SPECS)) {
      expect(CROP_PLATFORMS[s.platform].assets).toContain(mode);
    }
  });

  it("every platform's listed assets exist in SPECS", () => {
    for (const p of Object.values(CROP_PLATFORMS)) {
      for (const a of p.assets) expect(SPECS[a]).toBeDefined();
    }
  });

  it("crop exports are always static — animation is dropped", () => {
    for (const s of Object.values(SPECS)) expect(s.animated).toBe(false);
  });
});

describe("links + boost thresholds", () => {
  it("every guide/dashboard URL is https", () => {
    for (const url of Object.values(GUIDES)) expect(url).toMatch(/^https:\/\//);
    for (const d of Object.values(DASH)) expect(d.href).toMatch(/^https:\/\//);
  });
  it("boost thresholds line up with levelForBoosts", () => {
    BOOSTS_FOR_LEVEL.forEach((need, lvl) => {
      expect(levelForBoosts(need)).toBe(lvl);
      if (need > 0) expect(levelForBoosts(need - 1)).toBe(lvl - 1);
    });
  });
});

describe("showcase sections are well-formed", () => {
  it("each section has a valid animation policy and positive caps", () => {
    for (const [platform, cfg] of Object.entries(SHOWCASE)) {
      for (const s of cfg.sections) {
        expect(["static", "animated", "either"]).toContain(s.animation);
        expect(s.uploadPx).toBeGreaterThan(0);
        expect(s.maxBytes).toBeGreaterThan(0);
        expect(typeof s.where).toBe("string");
        // Discord caps are per boost level — one entry per level.
        if (Array.isArray(s.caps)) expect(s.caps).toHaveLength(BOOSTS_FOR_LEVEL.length);
        expect(sectionSpec(platform, s)).toBeTruthy();
      }
    }
  });
  it("section keys are unique within a platform", () => {
    for (const cfg of Object.values(SHOWCASE)) {
      const keys = cfg.sections.map((s) => s.key);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });
});
