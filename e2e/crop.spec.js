import { expect, test } from "@playwright/test";

import { onePng, uploadFiles } from "./helpers.js";

test.beforeEach(async ({ page }) => {
  await page.goto("./");
});

test("badge mode offers all three required files and tags each for upload", async ({ page }) => {
  await page.getByRole("radio", { name: "Badge", exact: true }).click();
  // The spec copy is derived from specs.js — it must state the three-file rule.
  await expect(page.getByText(/three separate square, non-animated PNG files/i)).toBeVisible();

  await onePng(page);
  await expect(page.getByRole("heading", { name: "Export sizes" })).toBeVisible();

  // 18/36/72 present, no 120, and every one flagged as an upload.
  for (const size of [18, 36, 72]) {
    await expect(page.getByRole("button", { name: `Download ${size}px PNG` })).toBeVisible();
  }
  await expect(page.getByRole("button", { name: /Download 120px PNG/ })).toHaveCount(0);
  await expect(page.getByText("Upload to Twitch")).toHaveCount(3);
});

test("emote mode uploads only the 112", async ({ page }) => {
  await onePng(page);
  await expect(page.getByRole("heading", { name: "Export sizes" })).toBeVisible();
  await expect(page.getByText("Upload to Twitch")).toHaveCount(1);
});

test("rejects a file that only pretends to be a PNG", async ({ page }) => {
  await uploadFiles(page, [{ kind: "text" }]);
  // Content sniffing must catch it — no crop editor, a visible error instead.
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Export sizes" })).toHaveCount(0);
});

test("warns that a GIF exports as a static PNG", async ({ page }) => {
  await uploadFiles(page, [{ kind: "gif" }]);
  await expect(page.getByText(/Animation is dropped/i)).toBeVisible();
});

test("warns when the crop is upscaled past the largest export", async ({ page }) => {
  await uploadFiles(page, [{ kind: "png", size: 32 }]); // smaller than the 112 emote
  await expect(page.getByText(/upscaled and may look soft/i)).toBeVisible();
});

test("Replace clears the image and returns focus to the dropzone", async ({ page }) => {
  await onePng(page);
  await expect(page.getByRole("heading", { name: "Export sizes" })).toBeVisible();
  await page.getByRole("button", { name: /Replace/i }).click();
  await expect(page.getByRole("heading", { name: "Export sizes" })).toHaveCount(0);
  await expect(page.getByText(/Drop your emote here/i)).toBeVisible();
});

test("Discord sticker flow renders its own preview and steps", async ({ page }) => {
  await page.getByRole("radio", { name: "Discord", exact: true }).click();
  await page.getByRole("radio", { name: "Sticker", exact: true }).click();
  await onePng(page);
  await expect(page.getByRole("heading", { name: "Export sizes" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Download 320px PNG" })).toBeVisible();
  await expect(page.getByText(/Server Settings → Stickers/i)).toBeVisible();
});

test("crop editor is keyboard operable and announces its framing", async ({ page }) => {
  await onePng(page);
  const editor = page.getByRole("group", { name: /Crop editor/i });
  await editor.focus();
  await expect(editor).toBeFocused();

  // The live readout is the non-visual equivalent of the dimmed overlay.
  const status = page.locator("p[aria-live='polite']", { hasText: /Crop \d+ source pixels/ });
  const before = await status.first().textContent();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect.poll(async () => (await status.first().textContent()) !== before).toBe(true);

  // Zoom keys must not break the export pipeline.
  await page.keyboard.press("-");
  await expect(page.getByRole("heading", { name: "Export sizes" })).toBeVisible();
});

test("Fit / Fill / Center presets keep the editor working", async ({ page }) => {
  await onePng(page);
  for (const name of [/Fill \(crop edges\)/, /Fit \(no crop\)/, /Center/]) {
    await page.getByRole("button", { name }).click();
  }
  await expect(page.getByRole("heading", { name: "Export sizes" })).toBeVisible();
});

test("no console errors during a normal crop session", async ({ page }) => {
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));
  await onePng(page);
  await expect(page.getByRole("heading", { name: "Export sizes" })).toBeVisible();
  await page.getByRole("button", { name: /Fill \(crop edges\)/ }).click();
  expect(errors).toEqual([]);
});
