import type { Category, ScheduleItem } from '../types';
import { isItemActiveOnDay, isItemDone } from '../types';
import { colorStyles } from '../lib/colors';
import { todayDayIndex } from '../lib/date';
import { ProgressBar } from './ProgressBar';
import { ItemCard } from './ItemCard';

interface Props {
  category: Category;
  editMode: boolean;
  toggleItem: (categoryId: string, itemId: string) => void;
  toggleSubStep: (categoryId: string, itemId: string, subStepId: string) => void;
  updateCategoryMeta: (categoryId: string, patch: Partial<Pick<Category, 'name' | 'emoji'>>) => void;
  deleteCategory: (categoryId: string) => void;
  addItem: (categoryId: string) => void;
  updateItemMeta: (
    categoryId: string,
    itemId: string,
    patch: Partial<Pick<ScheduleItem, 'title' | 'emoji' | 'time' | 'notes' | 'days'>>,
  ) => void;
  deleteItem: (categoryId: string, itemId: string) => void;
  addSubStep: (categoryId: string, itemId: string, text: string) => void;
  updateSubStepText: (categoryId: string, itemId: string, subStepId: string, text: string) => void;
  deleteSubStep: (categoryId: string, itemId: string, subStepId: string) => void;
}

export function CategorySection({
  category,
  editMode,
  toggleItem,
  toggleSubStep,
  updateCategoryMeta,
  deleteCategory,
  addItem,
  updateItemMeta,
  deleteItem,
  addSubStep,
  updateSubStepText,
  deleteSubStep,
}: Props) {
  const color = colorStyles[category.color];
  const today = todayDayIndex();
  const activeItems = category.items.filter((it) => isItemActiveOnDay(it, today));
  const displayedItems = editMode ? category.items : activeItems;
  const total = activeItems.length;
  const doneCount = activeItems.filter(isItemDone).length;
  const percent = total === 0 ? 0 : (doneCount / total) * 100;

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-3">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg text-white ${color.chip}`}
        >
          {category.emoji}
        </span>
        <div className="flex-1 min-w-0">
          {editMode ? (
            <div className="flex items-center gap-2">
              <input
                value={category.emoji}
                onChange={(e) => updateCategoryMeta(category.id, { emoji: e.target.value })}
                className="w-11 rounded-lg border border-black/10 dark:border-white/15 bg-transparent px-2 py-1 text-center"
              />
              <input
                value={category.name}
                onChange={(e) => updateCategoryMeta(category.id, { name: e.target.value })}
                className="flex-1 rounded-lg border border-black/10 dark:border-white/15 bg-transparent px-2 py-1 font-bold text-lg"
              />
            </div>
          ) : (
            <h2 className="text-lg font-bold">{category.name}</h2>
          )}
          <div className="mt-1 flex items-center gap-2">
            <ProgressBar percent={percent} barClass={color.bar} />
            <span className="shrink-0 text-xs font-medium text-black/50 dark:text-white/50">
              {doneCount}/{total}
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {displayedItems.map((item) => (
          <ItemCard
            key={item.id}
            categoryId={category.id}
            item={item}
            color={color}
            editMode={editMode}
            toggleItem={toggleItem}
            toggleSubStep={toggleSubStep}
            updateItemMeta={updateItemMeta}
            deleteItem={deleteItem}
            addSubStep={addSubStep}
            updateSubStepText={updateSubStepText}
            deleteSubStep={deleteSubStep}
          />
        ))}
        {displayedItems.length === 0 && !editMode && (
          <p className="text-sm text-black/40 dark:text-white/40 italic px-1">
            {category.items.length === 0 ? 'No items yet.' : 'Nothing scheduled today.'}
          </p>
        )}
      </div>

      {editMode && (
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
      )}
    </section>
  );
}
