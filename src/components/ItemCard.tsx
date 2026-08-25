import { useEffect, useRef, useState } from 'react';
import type { ScheduleItem } from '../types';
import { ALL_DAYS, isItemDone, isItemScheduledOn } from '../types';
import type { ColorStyle } from '../lib/colors';
import { formatDateShort, todayDayIndex, todayKey } from '../lib/date';
import { DayPicker } from './DayPicker';

type DraftFields = Pick<ScheduleItem, 'title' | 'emoji' | 'time' | 'notes' | 'days' | 'date'>;

interface Draft {
  values: DraftFields;
  dirty: Partial<Record<keyof DraftFields, true>>;
  subStepTexts: Record<string, string>; // subStepId -> edited text; presence means dirty
}

function makeDraft(item: ScheduleItem): Draft {
  return {
    values: { title: item.title, emoji: item.emoji, time: item.time, notes: item.notes, days: item.days, date: item.date },
    dirty: {},
    subStepTexts: {},
  };
}

interface Props {
  categoryId: string;
  item: ScheduleItem;
  color: ColorStyle;
  editMode: boolean;
  toggleItem: (categoryId: string, itemId: string) => void;
  toggleSubStep: (categoryId: string, itemId: string, subStepId: string) => void;
  updateItemMeta: (categoryId: string, itemId: string, patch: Partial<DraftFields>) => void;
  deleteItem: (categoryId: string, itemId: string) => void;
  addSubStep: (categoryId: string, itemId: string, text: string) => void;
  updateSubStepText: (categoryId: string, itemId: string, subStepId: string, text: string) => void;
  deleteSubStep: (categoryId: string, itemId: string, subStepId: string) => void;
}

export function ItemCard({
  categoryId,
  item,
  color,
  editMode,
  toggleItem,
  toggleSubStep,
  updateItemMeta,
  deleteItem,
  addSubStep,
  updateSubStepText,
  deleteSubStep,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [newSubStep, setNewSubStep] = useState('');
  // Field edits are buffered here while editing, and only written to Firestore
  // when the item is collapsed, "Done" is tapped, or edit mode is exited —
  // never per keystroke. This avoids the write-per-keystroke race that let a
  // slow-to-confirm earlier transaction "rewind" text over faster local
  // typing, and only ever patches the specific fields actually touched, so a
  // concurrent edit to some other field on this item from another device
  // isn't clobbered by an unrelated commit.
  const [draft, setDraft] = useState<Draft | null>(() => (editMode ? makeDraft(item) : null));
  // Kept in sync with `draft` on every render so the effect cleanup below can
  // read the latest value directly. React 18+ silently no-ops a setState
  // call made from a cleanup that's running because the component is
  // unmounting (no warning, nothing happens) — and this item unmounts the
  // instant edit mode ends if it isn't scheduled for today, in the very same
  // render as the exit. Piggybacking the commit on a setDraft callback lost
  // it silently in exactly that case; reading a ref works regardless of
  // whether the component is still considered mounted.
  const draftRef = useRef(draft);
  draftRef.current = draft;

  useEffect(() => {
    if (!editMode) return;
    setDraft((d) => d ?? makeDraft(item));
    return () => {
      const d = draftRef.current;
      if (d) commitDraft(d);
      setDraft(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editMode]);

  const done = isItemDone(item);
  const hasDetails = item.subSteps.length > 0 || item.notes.trim().length > 0;
  const activeToday = isItemScheduledOn(item, todayKey(), todayDayIndex());
  const isOneTime = Boolean(item.date);

  const activeDraft = draft ?? makeDraft(item);
  const draftIsOneTime = Boolean(activeDraft.values.date);
  const draftEveryDay = activeDraft.values.days.length === ALL_DAYS.length;

  function setField<K extends keyof DraftFields>(key: K, value: DraftFields[K]) {
    setDraft((d) => {
      const base = d ?? makeDraft(item);
      return { ...base, values: { ...base.values, [key]: value }, dirty: { ...base.dirty, [key]: true } };
    });
  }

  function setSubStepDraftText(subStepId: string, text: string) {
    setDraft((d) => {
      const base = d ?? makeDraft(item);
      return { ...base, subStepTexts: { ...base.subStepTexts, [subStepId]: text } };
    });
  }

  function commitDraft(d: Draft) {
    const patch: Partial<DraftFields> = {};
    (Object.keys(d.dirty) as (keyof DraftFields)[]).forEach((key) => {
      (patch as Record<string, unknown>)[key] = d.values[key];
    });
    if (Object.keys(patch).length > 0) {
      updateItemMeta(categoryId, item.id, patch);
    }
    Object.entries(d.subStepTexts).forEach(([subStepId, text]) => {
      updateSubStepText(categoryId, item.id, subStepId, text);
    });
  }

  function finishEditing() {
    if (draft) {
      commitDraft(draft);
      setDraft(makeDraft(item));
    }
    setExpanded(false);
  }

  function submitNewSubStep() {
    const text = newSubStep.trim();
    if (text) {
      addSubStep(categoryId, item.id, text);
      setNewSubStep('');
    }
  }

  return (
    <div
      className={`rounded-2xl border transition-colors ${
        done ? `${color.soft} ${color.border}` : 'bg-white dark:bg-neutral-900 border-black/10 dark:border-white/10'
      } ${editMode && !activeToday ? 'opacity-50' : ''}`}
    >
      <div className="flex items-center gap-3 p-3 sm:p-4">
        <button
          type="button"
          aria-label={done ? 'Mark not done' : 'Mark done'}
          onClick={() => toggleItem(categoryId, item.id)}
          className={`shrink-0 flex items-center justify-center h-11 w-11 rounded-full border-2 text-xl transition-all active:scale-90 ${
            done
              ? `${color.chip} border-transparent text-white`
              : 'border-black/20 dark:border-white/25 text-transparent hover:border-black/40'
          }`}
        >
          {done ? '✓' : ''}
        </button>

        <button
          type="button"
          className="flex-1 min-w-0 text-left"
          onClick={() => {
            if (!(hasDetails || editMode)) return;
            if (expanded) finishEditing();
            else setExpanded(true);
          }}
        >
          {editMode ? (
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={activeDraft.values.emoji}
                onChange={(e) => setField('emoji', e.target.value)}
                onClick={(e) => e.stopPropagation()}
                className="w-11 rounded-lg border border-black/10 dark:border-white/15 bg-transparent px-2 py-1 text-center text-lg"
              />
              <input
                value={activeDraft.values.title}
                onChange={(e) => setField('title', e.target.value)}
                onClick={(e) => e.stopPropagation()}
                className="min-w-[8rem] flex-1 rounded-lg border border-black/10 dark:border-white/15 bg-transparent px-2 py-1 font-semibold"
                placeholder="Item title"
              />
              <input
                value={activeDraft.values.time}
                onChange={(e) => setField('time', e.target.value)}
                onClick={(e) => e.stopPropagation()}
                className="w-24 rounded-lg border border-black/10 dark:border-white/15 bg-transparent px-2 py-1 text-sm"
                placeholder="Time"
              />
              {draftIsOneTime ? (
                <span className="text-xs text-black/40 dark:text-white/40">
                  one-time · {formatDateShort(activeDraft.values.date)}
                </span>
              ) : (
                !draftEveryDay && <span className="text-xs text-black/40 dark:text-white/40">not every day</span>
              )}
            </div>
          ) : (
            <div className="flex items-baseline gap-2">
              <span className="text-xl leading-none">{item.emoji}</span>
              <span className={`font-semibold ${done ? 'line-through opacity-60' : ''}`}>{item.title}</span>
              {item.time && <span className="text-xs text-black/50 dark:text-white/50">{item.time}</span>}
              {isOneTime && (
                <span className="text-xs text-black/40 dark:text-white/40">{formatDateShort(item.date)}</span>
              )}
            </div>
          )}
          {!editMode && item.subSteps.length > 0 && (
            <div className="mt-1 text-xs text-black/50 dark:text-white/50">
              {item.subSteps.filter((s) => s.done).length}/{item.subSteps.length} steps
            </div>
          )}
        </button>

        {(hasDetails || editMode) && (
          <button
            type="button"
            aria-label={expanded ? 'Collapse details' : 'Expand details'}
            onClick={() => (expanded ? finishEditing() : setExpanded(true))}
            className="shrink-0 h-9 w-9 flex items-center justify-center rounded-full text-black/40 dark:text-white/40 hover:bg-black/5 dark:hover:bg-white/10"
          >
            <span className={`inline-block transition-transform ${expanded ? 'rotate-180' : ''}`}>⌄</span>
          </button>
        )}
      </div>

      {expanded && (
        <div className="px-4 pb-4 pl-[4.25rem] space-y-3">
          {editMode && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setField('date', '')}
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
                    !draftIsOneTime ? `${color.chip} text-white` : 'bg-black/5 text-black/50 dark:bg-white/10 dark:text-white/50'
                  }`}
                >
                  Repeats weekly
                </button>
                <button
                  type="button"
                  onClick={() => setField('date', activeDraft.values.date || todayKey())}
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
                    draftIsOneTime ? `${color.chip} text-white` : 'bg-black/5 text-black/50 dark:bg-white/10 dark:text-white/50'
                  }`}
                >
                  One-time
                </button>
              </div>
              {draftIsOneTime ? (
                <input
                  type="date"
                  value={activeDraft.values.date}
                  onChange={(e) => setField('date', e.target.value)}
                  className="rounded-lg border border-black/10 dark:border-white/15 bg-transparent px-2 py-1 text-sm"
                />
              ) : (
                <DayPicker
                  days={activeDraft.values.days}
                  onChange={(days) => setField('days', days)}
                  chipClass={color.chip}
                />
              )}
            </div>
          )}
          {editMode ? (
            <textarea
              value={activeDraft.values.notes}
              onChange={(e) => setField('notes', e.target.value)}
              placeholder="Tip or instructions to help him get it right..."
              className="w-full rounded-lg border border-black/10 dark:border-white/15 bg-transparent px-2 py-1.5 text-sm"
              rows={2}
            />
          ) : (
            item.notes && <p className="text-sm text-black/60 dark:text-white/60 italic">{item.notes}</p>
          )}

          <ul className="space-y-1.5">
            {item.subSteps.map((s) => (
              <li key={s.id} className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label={s.done ? 'Mark step not done' : 'Mark step done'}
                  onClick={() => toggleSubStep(categoryId, item.id, s.id)}
                  className={`shrink-0 flex items-center justify-center h-6 w-6 rounded-md border-2 text-sm active:scale-90 ${
                    s.done
                      ? `${color.chip} border-transparent text-white`
                      : 'border-black/20 dark:border-white/25 text-transparent'
                  }`}
                >
                  {s.done ? '✓' : ''}
                </button>
                {editMode ? (
                  <>
                    <input
                      value={activeDraft.subStepTexts[s.id] ?? s.text}
                      onChange={(e) => setSubStepDraftText(s.id, e.target.value)}
                      className="flex-1 rounded-lg border border-black/10 dark:border-white/15 bg-transparent px-2 py-1 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => deleteSubStep(categoryId, item.id, s.id)}
                      className="shrink-0 text-black/40 hover:text-red-500 text-sm px-1"
                      aria-label="Delete step"
                    >
                      ✕
                    </button>
                  </>
                ) : (
                  <span className={`text-sm ${s.done ? 'line-through opacity-60' : ''}`}>{s.text}</span>
                )}
              </li>
            ))}
          </ul>

          {editMode && (
            <div className="flex items-center gap-2">
              <input
                value={newSubStep}
                onChange={(e) => setNewSubStep(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitNewSubStep();
                }}
                placeholder="Add a step..."
                className="flex-1 rounded-lg border border-black/10 dark:border-white/15 bg-transparent px-2 py-1 text-sm"
              />
              <button
                type="button"
                onClick={submitNewSubStep}
                className="shrink-0 rounded-lg bg-black/5 dark:bg-white/10 px-3 py-1 text-sm font-medium"
              >
                Add
              </button>
            </div>
          )}

          {editMode && (
            <div className="flex items-center justify-between gap-3 pt-1">
              <button
                type="button"
                onClick={() => deleteItem(categoryId, item.id)}
                className="text-sm text-red-500 hover:text-red-600"
              >
                Delete this item
              </button>
              <button
                type="button"
                onClick={finishEditing}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold text-white ${color.chip}`}
              >
                Done
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
