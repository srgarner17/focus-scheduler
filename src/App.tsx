import { useState } from 'react';
import { useSchedule } from './hooks/useSchedule';
import { isItemDone } from './types';
import { friendlyDate } from './lib/date';
import { CategorySection } from './components/CategorySection';
import { AddCategory } from './components/AddCategory';
import { ProgressBar } from './components/ProgressBar';

function App() {
  const s = useSchedule();
  const [editMode, setEditMode] = useState(false);
  const [nameDraft, setNameDraft] = useState(s.data.childName);

  const allItems = s.data.categories.flatMap((c) => c.items);
  const totalCount = allItems.length;
  const doneCount = allItems.filter(isItemDone).length;
  const percent = totalCount === 0 ? 0 : (doneCount / totalCount) * 100;
  const allDone = totalCount > 0 && doneCount === totalCount;

  return (
    <div className="min-h-svh bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-50">
      <div className="mx-auto max-w-xl px-4 pb-24 pt-6 sm:pt-10">
        <header className="mb-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-black/50 dark:text-white/50">{friendlyDate()}</p>
              {editMode ? (
                <input
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onBlur={() => s.setChildName(nameDraft)}
                  placeholder="His name"
                  className="mt-1 rounded-lg border border-black/10 dark:border-white/15 bg-transparent px-2 py-1 text-2xl font-bold"
                />
              ) : (
                <h1 className="text-2xl font-bold">
                  {s.data.childName ? `${s.data.childName}'s Focus Plan` : "Today's Focus Plan"}
                </h1>
              )}
            </div>
            <button
              type="button"
              onClick={() => setEditMode((v) => !v)}
              className={`shrink-0 rounded-full px-3 py-2 text-sm font-medium ${
                editMode
                  ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                  : 'bg-black/5 dark:bg-white/10 text-black/60 dark:text-white/60'
              }`}
            >
              {editMode ? 'Done editing' : '⚙️ Edit'}
            </button>
          </div>

          {totalCount > 0 && (
            <div className="rounded-2xl bg-white dark:bg-neutral-900 border border-black/10 dark:border-white/10 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Today's progress</span>
                <span className="text-sm font-semibold">
                  {doneCount}/{totalCount}
                </span>
              </div>
              <ProgressBar percent={percent} barClass="bg-neutral-900 dark:bg-white" />
              {allDone && (
                <p className="mt-3 text-center text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                  🎉 Everything done — great focus today!
                </p>
              )}
            </div>
          )}
        </header>

        <main className="space-y-8">
          {s.data.categories.map((category) => (
            <CategorySection
              key={category.id}
              category={category}
              editMode={editMode}
              toggleItem={s.toggleItem}
              toggleSubStep={s.toggleSubStep}
              updateCategoryMeta={s.updateCategoryMeta}
              deleteCategory={s.deleteCategory}
              addItem={s.addItem}
              updateItemMeta={s.updateItemMeta}
              deleteItem={s.deleteItem}
              addSubStep={s.addSubStep}
              updateSubStepText={s.updateSubStepText}
              deleteSubStep={s.deleteSubStep}
            />
          ))}

          {editMode && <AddCategory onAdd={s.addCategory} />}

          {s.data.categories.length === 0 && !editMode && (
            <p className="text-center text-black/40 dark:text-white/40">
              Nothing scheduled yet. Tap "Edit" to add a category.
            </p>
          )}
        </main>

        {editMode && (
          <div className="mt-8 border-t border-black/10 dark:border-white/10 pt-4">
            <button
              type="button"
              onClick={() => {
                if (confirm("Reset all of today's checkmarks?")) s.resetAll();
              }}
              className="text-sm text-black/40 hover:text-black/60"
            >
              Reset today's checkmarks
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
