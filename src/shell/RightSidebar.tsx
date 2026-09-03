import { useT } from "../i18n";
import { PANELS, type PanelContext } from "../panels/registry";
import { SHELL_HEADER_HEIGHT, space, type as typeScale, useTokens } from "../theme";
import { SplitHandle } from "./SplitHandle";
import { useDragSplit } from "./useDragSplit";

/**
 * The right rail: two stacked panels with a draggable seam between them.
 *
 * The top panel's height is what the drag controls; the bottom takes the rest.
 * Sizing one and letting the other flex means the pair always exactly fills the
 * rail, with no rounding drift as the window resizes.
 */
export function RightSidebar({ context }: { context: PanelContext }) {
  const tokens = useTokens();
  const t = useT();

  const split = useDragSplit({
    axis: "y",
    direction: "start",
    initial: 320,
    min: 120,
    max: 900,
    storageKey: "molwhale.rightPanel.topHeight",
  });

  const [top, bottom] = PANELS;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: tokens.railSurface,
        minWidth: 0,
      }}
    >
      <section
        style={{
          height: split.size,
          flex: "0 0 auto",
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
        }}
      >
        {/* Only the top header sits in the window's titlebar strip, so only it
            doubles as a drag handle. */}
        <PanelHeader title={t[top.titleKey]} draggable />
        {top.render(context)}
      </section>

      <SplitHandle split={split} orientation="horizontal" />

      <section style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
        <PanelHeader title={t[bottom.titleKey]} />
        {bottom.render(context)}
      </section>
    </div>
  );
}

function PanelHeader({ title, draggable }: { title: string; draggable?: boolean }) {
  const tokens = useTokens();
  return (
    <header
      // "deep" so the label drags too; a bare drag region only fires on direct
      // hits, which would leave the text itself dead to the pointer.
      data-tauri-drag-region={draggable ? "deep" : undefined}
      style={{
        height: SHELL_HEADER_HEIGHT,
        flex: "0 0 auto",
        display: "flex",
        alignItems: "center",
        paddingLeft: space(3),
        paddingRight: space(2),
        borderBottom: `1px solid ${tokens.separator}`,
        ...typeScale.label,
        color: tokens.textSecondary,
      }}
    >
      {title}
    </header>
  );
}
