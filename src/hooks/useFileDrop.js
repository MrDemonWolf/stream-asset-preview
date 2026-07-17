import { useRef, useState } from "react";

import { ACCEPT_ATTR } from "@/lib/image";

// Shared drag-drop + hidden-file-input plumbing for the two dropzones (App's
// uploader and Showcase's per-section card). Owns the "is a file dragged over
// me" state, the click-to-open, and the reset-after-pick; each caller brings its
// own markup and spreads the returned props:
//   const { isOver, dropHandlers, open, inputProps } = useFileDrop(onFiles);
//   <div {...dropHandlers} className={isOver && "…"}>
//     <button onClick={open}>Add</button>
//     <input {...inputProps} />   // add `multiple` here if you want it
//   </div>
export function useFileDrop(onFiles) {
  const input = useRef(null);
  const [isOver, setIsOver] = useState(false);

  const dropHandlers = {
    onDragOver: (e) => {
      e.preventDefault();
      setIsOver(true);
    },
    onDragLeave: () => setIsOver(false),
    onDrop: (e) => {
      e.preventDefault();
      setIsOver(false);
      onFiles(e.dataTransfer.files);
    },
  };

  const inputProps = {
    ref: input,
    type: "file",
    accept: ACCEPT_ATTR,
    hidden: true,
    onChange: (e) => {
      if (e.target.files?.length) onFiles(e.target.files);
      e.target.value = ""; // clear so re-picking the same file still fires
    },
  };

  return { isOver, dropHandlers, open: () => input.current?.click(), inputProps };
}
