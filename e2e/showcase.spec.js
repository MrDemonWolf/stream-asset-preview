import { expect, test } from "@playwright/test";

import { uploadFiles } from "./helpers.js";

test.beforeEach(async ({ page }) => {
  await page.goto("./");
  await page.getByRole("radio", { name: /Build a showcase/i }).click();
});

// Section order matches specs.js: follower, tier1, tier2, tier3, animated, bits.
const FOLLOWER = 0;
const TIER1 = 1;
const ANIMATED = 4;

test("slot counts follow the status and sub points, per pool", async ({ page }) => {
  await expect(page.getByText(/Affiliate · 0 sub pts/)).toBeVisible();
  await expect(page.getByText(/unlocks at 15 sub points/i)).toBeVisible();

  const tier1Cap = page.getByRole("spinbutton", { name: /Tier 1 slot limit/i });
  await expect(tier1Cap).toHaveValue("5"); // affiliate Tier-1 static start

  const animatedCap = page.getByRole("spinbutton", { name: /Animated slot limit/i });
  await expect(animatedCap).toHaveValue("1"); // animated pool starts lower — independent

  // Partner re-seeds both pools to their own, different starts.
  await page.getByRole("radio", { name: "Partner", exact: true }).click();
  await expect(tier1Cap).toHaveValue("10");
  await expect(animatedCap).toHaveValue("5");
});

test("passing a sub-point milestone raises both Tier-1 pools independently", async ({ page }) => {
  const tier1Cap = page.getByRole("spinbutton", { name: /Tier 1 slot limit/i });
  const animatedCap = page.getByRole("spinbutton", { name: /Animated slot limit/i });
  await page.getByRole("spinbutton", { name: "Sub points" }).fill("15");
  await expect(tier1Cap).toHaveValue("6"); // 5 + 1
  await expect(animatedCap).toHaveValue("2"); // 1 + 1 — different number, same milestone
});

test("Discord boost level drives every slot cap", async ({ page }) => {
  await page.getByRole("radio", { name: "Discord", exact: true }).click();
  const emojiCap = page.getByRole("spinbutton", { name: /Standard Emoji slot limit/i });
  await expect(emojiCap).toHaveValue("50");
  await page.getByRole("radio", { name: "Level 3", exact: true }).click();
  await expect(emojiCap).toHaveValue("250");
  // The corrected animated-emoji cap is surfaced in the spec line.
  await expect(page.getByText(/128×128 animated GIF · ≤256 KB/)).toBeVisible();
});

test("a static file is refused by the animated-only slot", async ({ page }) => {
  await uploadFiles(page, [{ kind: "png" }], { index: ANIMATED });
  await expect(page.getByRole("alert")).toContainText(/needs an animated file/i);
});

test("an animated GIF is refused by a static-only tier", async ({ page }) => {
  await uploadFiles(page, [{ kind: "gif" }], { index: TIER1 });
  await expect(page.getByRole("alert")).toContainText(/static only/i);
});

test("an either-slot takes both, and each rejected file is named", async ({ page }) => {
  await uploadFiles(page, [{ kind: "png" }, { kind: "gif" }], { index: FOLLOWER });
  await expect(page.getByRole("button", { name: /Remove smoke/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Remove loop/i })).toBeVisible();

  // A bad file in a batch is reported by name without killing the good ones.
  await uploadFiles(page, [{ kind: "text", name: "broken.png" }], { index: FOLLOWER });
  await expect(page.getByRole("alert")).toContainText("broken.png");
});

test("to-do list tracks under-cap, and removing an item updates it", async ({ page }) => {
  await uploadFiles(page, [{ kind: "png" }], { index: FOLLOWER });
  await expect(page.getByRole("heading", { name: "To-do" })).toBeVisible();
  await page.getByRole("button", { name: /Remove smoke/i }).click();
  await expect(page.getByRole("button", { name: /Remove smoke/i })).toHaveCount(0);
});

test("export bakes a PNG and reports success", async ({ page }) => {
  await uploadFiles(page, [{ kind: "png" }], { index: FOLLOWER });
  const exportBtn = page.getByRole("button", { name: /Export PNG/i }).first();
  await expect(exportBtn).toBeEnabled();

  const download = page.waitForEvent("download");
  await exportBtn.click();
  expect((await download).suggestedFilename()).toMatch(/-twitch-showcase\.png$/);
  await expect(page.getByText(/Showcase PNG downloaded/i)).toBeVisible();
});

test("a title with path characters still yields a safe filename", async ({ page }) => {
  await page.getByRole("textbox", { name: /Showcase title/i }).fill("../../etc/passwd");
  await uploadFiles(page, [{ kind: "png" }], { index: FOLLOWER });
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: /Export PNG/i })
    .first()
    .click();
  const name = (await download).suggestedFilename();
  expect(name).not.toContain("/");
  expect(name).not.toContain("..");
  expect(name).toMatch(/\.png$/);
});

test("Clear asks for confirmation before wiping the set", async ({ page }) => {
  await uploadFiles(page, [{ kind: "png" }], { index: FOLLOWER });
  await page.getByRole("button", { name: /^Clear/ }).click();
  await expect(page.getByRole("button", { name: /Confirm clear/i })).toBeVisible();
  await page.getByRole("button", { name: /Cancel/i }).click();
  await expect(page.getByRole("button", { name: /Remove smoke/i })).toBeVisible();

  await page.getByRole("button", { name: /^Clear/ }).click();
  await page.getByRole("button", { name: /Confirm clear/i }).click();
  await expect(page.getByRole("button", { name: /Remove smoke/i })).toHaveCount(0);
});

test("Load from channel stays hidden without a configured client-id", async ({ page }) => {
  await expect(page.getByText(/Load current emotes from a channel/i)).toHaveCount(0);
});

test("switching views mid-session leaves no console errors", async ({ page }) => {
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));
  await uploadFiles(page, [{ kind: "gif" }], { index: FOLLOWER });
  await expect(page.getByRole("button", { name: /Remove loop/i })).toBeVisible();
  // Unmounts Showcase — exercises the blob-URL revoke + abort cleanup path.
  await page.getByRole("radio", { name: /Crop one/i }).click();
  await page.getByRole("radio", { name: /Build a showcase/i }).click();
  expect(errors).toEqual([]);
});
