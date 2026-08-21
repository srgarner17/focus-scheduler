import { useEffect, useState } from 'react';
import { useSchedule } from './hooks/useSchedule';
import { isItemActiveOnDay, isItemDone } from './types';
import { friendlyDate, todayDayIndex } from './lib/date';
import { CategorySection } from './components/CategorySection';
import { AddCategory } from './components/AddCategory';
import { ProgressBar } from './components/ProgressBar';
import { WeekView } from './components/WeekView';
import { PinPrompt } from './components/PinPrompt';

function App() {
  const s = useSchedule();
  const [editMode, setEditMode] = useState(false);
  const [view, setView] = useState<'today' | 'week'>('today');
  const [nameDraft, setNameDraft] = useState('');
  const [nameSynced, setNameSynced] = useState(false);
  const [pinPromptOpen, setPinPromptOpen] = useState(false);
  const [newPinDraft, setNewPinDraft] = useState('');

  useEffect(() => {
    if (s.data && !nameSynced) {
      setNameDraft(s.data.childName);
      setNameSynced(true);
    }
  }, [s.data, nameSynced]);

  function handleEditClick() {
    if (editMode) {
      setEditMode(false);
      return;
    }
    if (s.data?.editPin) {
      setPinPromptOpen(true);
    } else {
      setEditMode(true);
    }
  }

  if (!s.data) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-neutral-50 text-neutral-400 dark:bg-neutral-950 dark:text-neutral-600">
        <p className="text-sm">Loading…</p>
      </div>
    );
  }

  const data = s.data;
  const today = todayDayIndex();
  const allItems = data.categories.flatMap((c) => c.items).filter((it) => isItemActiveOnDay(it, today));
  const totalCount = allItems.length;
  const doneCount = allItems.filter(isItemDone).length;
  const percent = totalCount === 0 ? 0 : (doneCount / totalCount) * 100;
  const allDone = totalCount > 0 && doneCount === totalCount;

  return (
    <div className="min-h-svh bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-50">
      {pinPromptOpen && (
        <PinPrompt
          expectedPin={data.editPin}
          onSuccess={() => {
            setPinPromptOpen(false);
            setEditMode(true);
          }}
          onCancel={() => setPinPromptOpen(false)}
        />
      )}
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
                  {data.childName ? `${data.childName}'s Focus Plan` : "Today's Focus Plan"}
                </h1>
              )}
            </div>
            {view === 'today' && (
              <button
                type="button"
                onClick={handleEditClick}
                className={`shrink-0 rounded-full px-3 py-2 text-sm font-medium ${
                  editMode
                    ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                    : 'bg-black/5 dark:bg-white/10 text-black/60 dark:text-white/60'
                }`}
              >
                {editMode ? 'Done editing' : '⚙️ Edit'}
              </button>
            )}
          </div>

          <div className="flex rounded-full bg-black/5 p-1 dark:bg-white/10" role="tablist">
            {(['today', 'week'] as const).map((v) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={view === v}
                onClick={() => setView(v)}
                className={`flex-1 rounded-full py-1.5 text-sm font-semibold capitalize transition-colors ${
                  view === v
                    ? 'bg-white text-neutral-900 shadow-sm dark:bg-neutral-800 dark:text-white'
                    : 'text-black/50 dark:text-white/50'
                }`}
              >
                {v}
              </button>
            ))}
          </div>

          {view === 'today' && totalCount > 0 && (
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
          {view === 'week' ? (
            <WeekView categories={data.categories} todayIndex={today} />
          ) : (
            <>
              {data.categories.map((category) => (
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

              {data.categories.length === 0 && !editMode && (
                <p className="text-center text-black/40 dark:text-white/40">
                  Nothing scheduled yet. Tap "Edit" to add a category.
                </p>
              )}
            </>
          )}
        </main>

        {view === 'today' && editMode && (
          <div className="mt-8 space-y-4 border-t border-black/10 dark:border-white/10 pt-4">
            <div>
              <p className="mb-1 text-sm font-medium">Parent PIN</p>
              {data.editPin ? (
                <div className="flex items-center gap-3">
                  <p className="text-sm text-black/50 dark:text-white/50">Editing is locked with a PIN.</p>
                  <button
                    type="button"
                    onClick={() => s.setEditPin('')}
                    className="text-sm text-red-500 hover:text-red-600"
                  >
                    Remove PIN
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={4}
                    value={newPinDraft}
                    onChange={(e) => setNewPinDraft(e.target.value.replace(/\D/g, ''))}
                    placeholder="4-digit PIN"
                    className="w-28 rounded-lg border border-black/10 dark:border-white/15 bg-transparent px-2 py-1 text-sm"
                  />
                  <button
                    type="button"
                    disabled={newPinDraft.length !== 4}
                    onClick={() => {
                      s.setEditPin(newPinDraft);
                      setNewPinDraft('');
                    }}
                    className="rounded-lg bg-black/5 dark:bg-white/10 px-3 py-1.5 text-sm font-medium disabled:opacity-40"
                  >
                    Set PIN
                  </button>
                </div>
              )}
              <p className="mt-1 text-xs text-black/40 dark:text-white/40">
                Require a PIN before Edit mode can be opened, so he can't accidentally change things.
              </p>
            </div>

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
