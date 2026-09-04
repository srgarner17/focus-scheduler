import { useEffect, useState } from 'react';
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
import type { Category, ScheduleItem } from '../types';
import { isItemDone, isItemScheduledOn, isOneTimeInPast } from '../types';
import { colorStyles } from '../lib/colors';
import { todayDayIndex, todayKey } from '../lib/date';
import type { EditRevertControls } from '../hooks/useEditRevert';
import { ProgressBar } from './ProgressBar';
import { ItemCard } from './ItemCard';
import { SortableItemCard } from './SortableItemCard';
import { RevertButton } from './RevertButton';

interface Props {
  category: Category;
  editMode: boolean;
  revert: EditRevertControls;
  toggleItem: (categoryId: string, itemId: string) => void;
  toggleSubStep: (categoryId: string, itemId: string, subStepId: string) => void;
  updateCategoryMeta: (categoryId: string, patch: Partial<Pick<Category, 'name' | 'emoji'>>) => void;
  updateCategoryName: (categoryId: string, name: string) => void;
  deleteCategory: (categoryId: string) => void;
  addItem: (categoryId: string) => void;
  updateItemMeta: (
    categoryId: string,
    itemId: string,
    patch: Partial<Pick<ScheduleItem, 'emoji' | 'days' | 'date'>>,
  ) => void;
  updateItemTitle: (categoryId: string, itemId: string, title: string) => void;
  updateItemNotes: (categoryId: string, itemId: string, notes: string) => void;
  updateItemTime: (categoryId: string, itemId: string, time: string) => void;
  deleteItem: (categoryId: string, itemId: string) => void;
  reorderItems: (categoryId: string, orderedIds: string[]) => void;
  addSubStep: (categoryId: string, itemId: string, text: string) => void;
  updateSubStepText: (categoryId: string, itemId: string, subStepId: string, text: string) => void;
  deleteSubStep: (categoryId: string, itemId: string, subStepId: string) => void;
  reorderSubStep: (categoryId: string, itemId: string, subStepId: string, direction: 'up' | 'down') => void;
}

export function CategorySection({
  category,
  editMode,
  revert,
  toggleItem,
  toggleSubStep,
  updateCategoryMeta,
  updateCategoryName,
  deleteCategory,
  addItem,
  updateItemMeta,
  updateItemTitle,
  updateItemNotes,
  updateItemTime,
  deleteItem,
  reorderItems,
  addSubStep,
  updateSubStepText,
  deleteSubStep,
  reorderSubStep,
}: Props) {
  const color = colorStyles[category.color];
  const today = todayDayIndex();
  const todayDateKey = todayKey();
  const activeItems = category.items.filter((it) => isItemScheduledOn(it, todayDateKey, today));
  // Edit mode otherwise shows every item regardless of today's schedule, so a
  // parent can get to items on other days — but a one-time item whose date
  // has already passed has nothing left to edit and would just clutter the
  // list forever, so it's excluded even in edit mode.
  const displayedItems = editMode
    ? category.items.filter((it) => !isOneTimeInPast(it, todayDateKey))
    : activeItems;
  const total = activeItems.length;
  const doneCount = activeItems.filter(isItemDone).length;
  const percent = total === 0 ? 0 : (doneCount / total) * 100;
  const allDone = total > 0 && doneCount === total;

  // Auto-collapse once everything's checked off, but let the user reopen it
  // to review. Reset the override whenever the category has fresh, unfinished
  // work again (new day, item added, something unchecked) so the next time
  // it's completed, it collapses fresh instead of staying stuck open.
  const [userExpanded, setUserExpanded] = useState(false);
  useEffect(() => {
    if (!allDone) setUserExpanded(false);
  }, [allDone]);
  const collapsed = !editMode && allDone && !userExpanded;

  const categoryNameKey = `category:${category.id}:name`;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Drag-and-drop only ever reorders what's in `displayedItems` — edit mode
  // hides expired one-time items, so the ids handed to reorderItems are
  // whatever was actually draggable, not necessarily the category's full
  // raw item list. See reorderItems' comment in useSchedule.ts for how the
  // rest of the list is preserved.
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = displayedItems.findIndex((it) => it.id === active.id);
    const newIndex = displayedItems.findIndex((it) => it.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    reorderItems(category.id, arrayMove(displayedItems, oldIndex, newIndex).map((it) => it.id));
  }

  const itemProps = (item: ScheduleItem) => ({
    categoryId: category.id,
    item,
    color,
    editMode,
    revert,
    toggleItem,
    toggleSubStep,
    updateItemMeta,
    updateItemTitle,
    updateItemNotes,
    updateItemTime,
    deleteItem,
    addSubStep,
    updateSubStepText,
    deleteSubStep,
    reorderSubStep,
  });

  if (editMode) {
    return (
      <section className="space-y-3">
        <div className="flex items-center gap-3">
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg text-white ${color.chip}`}
          >
            {category.emoji}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <input
                value={category.emoji}
                onChange={(e) => updateCategoryMeta(category.id, { emoji: e.target.value })}
                className="w-11 rounded-lg border border-black/10 dark:border-white/15 bg-transparent px-2 py-1 text-center"
              />
              <input
                value={category.name}
                onChange={(e) => {
                  revert.capture(categoryNameKey, category.name);
                  updateCategoryName(category.id, e.target.value);
                }}
                className="min-w-0 flex-1 rounded-lg border border-black/10 dark:border-white/15 bg-transparent px-2 py-1 font-bold text-lg"
              />
              {revert.isDirty(categoryNameKey, category.name) && (
                <RevertButton
                  onRevert={() => {
                    const original = revert.revert(categoryNameKey);
                    if (original !== undefined) updateCategoryName(category.id, original);
                  }}
                />
              )}
            </div>
            <div className="mt-1 flex items-center gap-2">
              <ProgressBar percent={percent} barClass={color.bar} />
              <span className="shrink-0 text-xs font-medium text-black/50 dark:text-white/50">
                {doneCount}/{total}
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={displayedItems.map((it) => it.id)} strategy={verticalListSortingStrategy}>
              {displayedItems.map((item) => (
                <SortableItemCard key={item.id} {...itemProps(item)} />
              ))}
            </SortableContext>
          </DndContext>
          {displayedItems.length === 0 && (
            <p className="text-sm text-black/40 dark:text-white/40 italic px-1">
              {category.items.length === 0 ? 'No items yet.' : 'Nothing scheduled today.'}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3 px-1">
          <button
            type="button"
            onClick={() => addItem(category.id)}
            className="rounded-lg bg-black/5 dark:bg-white/10 px-3 py-1.5 text-sm font-medium"
          >
            + Add item
          </button>
          <button
            type="button"
            onClick={() => deleteCategory(category.id)}
            className="text-sm text-red-500 hover:text-red-600"
          >
            Delete category
          </button>
        </div>
      </section>
    );
  }

  // Non-edit ("today") view: header and items are one continuous solid-color
  // card, not two separately-rounded blocks stacked with a gap — the header
  // caps it in a deeper shade of the same hue, items are dividing rows below.
  return (
    <section className={`${color.solid} rounded-2xl overflow-hidden`}>
      <div className={`${color.deep} flex items-center gap-3 p-3 sm:p-4`}>
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg bg-white ${color.checkFg}`}>
          {category.emoji}
        </span>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold text-white">{category.name}</h2>
          <div className="mt-1 flex items-center gap-2">
            <ProgressBar percent={percent} barClass="bg-white" trackClass="bg-white/25" />
            <span className="shrink-0 text-xs font-medium text-white">
              {doneCount}/{total}
            </span>
          </div>
        </div>
        {allDone && (
          <button
            type="button"
            aria-label={collapsed ? 'Expand section' : 'Collapse section'}
            onClick={() => setUserExpanded((v) => !v)}
            className="shrink-0 flex h-9 w-9 items-center justify-center rounded-full text-white/80 hover:bg-white/10"
          >
            <span className={`inline-block transition-transform ${collapsed ? '' : 'rotate-180'}`}>⌄</span>
          </button>
        )}
      </div>

      {collapsed ? (
        <p className="px-4 py-3 text-sm text-white">All done — tap to review 🎉</p>
      ) : (
        <div className="divide-y divide-white/10">
          {displayedItems.map((item) => (
            <ItemCard key={item.id} {...itemProps(item)} />
          ))}
          {displayedItems.length === 0 && (
            <p className="px-4 py-3 text-sm text-white italic">
              {category.items.length === 0 ? 'No items yet.' : 'Nothing scheduled today.'}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
