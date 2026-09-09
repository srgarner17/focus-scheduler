import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { ScheduleData } from '../types';
import { buildFocusSequence } from '../lib/focusOrder';
import { SortableFocusRow } from './SortableFocusRow';

interface Props {
  data: ScheduleData;
  reorderFocusOrder: (orderedIds: string[]) => void;
  onClose: () => void;
}

// A flat, all-items-across-all-categories drag list, separate from the
// category-grouped grid — the only way to set an order that interleaves
// items from different categories, which category/item drag-and-drop alone
// can't express (dragging a category only ever moves it as a whole block).
// This order affects the "What's next" focus view only; the main Today grid
// and edit mode's per-category item lists are untouched by it.
export function FocusOrderEditor({ data, reorderFocusOrder, onClose }: Props) {
  const sequence = buildFocusSequence(data);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = sequence.map((entry) => entry.item.id);
    const oldIndex = ids.indexOf(active.id as string);
    const newIndex = ids.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;
    reorderFocusOrder(arrayMove(ids, oldIndex, newIndex));
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-neutral-50 dark:bg-neutral-950">
      <div className="flex items-center justify-between border-b border-black/10 p-4 dark:border-white/10">
        <div>
          <h2 className="text-lg font-bold">Reorder focus</h2>
          <p className="text-sm text-black/50 dark:text-white/50">
            Sets the order "What's next" walks through, across every category. Doesn't change the list below.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-full bg-black/5 px-3 py-2 text-sm font-medium dark:bg-white/10"
        >
          Done
        </button>
      </div>
      <div className="mx-auto w-full max-w-xl flex-1 space-y-2 overflow-y-auto p-4">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sequence.map((entry) => entry.item.id)} strategy={verticalListSortingStrategy}>
            {sequence.map((entry) => (
              <SortableFocusRow key={entry.item.id} {...entry} />
            ))}
          </SortableContext>
        </DndContext>
        {sequence.length === 0 && (
          <p className="text-center text-sm text-black/40 dark:text-white/40">No items yet.</p>
        )}
      </div>
    </div>
  );
}
