import type { ReactNode } from "react";

import { PlaceholderPanel } from "./PlaceholderPanel";

/**
 * What the right sidebar can show.
 *
 * The two right-hand slots are intentionally undecided. Rather than hard-coding
 * "empty" into the layout, the layout asks this registry for a panel by id — so
 * filling one in later is adding an entry here, with no change to
 * `RightSidebar.tsx` or the drag/resize logic around it.
 */
export interface PanelContext {
  projectId: string | null;
  conversationId: string | null;
}

export interface PanelDefinition {
  id: string;
  /** Key into the i18n string table, so panel names localise like everything else. */
  titleKey: "panelTopTitle" | "panelBottomTitle";
  render: (context: PanelContext) => ReactNode;
}

export const PANELS: PanelDefinition[] = [
  {
    id: "top",
    titleKey: "panelTopTitle",
    render: (context) => <PlaceholderPanel slot="top" context={context} />,
  },
  {
    id: "bottom",
    titleKey: "panelBottomTitle",
    render: (context) => <PlaceholderPanel slot="bottom" context={context} />,
  },
];

export function panelById(id: string): PanelDefinition | undefined {
  return PANELS.find((panel) => panel.id === id);
}
