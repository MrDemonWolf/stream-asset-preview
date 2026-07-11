import { useId, useRef } from "react";

import { cn } from "@/lib/utils";

// One shared single-select pill control, used for every "pick one of N" toggle
// (view, platform, asset type, status, boost level). Implemented as a real
// radiogroup: roving tabindex, Arrow/Home/End to move, so screen readers
// announce it as "N of M" instead of M independent pressed buttons.
//   options: [key, label][]   value: key   onChange(key)
//   label:   accessible group name (always set)
//   showLabel: render a visible console caption above the track
export function Segmented({ label, showLabel = false, value, options, onChange, className, size = "default" }) {
  const groupId = useId();
  const refs = useRef([]);

  const sizeCls =
    size === "lg"
      ? "min-h-12 px-6 text-sm font-semibold sm:min-h-11 sm:text-base"
      : "min-h-11 px-4 text-sm font-medium sm:min-h-8";

  const idx = Math.max(0, options.findIndex(([k]) => k === value));

  function move(to) {
    const n = options.length;
    const next = ((to % n) + n) % n;
    const [key] = options[next];
    onChange(key);
    refs.current[next]?.focus();
  }

  function onKeyDown(e) {
    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
        e.preventDefault();
        move(idx + 1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        e.preventDefault();
        move(idx - 1);
        break;
      case "Home":
        e.preventDefault();
        move(0);
        break;
      case "End":
        e.preventDefault();
        move(options.length - 1);
        break;
      default:
        break;
    }
  }

  const track = (
    <div
      role="radiogroup"
      aria-label={showLabel ? undefined : label}
      aria-labelledby={showLabel ? `${groupId}-label` : undefined}
      onKeyDown={onKeyDown}
      className={cn("inline-flex rounded-lg bg-muted p-[3px]", className)}
    >
      {options.map(([key, text], i) => {
        const selected = key === value;
        return (
          <button
            key={key}
            ref={(el) => (refs.current[i] = el)}
            type="button"
            role="radio"
            aria-checked={selected}
            // Roving tabindex: only the active option (idx, falls back to 0) is
            // in the tab order; arrows move within the group.
            tabIndex={i === idx ? 0 : -1}
            onClick={() => onChange(key)}
            className={cn(
              "flex flex-1 items-center justify-center rounded-md transition-[color,background-color,transform] duration-150 ease-out outline-none active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-ring",
              sizeCls,
              selected
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {text}
          </button>
        );
      })}
    </div>
  );

  if (!showLabel) return track;

  return (
    <div className="space-y-1.5">
      <span id={`${groupId}-label`} className="u-label block">
        {label}
      </span>
      {track}
    </div>
  );
}
