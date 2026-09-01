import { describe, expect, it } from "vitest";

import {
  MAX_DIMENSION,
  MAX_FILE_BYTES,
  rejectionText,
  sniff,
  validateForSection,
  validateIntake,
} from "./validate";

// Build an ArrayBuffer from byte/string parts.
function buf(...parts) {
  const bytes = [];
  for (const p of parts) {
    if (typeof p === "string") for (const c of p) bytes.push(c.charCodeAt(0));
    else bytes.push(...p);
  }
  return new Uint8Array(bytes).buffer;
}

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const fakeImg = (w, h) => ({ naturalWidth: w, naturalHeight: h });

describe("sniff (content-based format detection, item 4)", () => {
  it("detects PNG, GIF, JPEG, WEBP", () => {
    expect(sniff(buf(PNG_SIG)).format).toBe("png");
    expect(sniff(buf("GIF89a")).format).toBe("gif");
    expect(sniff(buf([0xff, 0xd8, 0xff])).format).toBe("jpeg");
    expect(sniff(buf("RIFF", [0, 0, 0, 0], "WEBP")).format).toBe("webp");
  });
  it("rejects a non-image even if it were named .png", () => {
    expect(sniff(buf("not an image")).format).toBeNull();
  });
  it("flags animation: APNG (acTL), animated GIF, animated WEBP", () => {
    expect(sniff(buf(PNG_SIG, "acTLxxxxIDAT")).animated).toBe(true);
    expect(sniff(buf(PNG_SIG, "IDAT")).animated).toBe(false);
    expect(sniff(buf("GIF89a")).animated).toBe(true); // GIFs treated as animated
    expect(sniff(buf("RIFF", [0, 0, 0, 0], "WEBP", "ANIM")).animated).toBe(true);
    expect(sniff(buf("RIFF", [0, 0, 0, 0], "WEBP", "VP8 ")).animated).toBe(false);
  });
});

describe("validateIntake (safe limits, item 5)", () => {
  const png = sniff(buf(PNG_SIG));
  it("passes a normal file", () => {
    expect(validateIntake({ size: 1000 }, png, fakeImg(112, 112)).ok).toBe(true);
  });
  it("rejects over-size files", () => {
    const r = validateIntake({ size: MAX_FILE_BYTES + 1 }, png, fakeImg(10, 10));
    expect(r.ok).toBe(false);
    expect(r.reasons.join()).toMatch(/MB/);
  });
  it("rejects over-dimension images", () => {
    const r = validateIntake({ size: 10 }, png, fakeImg(MAX_DIMENSION + 1, 10));
    expect(r.ok).toBe(false);
  });
  it("rejects an unaccepted format", () => {
    const r = validateIntake({ size: 10 }, { format: null, animated: false }, fakeImg(10, 10));
    expect(r.ok).toBe(false);
  });
});

describe("validateForSection (animation policy, item 4)", () => {
  const staticSlot = { key: "tier1", label: "Tier 1", animation: "static" };
  const animatedSlot = { key: "animated", label: "Animated", animation: "animated" };
  const eitherSlot = { key: "follower", label: "Follower", animation: "either" };
  const gif = sniff(buf("GIF89a")); // animated
  const png = sniff(buf(PNG_SIG)); // static
  const img = fakeImg(112, 112);

  it("rejects an animated file in a static-only slot", () => {
    const r = validateForSection({ size: 10 }, gif, img, staticSlot);
    expect(r.ok).toBe(false);
    expect(r.reasons.join()).toMatch(/static only/);
  });
  it("rejects a static file in an animated-only slot", () => {
    const r = validateForSection({ size: 10 }, png, img, animatedSlot);
    expect(r.ok).toBe(false);
    expect(r.reasons.join()).toMatch(/animated file/);
  });
  it("accepts either in an either-slot", () => {
    expect(validateForSection({ size: 10 }, gif, img, eitherSlot).ok).toBe(true);
    expect(validateForSection({ size: 10 }, png, img, eitherSlot).ok).toBe(true);
  });
});

describe("rejectionText", () => {
  it("reads as a per-file summary", () => {
    expect(rejectionText("a.png", ["too big", "not square"])).toBe(
      "Skipped “a.png” — too big; not square.",
    );
  });
});
