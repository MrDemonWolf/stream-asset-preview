import { describe, expect, it } from "vitest";

import { isGif, isRasterImage, stripExt } from "./image";

// isRasterImage / isGif only read .type and .name, so plain objects stand in
// for File here.
describe("isRasterImage", () => {
  it("accepts by MIME type", () => {
    expect(isRasterImage({ type: "image/png", name: "a.png" })).toBe(true);
    expect(isRasterImage({ type: "image/webp", name: "a.webp" })).toBe(true);
  });

  it("falls back to the extension when type is empty (drag-and-drop)", () => {
    expect(isRasterImage({ type: "", name: "photo.JPG" })).toBe(true);
  });

  it("rejects SVG and non-images", () => {
    expect(isRasterImage({ type: "image/svg+xml", name: "a.svg" })).toBe(false);
    expect(isRasterImage({ type: "", name: "notes.txt" })).toBe(false);
  });
});

describe("isGif", () => {
  it("detects GIFs by type or extension", () => {
    expect(isGif({ type: "image/gif", name: "x" })).toBe(true);
    expect(isGif({ type: "", name: "loop.GIF" })).toBe(true);
  });

  it("is false for other rasters", () => {
    expect(isGif({ type: "image/png", name: "a.png" })).toBe(false);
  });
});

describe("stripExt", () => {
  it("drops a single trailing extension", () => {
    expect(stripExt("cat.png")).toBe("cat");
  });

  it("only strips the last segment", () => {
    expect(stripExt("my.emote.gif")).toBe("my.emote");
  });

  it("leaves extension-less names alone", () => {
    expect(stripExt("noext")).toBe("noext");
  });
});
