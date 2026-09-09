import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { FocusEntry } from '../lib/focusOrder';

export function SortableFocusRow({ category, item }: FocusEntry) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : undefined,
    position: 'relative' as const,
    zIndex: isDragging ? 1 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 rounded-xl border border-black/10 bg-white p-3 dark:border-white/10 dark:bg-neutral-900"
    >
      <span className="shrink-0 text-lg">{item.emoji}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{item.title}</p>
        <p className="truncate text-xs text-black/40 dark:text-white/40">
          {category.emoji} {category.name}
        </p>
      </div>
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder focus"
        className="shrink-0 flex h-9 w-9 touch-none cursor-grab items-center justify-center rounded-full text-lg text-black/40 hover:bg-black/5 active:cursor-grabbing dark:text-white/40 dark:hover:bg-white/10"
      >
        ⠿
      </button>
    </div>
  );
}
