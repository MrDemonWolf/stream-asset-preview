# UI/UX Review: Stream Asset Previewer (single-page tool)

**Reviewed:** 2026-06-25 · **Input:** Local code (`src/App.jsx`, `src/components/ChatPreview.jsx`, `src/index.css`) + verified local screenshots · **Method:** NN/g heuristic evaluation + guideline review

## Executive summary

- Focused, single-task one-pager with a clear primary action (drop an image) and strong visual hierarchy — the worst problems are accessibility details, not flow or clarity.
- **No catastrophic or blocking issues.** Primary text contrast measures well (muted text `#adadb8` on `#0e0e10` ≈ **8.6:1**, AA pass).
- Single worst problem before fixes: custom controls (Badge/Emote toggle, drag-drop button) had **no visible keyboard focus indicator** — fixed during this review.
- Remaining items are small-text legibility and touch-target sizing on secondary controls.

**Findings:** 🟥 0 catastrophic · 🟧 1 major · 🟨 2 minor · ⬜ 1 cosmetic

## Findings

### 🟧 Severity 3 — Major

#### 1. Custom controls lacked a visible keyboard focus indicator (FIXED)
- **What:** The Badge/Emote segmented toggle and the drag-drop upload button were plain `<button>`s with `transition-colors` only — no `:focus-visible` style. Keyboard users tabbing through the page got no indication of focus. (shadcn `Button`/`Input` already ship focus rings; these two custom buttons did not.)
- **Where:** `src/App.jsx` — mode toggle group and `Uploader` drop button.
- **Guideline:** Keyboard accessibility — keyboard users must get the same focus feedback mouse users get; removing/omitting the focus indicator is severe for keyboard navigation.
- **Evidence:** [Keyboard-Only Navigation for Improved Accessibility](https://www.nngroup.com/articles/keyboard-accessibility/) — a visible focus indicator is essential; it should be styled to match the design, never absent. (Also WCAG 2.4.7 Focus Visible.)
- **Fix:**
  - [x] Add `focus-visible:ring-2 focus-visible:ring-ring outline-none` to the toggle buttons.
  - [x] Add `focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring` to the drop button.

### 🟨 Severity 2 — Minor

#### 2. Secondary metadata text is very small (9–10px)
- **What:** Size labels, per-file KB, and the “Upload to Twitch” chip render at 9–10px. Below a comfortable legibility floor, especially the uppercase tracked chip. Bumped the chip to 10px; the px/KB labels remain 10px (acceptable as glanceable metadata, but not below).
- **Where:** `src/App.jsx` — `.checker` size row labels and the upload chip.
- **Guideline:** Legibility — tiny text harms readability and excludes lower-acuity users.
- **Evidence:** [Legibility, Readability, and Comprehension](https://www.nngroup.com/articles/legibility-readability-comprehension/) and [Typography for Glanceable Reading: Bigger Is Better](https://www.nngroup.com/articles/glanceable-fonts/) — use a reasonably large default size; glanceable labels should err larger.
- **Fix:**
  - [x] Raise the chip from 9px to 10px.
  - [ ] Optional: raise px/KB labels to 11px for comfort.

#### 3. Per-size download buttons are a small touch target
- **What:** The per-size “PNG” buttons are 24px tall (`h-6`). They meet the WCAG 2.2 AA 24px floor but sit well under the comfortable ~44px target, and they're densely packed in the size row.
- **Where:** `src/App.jsx` — `Uploader` per-size download buttons.
- **Guideline:** Touch targets must be large enough to acquire accurately; small, dense targets cause mis-taps.
- **Evidence:** [Touch Targets on Touchscreens](https://www.nngroup.com/articles/touch-target-size/) — undersized or densely packed targets are hard to hit.
- **Fix:**
  - [ ] Raise per-size buttons to `h-7`/`h-8`, or rely on the existing full-size “Download all” (44px-class) as the primary path and keep per-size as secondary.

### ⬜ Severity 1 — Cosmetic

#### 4. Mode toggle uses `aria-pressed` rather than radio semantics
- **What:** The Badge/Emote control is a mutually-exclusive choice but exposes two `aria-pressed` buttons instead of a `radiogroup`. Functional and announced, but a radio group communicates “one of two” more precisely and enables arrow-key selection.
- **Where:** `src/App.jsx` — mode toggle.
- **Guideline:** Match control semantics to the interaction (reviewer judgment, supported by ARIA Authoring Practices for radio groups).
- **Evidence:** [Keyboard-Only Navigation for Improved Accessibility](https://www.nngroup.com/articles/keyboard-accessibility/) — predictable keyboard interaction for grouped controls.
- **Fix:**
  - [ ] Optional: convert to `role="radiogroup"` + `role="radio"`/`aria-checked` with arrow-key handling.

## Unverified (needs a different input to check)
- **Username color contrast in the chat preview** — the name color is user-chosen (`#00aced` default ≈ 6:1 on the chat panel, AA pass), but a user can pick any value; can't be guaranteed from static review.
- **Screen-reader announcement order** — needs an actual SR pass (VoiceOver/NVDA), not static code.

## What's working well
- Strong, conventional hierarchy: one clear h1, a single dominant primary action, and the Twitch-dark theme with one decisive purple accent.
- Help is in context, not hidden — spec warnings (non-square, upscaled, >cap, animated) and the “Next steps” checklist support **recognition over recall** (Heuristic #6).
- Good primary-text contrast (measured 8.0–8.6:1) and bundled, distinctive fonts (no generic system stack).
- Immediate, visible system status — sizes, file weights, and chat preview update the instant an image is dropped (Heuristic #1).

## Quick wins
- [x] Add focus-visible rings to the toggle + drop button (finding #1).
- [x] Bump the upload chip to 10px (finding #2).
- [ ] Raise per-size download buttons to `h-7` (finding #3).
