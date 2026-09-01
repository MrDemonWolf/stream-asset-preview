import { expect, test } from "@playwright/test";

// Generate a real NxN PNG in the page and feed it to a hidden <input type=file>
// via its change handler — no on-disk fixtures, and it exercises the actual
// content-sniff + decode + validation path.
async function uploadGeneratedPng(page, { index = 0, size = 96 } = {}) {
  await page.evaluate(
    ({ index, size }) =>
      new Promise((resolve) => {
        const c = document.createElement("canvas");
        c.width = size;
        c.height = size;
        const ctx = c.getContext("2d");
        ctx.fillStyle = "#0099ff";
        ctx.fillRect(0, 0, size, size);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(size / 4, size / 4, size / 2, size / 2);
        c.toBlob((blob) => {
          const file = new File([blob], "smoke.png", { type: "image/png" });
          const dt = new DataTransfer();
          dt.items.add(file);
          const input = document.querySelectorAll('input[type="file"]')[index];
          input.files = dt.files;
          input.dispatchEvent(new Event("change", { bubbles: true }));
          resolve();
        }, "image/png");
      }),
    { index, size },
  );
}

test("crop flow: upload → sizes render → download a PNG", async ({ page }) => {
  await page.goto("./");
  await uploadGeneratedPng(page);

  // The generated-sizes panel appears once the crop rasterizes.
  await expect(page.getByRole("heading", { name: "Export sizes" })).toBeVisible();

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: /Download 28px PNG/i }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/\.png$/);
});

test("keyboard: crop editor pans on arrow keys", async ({ page }) => {
  await page.goto("./");
  await uploadGeneratedPng(page);

  const editor = page.getByRole("group", { name: /Crop editor/i });
  await editor.focus();
  await expect(editor).toBeFocused();
  // Pressing an arrow must not throw and the app stays interactive.
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowUp");
  await expect(page.getByRole("heading", { name: "Export sizes" })).toBeVisible();
});

test("showcase flow: add an emote → export PNG", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("radio", { name: /Build a showcase/i }).click();

  // Drop into the first section (Follower) via its file input.
  await uploadGeneratedPng(page, { index: 0 });

  const exportBtn = page.getByRole("button", { name: /Export PNG/i }).first();
  await expect(exportBtn).toBeEnabled();
  const download = page.waitForEvent("download");
  await exportBtn.click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/-twitch-showcase\.png$/);
});
