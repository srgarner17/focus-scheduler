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
