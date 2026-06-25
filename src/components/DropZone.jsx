import { useRef, useState } from "react";
import { FolderOpen, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { parseFiles } from "@/lib/loadAssets";
import { cn } from "@/lib/utils";

// Drag-and-drop a folder, or pick one manually. Walks the dropped directory tree
// via the webkitGetAsEntry API so it works with zero server.
export function DropZone({ onLoad, compact = false }) {
  const [over, setOver] = useState(false);
  const dirInput = useRef(null);
  const fileInput = useRef(null);

  async function handleDrop(e) {
    e.preventDefault();
    setOver(false);
    const items = e.dataTransfer.items;
    if (items && items.length && items[0].webkitGetAsEntry) {
      const files = await collectEntries(items);
      if (files.length) onLoad(parseFiles(files));
      return;
    }
    if (e.dataTransfer.files?.length) onLoad(parseFiles(e.dataTransfer.files));
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={handleDrop}
      className={cn(
        "rounded-xl border border-dashed border-border bg-card/40 text-center transition-colors",
        over && "border-primary bg-primary/5",
        compact ? "px-4 py-4" : "px-6 py-14",
      )}
    >
      {!compact && (
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Upload className="size-6" />
        </div>
      )}
      <p className={cn("text-foreground", compact ? "text-sm" : "text-base font-medium")}>
        {compact ? "Load a different folder" : "Drag a folder of badges & emotes here"}
      </p>
      {!compact && (
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
          Expecting <code className="font-mono text-primary">badges/&lt;name&gt;/&lt;size&gt;.png</code>{" "}
          and <code className="font-mono text-primary">emotes/&lt;code&gt;/&lt;size&gt;.png</code>.
          Nothing is uploaded — files stay in your browser.
        </p>
      )}

      <div className={cn("flex flex-wrap items-center justify-center gap-2", compact ? "mt-3" : "mt-5")}>
        <Button variant="secondary" size={compact ? "sm" : "default"} onClick={() => dirInput.current?.click()}>
          <FolderOpen /> Choose folder
        </Button>
        <Button variant="ghost" size={compact ? "sm" : "default"} onClick={() => fileInput.current?.click()}>
          <Upload /> Select files
        </Button>
      </div>

      {/* webkitdirectory: whole-folder picker. Plain input: hand-pick loose PNGs. */}
      <input
        ref={dirInput}
        type="file"
        webkitdirectory=""
        directory=""
        multiple
        hidden
        onChange={(e) => e.target.files?.length && onLoad(parseFiles(e.target.files))}
      />
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => e.target.files?.length && onLoad(parseFiles(e.target.files))}
      />
    </div>
  );
}

// Recursively read dropped DataTransferItem entries into a flat File[] that
// carries webkitRelativePath, so parseFiles() sees the folder structure.
async function collectEntries(items) {
  const roots = [];
  for (const item of items) {
    const entry = item.webkitGetAsEntry?.();
    if (entry) roots.push(entry);
  }
  const out = [];
  await Promise.all(roots.map((entry) => walk(entry, out)));
  return out;
}

function walk(entry, out, prefix = "") {
  return new Promise((resolve) => {
    if (entry.isFile) {
      entry.file((file) => {
        // rebuild the relative path the directory picker would have given us
        Object.defineProperty(file, "webkitRelativePath", {
          value: prefix + entry.name,
          configurable: true,
        });
        out.push(file);
        resolve();
      }, resolve);
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      const all = [];
      const readBatch = () =>
        reader.readEntries(async (batch) => {
          if (!batch.length) {
            await Promise.all(all.map((e) => walk(e, out, prefix + entry.name + "/")));
            resolve();
            return;
          }
          all.push(...batch);
          readBatch();
        }, resolve);
      readBatch();
    } else {
      resolve();
    }
  });
}
