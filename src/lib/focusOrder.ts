import type { Category, ScheduleData, ScheduleItem } from '../types';

export interface FocusEntry {
  category: Category;
  item: ScheduleItem;
}

// The full item order the "What's next" focus view walks, before today's
// scheduling/skip/done filters are applied. `data.focusOrder` (a flat list
// of item ids, set by dragging in the "Reorder focus" editor) comes first;
// anything not listed there — a brand-new item, or every item before this
// has ever been set — is appended afterward in category/item order, same
// append-what's-missing convention as reorderItems/reorderCategories.
export function buildFocusSequence(data: ScheduleData): FocusEntry[] {
  const allEntries: FocusEntry[] = [];
  for (const category of data.categories) {
    for (const item of category.items) {
      allEntries.push({ category, item });
    }
  }
  const byItemId = new Map(allEntries.map((entry) => [entry.item.id, entry]));
  const ordered = data.focusOrder
    .map((id) => byItemId.get(id))
    .filter((entry): entry is FocusEntry => entry !== undefined);
  const orderedIdSet = new Set(data.focusOrder);
  const remaining = allEntries.filter((entry) => !orderedIdSet.has(entry.item.id));
  return [...ordered, ...remaining];
}

// The "Reorder focus" editor only shows/drags today's scheduled items (a
// full-schedule list, including items that only ever run on other
// weekdays, would just be clutter for a screen about today's flow) — but
// focusOrder itself still covers every item, so a drag there can't just
// save the visible subset as the new whole order, or every hidden item
// would silently fall out of it. This splices the freshly-reordered
// visible ids back into fullSequence, leaving every other id (an item not
// scheduled today) exactly where it already was.
export function mergeVisibleReorder(
  fullSequence: FocusEntry[],
  visibleIds: string[],
  reorderedVisibleIds: string[],
): string[] {
  const visibleIdSet = new Set(visibleIds);
  let cursor = 0;
  return fullSequence.map((entry) =>
    visibleIdSet.has(entry.item.id) ? reorderedVisibleIds[cursor++] : entry.item.id,
  );
}
