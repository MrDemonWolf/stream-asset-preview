// @vitest-environment jsdom
// Canvas- and DOM-dependent parts of lib/resize. jsdom has no real 2D context
// or image decoder, so the collaborators are stubbed — what's under test is OUR
// logic: timeouts, aborts, null-context guards and encode-failure handling.
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DECODE_TIMEOUT_MS,
  canvasToBlob,
  cropToDataUrl,
  downloadBlob,
  loadImage,
} from "./resize.js";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

// Replace global Image with a stub whose behaviour each test picks.
function stubImage(behaviour) {
  vi.stubGlobal(
    "Image",
    class {
      constructor() {
        this.naturalWidth = 100;
        this.naturalHeight = 100;
      }
      set src(_v) {
        behaviour(this);
      }
    },
  );
}

describe("loadImage", () => {
  it("resolves with the decoded image", async () => {
    stubImage((img) => queueMicrotask(() => img.onload()));
    const img = await loadImage(new Blob(["x"]));
    expect(img.naturalWidth).toBe(100);
  });

  it("revokes the object URL after a successful decode (no leak)", async () => {
    const revoke = vi.fn();
    vi.stubGlobal("URL", { createObjectURL: () => "blob:x", revokeObjectURL: revoke });
    stubImage((img) => queueMicrotask(() => img.onload()));
    await loadImage(new Blob(["x"]));
    expect(revoke).toHaveBeenCalledWith("blob:x");
  });

  it("revokes the object URL when the decode fails too", async () => {
    const revoke = vi.fn();
    vi.stubGlobal("URL", { createObjectURL: () => "blob:y", revokeObjectURL: revoke });
    stubImage((img) => queueMicrotask(() => img.onerror()));
    await expect(loadImage(new Blob(["x"]))).rejects.toThrow(/could not decode/i);
    expect(revoke).toHaveBeenCalledWith("blob:y");
  });

  it("rejects a wedged decode instead of hanging forever", async () => {
    vi.useFakeTimers();
    stubImage(() => {}); // never fires onload or onerror
    const p = loadImage(new Blob(["x"]));
    const assertion = expect(p).rejects.toThrow(/timed out/i);
    await vi.advanceTimersByTimeAsync(DECODE_TIMEOUT_MS + 10);
    await assertion;
  });

  it("honours an AbortSignal raised mid-decode", async () => {
    stubImage(() => {});
    const ac = new AbortController();
    const p = loadImage(new Blob(["x"]), { signal: ac.signal });
    ac.abort();
    await expect(p).rejects.toMatchObject({ name: "AbortError" });
  });

  it("rejects immediately if the signal is already aborted", async () => {
    stubImage((img) => queueMicrotask(() => img.onload()));
    await expect(loadImage(new Blob(["x"]), { signal: AbortSignal.abort() })).rejects.toMatchObject(
      { name: "AbortError" },
    );
  });
});

describe("null 2D context guard", () => {
  it("throws a readable error instead of dereferencing null", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    expect(() =>
      cropToDataUrl({ naturalWidth: 10, naturalHeight: 10 }, { x: 0, y: 0, size: 10 }, 28),
    ).toThrow(/couldn't open a canvas/i);
  });
});

describe("canvasToBlob", () => {
  it("resolves with the encoded blob", async () => {
    const blob = new Blob(["png"]);
    const canvas = { toBlob: (cb) => cb(blob) };
    await expect(canvasToBlob(canvas)).resolves.toBe(blob);
  });

  it("rejects when the browser hands back null (tainted or too large)", async () => {
    const canvas = { toBlob: (cb) => cb(null) };
    await expect(canvasToBlob(canvas)).rejects.toThrow(/couldn't encode/i);
  });

  it("rejects when toBlob throws outright (CORS-tainted canvas)", async () => {
    const canvas = {
      toBlob: () => {
        throw new DOMException("Tainted canvases may not be exported.", "SecurityError");
      },
    };
    await expect(canvasToBlob(canvas)).rejects.toThrow(/tainted/i);
  });
});

describe("downloadBlob", () => {
  it("creates and then revokes an object URL", async () => {
    const revoke = vi.fn();
    vi.stubGlobal("URL", { createObjectURL: () => "blob:dl", revokeObjectURL: revoke });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    downloadBlob(new Blob(["x"]), "out.png");
    await new Promise((r) => setTimeout(r, 5));
    expect(revoke).toHaveBeenCalledWith("blob:dl");
  });
});
