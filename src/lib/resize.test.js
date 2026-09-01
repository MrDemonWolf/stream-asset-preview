import { describe, expect, it } from "vitest";

import {
  MAX_CANVAS_SIDE,
  assertCanvasSize,
  bytesOfDataUrl,
  clampCrop,
  containCrop,
  coverCrop,
  recenter,
  safeFilename,
} from "./resize";

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

describe("containCrop / coverCrop (item 8)", () => {
  it("Fit contains the whole image (letterbox padding)", () => {
    const c = containCrop({ naturalWidth: 200, naturalHeight: 100 });
    expect(c.size).toBe(200); // longest side
    expect(c.y).toBe(-50); // padded top/bottom
  });
  it("Fill covers the square (crops the long edge)", () => {
    const c = coverCrop({ naturalWidth: 200, naturalHeight: 100 });
    expect(c.size).toBe(100); // shortest side
    expect(c.x).toBe(50);
  });
  it("handles a tiny 1x1 source without NaN", () => {
    const c = containCrop({ naturalWidth: 1, naturalHeight: 1 });
    expect(c).toEqual({ x: 0, y: 0, size: 1 });
    expect(Number.isFinite(c.size)).toBe(true);
  });
});

describe("assertCanvasSize (item 5)", () => {
  it("allows a reasonable canvas", () => {
    expect(() => assertCanvasSize(1024, 1024)).not.toThrow();
  });
  it("throws past the per-side limit", () => {
    expect(() => assertCanvasSize(MAX_CANVAS_SIDE + 1, 10)).toThrow();
  });
});

describe("safeFilename (item 9)", () => {
  it("keeps letters, digits, dot, dash, underscore", () => {
    expect(safeFilename("My Emote v2.final")).toBe("My-Emote-v2.final");
  });
  it("strips path separators and hostile characters", () => {
    expect(safeFilename("../../etc/passwd")).toBe("etc-passwd");
    expect(safeFilename('a<b>c:"d"|e?f*g')).toBe("a-b-c-d-e-f-g");
  });
  it("falls back to a default for empty/garbage names", () => {
    expect(safeFilename("")).toBe("export");
    expect(safeFilename("///")).toBe("export");
    expect(safeFilename(null)).toBe("export");
  });
  it("caps length", () => {
    expect(safeFilename("a".repeat(200)).length).toBeLessThanOrEqual(80);
  });
});
