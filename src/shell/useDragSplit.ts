import { useCallback, useRef, useState } from "react";

/**
 * One hook behind all three of MolWhale's resizable seams: the left sidebar's
 * width, the right sidebar's width, and the horizontal split inside the right
 * sidebar.
 *
 * react-native-web has no splitter primitive, so this works at the DOM level:
 * pointer capture on the handle means the drag keeps tracking even when the
 * cursor outruns the handle or leaves the window, which is exactly the case
 * where a naive mousemove-on-document implementation drops the drag.
 *
 * `direction` says which way a *positive* pointer delta grows the pane:
 * `"start"` for a pane anchored to the left/top edge, `"end"` for one anchored
 * to the right/bottom (where dragging left must make it bigger).
 */
export interface DragSplitOptions {
  axis: "x" | "y";
  direction: "start" | "end";
  initial: number;
  min: number;
  max: number;
  /** When set, the size is persisted to localStorage under this key. */
  storageKey?: string;
}

export interface DragSplit {
  size: number;
  setSize: (size: number) => void;
  dragging: boolean;
  /** Spread onto the handle element. */
  handleProps: {
    onPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
    onDoubleClick: () => void;
  };
}

function readStored(key: string | undefined, fallback: number): number {
  if (!key) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    const parsed = Number.parseFloat(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
  } catch {
    // Private windows and blocked site data both throw here; the layout should
    // still come up at its default size.
    return fallback;
  }
}

export function useDragSplit(options: DragSplitOptions): DragSplit {
  const { axis, direction, initial, min, max, storageKey } = options;

  const clamp = useCallback((value: number) => Math.min(max, Math.max(min, value)), [min, max]);

  const [stored, setStoredSize] = useState(() => readStored(storageKey, initial));
  const [dragging, setDragging] = useState(false);

  // Clamped at render rather than in an effect: when the bounds move (the
  // window got narrower), the corrected value is what this render already
  // paints, instead of a first paint at the stale size followed by a second.
  const size = clamp(stored);

  // The drag reads these through a ref so the pointermove listener does not
  // need re-binding on every size change.
  const origin = useRef({ pointer: 0, size: 0 });

  const setSize = useCallback(
    (next: number) => {
      const clamped = clamp(next);
      setStoredSize(clamped);
      if (storageKey) {
        try {
          window.localStorage.setItem(storageKey, String(clamped));
        } catch {
          // Persisting the size is a convenience, never a requirement.
        }
      }
    },
    [clamp, storageKey],
  );

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      event.preventDefault();
      const target = event.currentTarget;
      target.setPointerCapture(event.pointerId);

      origin.current = {
        pointer: axis === "x" ? event.clientX : event.clientY,
        size,
      };
      setDragging(true);
      document.body.classList.add(axis === "x" ? "mw-resizing-col" : "mw-resizing-row");

      const onMove = (move: PointerEvent) => {
        const current = axis === "x" ? move.clientX : move.clientY;
        const delta = current - origin.current.pointer;
        setSize(origin.current.size + (direction === "start" ? delta : -delta));
      };

      const onUp = () => {
        setDragging(false);
        document.body.classList.remove("mw-resizing-col", "mw-resizing-row");
        target.removeEventListener("pointermove", onMove);
        target.removeEventListener("pointerup", onUp);
        target.removeEventListener("pointercancel", onUp);
        try {
          target.releasePointerCapture(event.pointerId);
        } catch {
          // Capture is already gone if the pointer was lost; nothing to undo.
        }
      };

      target.addEventListener("pointermove", onMove);
      target.addEventListener("pointerup", onUp);
      target.addEventListener("pointercancel", onUp);
    },
    [axis, direction, setSize, size],
  );

  // Double-click restores the default, the standard escape hatch for a pane
  // dragged somewhere useless.
  const onDoubleClick = useCallback(() => setSize(initial), [initial, setSize]);

  return { size, setSize, dragging, handleProps: { onPointerDown, onDoubleClick } };
}
