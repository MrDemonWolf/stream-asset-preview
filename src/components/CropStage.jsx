import { useEffect, useId, useRef, useState } from "react";
import { Expand, Maximize, RotateCcw, ZoomIn } from "lucide-react";

import { Button } from "@/components/ui/button";
import { clampCrop, containCrop, coverCrop, recenter } from "@/lib/resize";

// The crop window is drawn at this fraction of the stage, leaving a margin so
// the dimmed, about-to-be-cropped area stays visible around it.
const CROP_RATIO = 0.7;
// One zoom notch (wheel tick or +/− key) scales the crop by this factor.
const ZOOM_STEP = 1.12;
// One arrow-key nudge pans by this fraction of the current crop size, so the
// step scales with how far you're zoomed in.
const PAN_STEP = 0.06;

// Interactive square-crop editor. Shows the WHOLE source with everything outside
// the square crop window dimmed — so you can see exactly what will (bright) and
// won't (dim) end up in the emote/sticker. Drag to move, scroll or slide to
// zoom. The crop ({x,y,size} in source px) is owned by the parent (it rasterizes
// the result); every change is reported through onChange.
export function CropStage({ img, src, crop, onChange, autoFocus = false }) {
  const stageRef = useRef(null);
  const drag = useRef(null);
  const [stagePx, setStagePx] = useState(0);
  const statusId = useId();

  // After an image loads, move focus into the editor so keyboard users land on
  // the pan/zoom surface (paired with App's "crop editor ready" announcement).
  useEffect(() => {
    if (autoFocus) stageRef.current?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const natW = img.naturalWidth;
  const natH = img.naturalHeight;
  // Zoom bounds: out to 3× the longest side (generous padding); in to whichever
  // is larger of 12px or ⅛ of the shorter side — then clamped to maxSize so a
  // tiny (few-px) source can't invert the bounds.
  const maxSize = Math.max(natW, natH) * 3;
  const minSize = Math.min(Math.max(12, Math.min(natW, natH) / 8), maxSize);

  // Functional updater: reads the LATEST crop, so a rapid wheel/arrow-key burst
  // compounds instead of collapsing to one step against a stale closure.
  const update = (fn) => onChange((prev) => clampCrop(fn(prev), natW, natH, minSize, maxSize));
  const commit = (next) => update(() => next);

  // Zoom about the crop center so the framed subject stays put.
  const zoomAbout = (c, factor) => recenter(c, c.size * factor);

  // Measure the stage so the pan/zoom math matches what's on screen, and stays
  // correct when the layout reflows (mobile, sidebar, window resize).
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    setStagePx(el.clientWidth);
    const ro = new ResizeObserver(([e]) => setStagePx(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Native non-passive wheel listener — React's onWheel can't reliably
  // preventDefault, and we need to stop the page scrolling while zooming.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      update((prev) => zoomAbout(prev, e.deltaY < 0 ? 1 / ZOOM_STEP : ZOOM_STEP));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [img]);

  const cropSidePx = stagePx * CROP_RATIO;
  const k = cropSidePx / crop.size; // screen px per source px
  const c0 = (stagePx - cropSidePx) / 2; // crop window top-left in stage px

  // Slider position (0 = zoomed out / whole image, 1 = tight) mapped in log space.
  // A degenerate source (min === max, e.g. a 1–4px image) has no zoom range, so
  // guard the log math against a divide-by-zero NaN and disable the control.
  const zoomDisabled = !(maxSize > minSize);
  const zoomT = zoomDisabled ? 0 : 1 - logNorm(crop.size, minSize, maxSize);
  function onZoomSlider(t) {
    const size = logLerp(minSize, maxSize, 1 - t);
    update((prev) => recenter(prev, size));
  }

  // Keyboard equivalent for pan/zoom (WCAG 2.1.1): arrows nudge the frame, +/−
  // zoom. Step is ~6% of the frame so it scales with the current zoom.
  function onKeyDown(e) {
    const step = Math.max(1, crop.size * PAN_STEP);
    const pan = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    if (pan[e.key]) {
      e.preventDefault();
      const [dx, dy] = pan[e.key];
      update((prev) => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
    } else if (e.key === "+" || e.key === "=") {
      e.preventDefault();
      update((prev) => zoomAbout(prev, 1 / ZOOM_STEP));
    } else if (e.key === "-" || e.key === "_") {
      e.preventDefault();
      update((prev) => zoomAbout(prev, ZOOM_STEP));
    }
  }

  // Live, non-visual readout of what's framed (the dim overlay is colour-only).
  const framing = `Crop ${Math.round(crop.size)} source pixels, centered at ${Math.round(
    crop.x + crop.size / 2,
  )}, ${Math.round(crop.y + crop.size / 2)}`;

  function onPointerDown(e) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY };
  }
  function onPointerMove(e) {
    // Ignore until the stage has been measured (k would be 0 → Infinity deltas).
    if (!drag.current || stagePx <= 0) return;
    const dx = (e.clientX - drag.current.x) / k; // stage px → source px
    const dy = (e.clientY - drag.current.y) / k;
    drag.current = { x: e.clientX, y: e.clientY };
    // Functional update reads the LATEST crop, so several move events landing in
    // one frame accumulate instead of collapsing against a stale render closure.
    update((prev) => ({ ...prev, x: prev.x - dx, y: prev.y - dy }));
  }
  function onPointerUp(e) {
    if (drag.current) e.currentTarget.releasePointerCapture(e.pointerId);
    drag.current = null;
  }

  const ready = stagePx > 0;

  return (
    <div className="space-y-3">
      <div
        ref={stageRef}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        // No role="application" — it suppresses screen-reader browse mode. This
        // is a focusable group with a documented keyboard model + live readout.
        role="group"
        aria-label="Crop editor — drag or arrow keys to move, scroll or +/− to zoom"
        aria-describedby={statusId}
        className="checker relative mx-auto aspect-square w-full max-w-[380px] cursor-grab touch-none select-none overflow-hidden rounded-xl border border-border outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
      >
        {ready && (
          <>
            <img
              src={src}
              alt=""
              draggable={false}
              className={cropSidePx / crop.size > 3 ? "pixelated" : undefined}
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: natW * k,
                height: natH * k,
                transform: `translate(${c0 - crop.x * k}px, ${c0 - crop.y * k}px)`,
                pointerEvents: "none",
              }}
            />
            {/* Dim mask: a transparent square "hole" over the crop, everything
                outside darkened via a huge box-shadow. pointer-events off so
                the drag still lands on the stage. */}
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                left: c0,
                top: c0,
                width: cropSidePx,
                height: cropSidePx,
                boxShadow: "0 0 0 9999px rgba(0,0,0,0.58)",
                outline: "2px solid var(--primary)",
                outlineOffset: -1,
                pointerEvents: "none",
              }}
            >
              {/* rule-of-thirds guides */}
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute inset-y-0 left-1/3 w-px bg-white/25" />
                <div className="absolute inset-y-0 left-2/3 w-px bg-white/25" />
                <div className="absolute inset-x-0 top-1/3 h-px bg-white/25" />
                <div className="absolute inset-x-0 top-2/3 h-px bg-white/25" />
              </div>
            </div>
          </>
        )}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Bright keeps</span> · dimmed gets cropped ·
        drag or arrow keys to move, scroll or +/− to zoom
      </p>
      <p id={statusId} aria-live="polite" aria-atomic="true" className="sr-only">
        {framing}
      </p>

      {/* Zoom slider — the whole row is a tall (py-3) touch target, and the
          thumb is enlarged to ~24px so it's finger-friendly on mobile. */}
      <div className="flex items-center gap-3">
        <ZoomIn className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <input
          type="range"
          min={0}
          max={1}
          step={0.001}
          value={zoomT}
          disabled={zoomDisabled}
          onChange={(e) => onZoomSlider(Number(e.target.value))}
          aria-label="Zoom"
          aria-valuetext={`${Math.round(crop.size)} source pixels`}
          className="h-6 w-full cursor-pointer appearance-none bg-transparent accent-primary [&::-moz-range-thumb]:size-6 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-primary [&::-moz-range-track]:h-2 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-muted [&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-muted [&::-webkit-slider-thumb]:-mt-2 [&::-webkit-slider-thumb]:size-6 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary"
        />
      </div>

      {/* Fit / Fill / Center */}
      <div className="flex flex-wrap justify-center gap-2">
        <Button size="sm" variant="secondary" onClick={() => commit(containCrop(img))}>
          <Expand /> Fit (no crop)
        </Button>
        <Button size="sm" variant="secondary" onClick={() => commit(coverCrop(img))}>
          <Maximize /> Fill (crop edges)
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() =>
            commit({ x: (natW - crop.size) / 2, y: (natH - crop.size) / 2, size: crop.size })
          }
        >
          <RotateCcw /> Center
        </Button>
      </div>
    </div>
  );
}

// Where `v` sits between `min` and `max` on a log scale, as 0..1.
function logNorm(v, min, max) {
  const t = (Math.log(v) - Math.log(min)) / (Math.log(max) - Math.log(min));
  return Math.min(Math.max(t, 0), 1);
}
function logLerp(min, max, t) {
  return Math.exp(Math.log(min) + (Math.log(max) - Math.log(min)) * t);
}
