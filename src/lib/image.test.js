import { describe, expect, it } from "vitest";

import { ACCEPT, ACCEPT_ATTR, ACCEPT_TYPE, isGif, isRasterImage, stripExt } from "./image";
import { sniff } from "./validate";

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

  it("survives adversarial names without throwing", () => {
    expect(stripExt(".hidden")).toBe("");
    expect(stripExt("")).toBe("");
  });
});

describe("ACCEPT constants", () => {
  it("the <input accept> list matches the MIME pattern", () => {
    for (const mime of ACCEPT_ATTR.split(",")) {
      expect(ACCEPT_TYPE.test(mime)).toBe(true);
    }
  });

  it("the filename pattern covers every accepted extension", () => {
    for (const name of ["a.png", "a.gif", "a.jpg", "a.jpeg", "a.webp", "A.PNG"]) {
      expect(ACCEPT.test(name)).toBe(true);
    }
    for (const name of ["a.svg", "a.bmp", "a.tiff", "a.exe", "a"]) {
      expect(ACCEPT.test(name)).toBe(false);
    }
  });
});

// The extension/MIME predicates are only a first-pass filter; validate.js is
// what actually decides. This guards the CLAUDE.md rule that the two stay in
// sync — a format one accepts must not be a format the other silently rejects.
describe("image.js predicates stay in sync with validate.js sniffing", () => {
  const sig = {
    png: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    gif: [..."GIF89a"].map((c) => c.charCodeAt(0)),
    jpeg: [0xff, 0xd8, 0xff],
    webp: [..."RIFF"]
      .map((c) => c.charCodeAt(0))
      .concat(
        [0, 0, 0, 0],
        [..."WEBP"].map((c) => c.charCodeAt(0)),
      ),
  };

  it.each(Object.entries(sig))("%s passes both the predicate and the sniffer", (fmt, bytes) => {
    const name = `x.${fmt === "jpeg" ? "jpg" : fmt}`;
    expect(isRasterImage({ type: `image/${fmt}`, name })).toBe(true);
    expect(sniff(new Uint8Array(bytes).buffer).format).toBe(fmt);
  });

  it("a file lying about its extension is caught by the sniffer, not the predicate", () => {
    // Named .png, MIME image/png — the predicate happily accepts it...
    expect(isRasterImage({ type: "image/png", name: "evil.png" })).toBe(true);
    // ...but the bytes say otherwise, which is the check that counts.
    expect(sniff(new TextEncoder().encode("<svg xmlns=").buffer).format).toBeNull();
  });
});
