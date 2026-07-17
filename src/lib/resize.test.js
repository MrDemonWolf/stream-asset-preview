import { describe, expect, it } from "vitest";

import { bytesOfDataUrl, clampCrop, recenter } from "./resize";

// These three are pure math/string helpers — no canvas, so they run in plain
// node without jsdom.

describe("bytesOfDataUrl", () => {
  it("estimates decoded byte length from base64 length and padding", () => {
    expect(bytesOfDataUrl("data:image/png;base64,AAAA")).toBe(3); // 4 chars, no pad
    expect(bytesOfDataUrl("data:image/png;base64,QQ==")).toBe(1); // 2 pad chars
    expect(bytesOfDataUrl("data:image/png;base64,QUJD")).toBe(3);
  });

  it("returns 0 for empty/nullish input", () => {
    expect(bytesOfDataUrl("")).toBe(0);
    expect(bytesOfDataUrl(undefined)).toBe(0);
  });
});

describe("recenter", () => {
  it("keeps the crop center fixed while changing size", () => {
    const before = { x: 0, y: 0, size: 100 }; // center (50, 50)
    const after = recenter(before, 50);
    expect(after).toEqual({ x: 25, y: 25, size: 50 });
    expect(after.x + after.size / 2).toBe(50);
    expect(after.y + after.size / 2).toBe(50);
  });
});

describe("clampCrop", () => {
  it("clamps size up to the minimum", () => {
    expect(clampCrop({ x: 0, y: 0, size: 2 }, 100, 100, 8).size).toBe(8);
  });

  it("keeps the crop center within the image", () => {
    const c = clampCrop({ x: 1000, y: 1000, size: 20 }, 100, 100, 8);
    expect(c.x + c.size / 2).toBe(100); // center pinned to the right/bottom edge
    expect(c.y + c.size / 2).toBe(100);
  });

  it("does not invert bounds when min exceeds max on a tiny source", () => {
    const c = clampCrop({ x: 0, y: 0, size: 5 }, 2, 2, 8, 4);
    expect(c.size).toBe(8); // min wins; result stays finite
    expect(Number.isFinite(c.x)).toBe(true);
  });
});
