// Shared browser-side file plumbing for the e2e specs. Files are generated in
// the page (canvas → Blob) and handed to a real <input type="file">, so the
// whole intake path runs: magic-byte sniff → decode → validate → render.

/**
 * Push generated files into the Nth hidden file input on the page.
 * `files` entries: { kind: "png"|"gif"|"text", size?: number, name?: string }
 */
export async function uploadFiles(page, files, { index = 0 } = {}) {
  await page.evaluate(
    async ({ files, index }) => {
      function pngBlob(size) {
        const c = document.createElement("canvas");
        c.width = size;
        c.height = size;
        const ctx = c.getContext("2d");
        ctx.fillStyle = "#0099ff";
        ctx.fillRect(0, 0, size, size);
        ctx.fillStyle = "#fff";
        ctx.fillRect(size / 4, size / 4, size / 2, size / 2);
        return new Promise((res) => c.toBlob(res, "image/png"));
      }
      // Smallest valid 1x1 animated GIF (two frames), as raw bytes.
      function gifBlob() {
        const b = new Uint8Array([
          0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00, 0x00, 0xff, 0xff,
          0xff, 0x00, 0x00, 0x00, 0x21, 0xff, 0x0b, 0x4e, 0x45, 0x54, 0x53, 0x43, 0x41, 0x50, 0x45,
          0x32, 0x2e, 0x30, 0x03, 0x01, 0x00, 0x00, 0x00, 0x21, 0xf9, 0x04, 0x00, 0x0a, 0x00, 0x00,
          0x00, 0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x44, 0x01,
          0x00, 0x21, 0xf9, 0x04, 0x00, 0x0a, 0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00, 0x01,
          0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x44, 0x01, 0x00, 0x3b,
        ]);
        return new Blob([b], { type: "image/gif" });
      }

      const dt = new DataTransfer();
      for (const f of files) {
        let blob;
        let name = f.name;
        if (f.kind === "gif") {
          blob = gifBlob();
          name = name || "loop.gif";
        } else if (f.kind === "text") {
          // A text file wearing a .png name — must be rejected by content sniffing.
          blob = new Blob(["definitely not an image"], { type: "image/png" });
          name = name || "liar.png";
        } else {
          blob = await pngBlob(f.size || 96);
          name = name || "smoke.png";
        }
        dt.items.add(new File([blob], name, { type: blob.type }));
      }
      const input = document.querySelectorAll('input[type="file"]')[index];
      input.files = dt.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    },
    { files, index },
  );
}

export const onePng = (page, opts) => uploadFiles(page, [{ kind: "png" }], opts);
