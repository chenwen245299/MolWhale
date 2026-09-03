import { useState } from "react";

import { collapseTransition, useTokens } from "../theme";
import type { DragSplit } from "./useDragSplit";

/**
 * The visible grab area for a `useDragSplit` seam.
 *
 * The hit area is deliberately wider than the 1px line it draws: a 1px target
 * is miserable to hit, so the handle spans 7px and is pulled back over its
 * neighbour with a negative margin, leaving the layout maths untouched.
 */
export function SplitHandle({
  split,
  orientation,
  collapsed,
}: {
  split: DragSplit;
  orientation: "vertical" | "horizontal";
  /** Shrink to nothing alongside a collapsing pane, rather than unmounting. */
  collapsed?: boolean;
}) {
  const tokens = useTokens();
  const [hovered, setHovered] = useState(false);
  const active = hovered || split.dragging;
  const isVertical = orientation === "vertical";

  return (
    <div
      {...split.handleProps}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      role="separator"
      aria-orientation={orientation}
      style={{
        position: "relative",
        flex: "0 0 auto",
        zIndex: 5,
        cursor: isVertical ? "col-resize" : "row-resize",
        touchAction: "none",
        opacity: collapsed ? 0 : 1,
        pointerEvents: collapsed ? "none" : "auto",
        transition: collapseTransition("width", "margin", "opacity"),
        ...(isVertical
          ? {
              width: collapsed ? 0 : 7,
              marginLeft: collapsed ? 0 : -3,
              marginRight: collapsed ? 0 : -3,
              alignSelf: "stretch",
            }
          : { height: 7, marginTop: -3, marginBottom: -3, alignSelf: "stretch" }),
      }}
    >
      <div
        style={{
          position: "absolute",
          background: active ? tokens.handleActive : tokens.separator,
          transition: "background 120ms ease",
          ...(isVertical
            ? { top: 0, bottom: 0, left: 3, width: 1 }
            : { left: 0, right: 0, top: 3, height: 1 }),
        }}
      />
    </div>
  );
}
