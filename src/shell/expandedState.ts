const STORAGE_KEY = "molwhale.projects.expanded";

/**
 * Which projects are expanded in the rail, remembered across launches.
 *
 * Stored as a list of expanded ids rather than a full `{id: boolean}` map, so
 * the entry does not accumulate a `false` for every project the user has ever
 * collapsed. Ids are directory names; one that no longer exists is simply
 * pruned on the next write.
 */
export function readExpanded(): Record<string, boolean> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const ids: unknown = JSON.parse(raw);
    if (!Array.isArray(ids)) return {};
    return Object.fromEntries(
      ids.filter((id): id is string => typeof id === "string").map((id) => [id, true]),
    );
  } catch {
    // Private windows, blocked site data, or a corrupt value: start collapsed
    // rather than take the sidebar down with it.
    return {};
  }
}

/** `knownIds` prunes entries for projects that have since been deleted. */
export function writeExpanded(expanded: Record<string, boolean>, knownIds: string[]): void {
  try {
    const known = new Set(knownIds);
    const ids = Object.entries(expanded)
      .filter(([id, open]) => open && known.has(id))
      .map(([id]) => id);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Remembering the state is a convenience, never a requirement.
  }
}
