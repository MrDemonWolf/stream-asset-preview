import { describe, expect, it } from "vitest";

import { hexToRgb } from "./color";

describe("hexToRgb", () => {
  it("parses a #-prefixed hex", () => {
    expect(hexToRgb("#00aced")).toEqual([0, 172, 237]);
  });

  it("parses a hex without the leading #", () => {
    expect(hexToRgb("ffffff")).toEqual([255, 255, 255]);
  });

  it("is case-insensitive and trims whitespace", () => {
    expect(hexToRgb("  #00ACED  ")).toEqual([0, 172, 237]);
  });

  it("returns null for 3-digit shorthand (not supported)", () => {
    expect(hexToRgb("#fff")).toBeNull();
  });

  it("returns null for junk and empty/nullish input", () => {
    expect(hexToRgb("nope")).toBeNull();
    expect(hexToRgb("")).toBeNull();
    expect(hexToRgb(null)).toBeNull();
    expect(hexToRgb(undefined)).toBeNull();
  });
});
