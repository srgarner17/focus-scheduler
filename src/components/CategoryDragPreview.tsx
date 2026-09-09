import type { Category } from '../types';
import { colorStyles } from '../lib/colors';

// What follows the cursor while a category is being dragged (rendered inside
// dnd-kit's DragOverlay) — just the header, not the full item list, so it
// stays light and clearly "picked up" rather than a second copy of a
// potentially tall card. The category's actual slot in the grid stays
// behind at reduced opacity (see SortableCategorySection's isDragging
// style), so together they read as "this is what's moving, this is where
// it currently sits" — the drop target itself is wherever this overlay is
// hovering, per dnd-kit's own reordering as you drag.
export function CategoryDragPreview({ category }: { category: Category }) {
  const color = colorStyles[category.color];
  return (
    <div className="flex scale-105 items-center gap-3 rounded-2xl border border-black/10 bg-white p-3 shadow-2xl dark:border-white/10 dark:bg-neutral-900">
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg text-white ${color.chip}`}
      >
        {category.emoji}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-lg font-bold">{category.name}</p>
        <p className="text-xs text-black/40 dark:text-white/40">
          {category.items.length} item{category.items.length === 1 ? '' : 's'}
        </p>
      </div>
      <span className="shrink-0 text-lg text-black/40 dark:text-white/40" aria-hidden="true">
        ⠿
      </span>
    </div>
  );
}
