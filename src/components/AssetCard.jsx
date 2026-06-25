import { Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { pickSrc } from "@/lib/loadAssets";
import { cn } from "@/lib/utils";

// One card renders any asset at a row of display sizes. Badges pass 18/36/72,
// emotes pass 28/56/112 — the only real difference is the label and the sizes.
export function AssetCard({ asset, label, name, sizes, onCopy, copied }) {
  const isCopied = copied === name;

  return (
    <Card className="group gap-0 overflow-hidden py-0 transition-colors hover:border-primary/60">
      <div className="checker flex items-end justify-center gap-5 px-5 py-6">
        {sizes.map((size) => {
          const src = pickSrc(asset, size);
          return (
            <div key={size} className="flex flex-col items-center gap-2">
              <div
                className="flex items-center justify-center"
                style={{ width: size, height: size }}
              >
                {src ? (
                  <img
                    src={src}
                    alt={`${name} at ${size}px`}
                    width={size}
                    height={size}
                    className="pixelated max-h-full max-w-full object-contain"
                    loading="lazy"
                  />
                ) : (
                  <div className="size-full rounded border border-dashed border-border" />
                )}
              </div>
              <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                {size}px
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-3">
        <div className="min-w-0">
          <p className="truncate font-mono text-sm text-foreground">{name}</p>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
            {label}
          </p>
        </div>
        <Button
          size="sm"
          variant={isCopied ? "secondary" : "ghost"}
          className={cn("shrink-0", isCopied && "text-primary")}
          onClick={() => onCopy(name)}
          aria-label={`Copy ${label.toLowerCase()} "${name}"`}
        >
          {isCopied ? <Check /> : <Copy />}
          {isCopied ? "Copied" : "Copy"}
        </Button>
      </div>
    </Card>
  );
}
