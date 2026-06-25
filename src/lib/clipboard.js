import { useCallback, useRef, useState } from "react";

// Copy a string and flip a transient "copied" flag back off after `ms`.
export function useCopy(ms = 1200) {
  const [copied, setCopied] = useState(null);
  const timer = useRef(null);

  const copy = useCallback(
    async (text) => {
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        // ponytail: clipboard API needs a secure context; fall back to a temp textarea.
        const el = document.createElement("textarea");
        el.value = text;
        el.style.position = "fixed";
        el.style.opacity = "0";
        document.body.appendChild(el);
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
      }
      setCopied(text);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(null), ms);
    },
    [ms],
  );

  return { copied, copy };
}
