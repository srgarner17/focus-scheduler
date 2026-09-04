import { useState } from 'react';
import type { ScheduleItem } from '../types';
import { ALL_DAYS, isItemDone, isItemScheduledOn } from '../types';
import type { ColorStyle } from '../lib/colors';
import type { EditRevertControls } from '../hooks/useEditRevert';
import { formatDateShort, todayDayIndex, todayKey } from '../lib/date';
import { DayPicker } from './DayPicker';
import { RevertButton } from './RevertButton';

interface Props {
  categoryId: string;
  item: ScheduleItem;
  color: ColorStyle;
  editMode: boolean;
  revert: EditRevertControls;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  toggleItem: (categoryId: string, itemId: string) => void;
  toggleSubStep: (categoryId: string, itemId: string, subStepId: string) => void;
  updateItemMeta: (categoryId: string, itemId: string, patch: Partial<Pick<ScheduleItem, 'emoji' | 'days' | 'date'>>) => void;
  updateItemTitle: (categoryId: string, itemId: string, title: string) => void;
  updateItemNotes: (categoryId: string, itemId: string, notes: string) => void;
  updateItemTime: (categoryId: string, itemId: string, time: string) => void;
  deleteItem: (categoryId: string, itemId: string) => void;
  addSubStep: (categoryId: string, itemId: string, text: string) => void;
  updateSubStepText: (categoryId: string, itemId: string, subStepId: string, text: string) => void;
  deleteSubStep: (categoryId: string, itemId: string, subStepId: string) => void;
  reorderSubStep: (categoryId: string, itemId: string, subStepId: string, direction: 'up' | 'down') => void;
}

export function ItemCard({
  categoryId,
  item,
  color,
  editMode,
  revert,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
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
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [newSubStep, setNewSubStep] = useState('');

  const done = isItemDone(item);
  const hasDetails = item.subSteps.length > 0 || item.notes.trim().length > 0;
  const activeToday = isItemScheduledOn(item, todayKey(), todayDayIndex());
  const isOneTime = Boolean(item.date);
  const isEveryDay = item.days.length === ALL_DAYS.length;
  const titleKey = `item:${item.id}:title`;
  const timeKey = `item:${item.id}:time`;
  const notesKey = `item:${item.id}:notes`;

  function submitNewSubStep() {
    const text = newSubStep.trim();
    if (text) {
      addSubStep(categoryId, item.id, text);
      setNewSubStep('');
    }
  }

  return (
    <div
      className={`transition-colors ${
        editMode
          ? `rounded-2xl border ${
              done ? `${color.soft} ${color.border}` : 'bg-white dark:bg-neutral-900 border-black/10 dark:border-white/10'
            }`
          : ''
      } ${editMode && !activeToday ? 'opacity-50' : ''}`}
    >
      <div className="flex items-center gap-3 p-3 sm:p-4">
        <button
          type="button"
          aria-label={done ? 'Mark not done' : 'Mark done'}
          onClick={() => toggleItem(categoryId, item.id)}
          className={`shrink-0 flex items-center justify-center h-11 w-11 rounded-full border-2 text-xl transition-all active:scale-90 ${
            editMode
              ? done
                ? `${color.chip} border-transparent text-white`
                : 'border-black/20 dark:border-white/25 text-transparent hover:border-black/40'
              : done
                ? `bg-white border-transparent ${color.checkFg}`
                : 'border-white/70 text-transparent hover:border-white'
          }`}
        >
          {done ? '✓' : ''}
        </button>

        <button
          type="button"
          className="flex-1 min-w-0 text-left"
          onClick={() => {
            if (!(hasDetails || editMode)) return;
            setExpanded((e) => !e);
          }}
        >
          {editMode ? (
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={item.emoji}
                onChange={(e) => updateItemMeta(categoryId, item.id, { emoji: e.target.value })}
                onClick={(e) => e.stopPropagation()}
                className="w-11 rounded-lg border border-black/10 dark:border-white/15 bg-transparent px-2 py-1 text-center text-lg"
              />
              <input
                value={item.title}
                onChange={(e) => {
                  revert.capture(titleKey, item.title);
                  updateItemTitle(categoryId, item.id, e.target.value);
                }}
                onClick={(e) => e.stopPropagation()}
                className="min-w-[8rem] flex-1 rounded-lg border border-black/10 dark:border-white/15 bg-transparent px-2 py-1 font-semibold"
                placeholder="Item title"
              />
              {revert.isDirty(titleKey, item.title) && (
                <RevertButton
                  onRevert={() => {
                    const original = revert.revert(titleKey);
                    if (original !== undefined) updateItemTitle(categoryId, item.id, original);
                  }}
                />
              )}
              <input
                value={item.time}
                onChange={(e) => {
                  revert.capture(timeKey, item.time);
                  updateItemTime(categoryId, item.id, e.target.value);
                }}
                onClick={(e) => e.stopPropagation()}
                className="w-24 rounded-lg border border-black/10 dark:border-white/15 bg-transparent px-2 py-1 text-sm"
                placeholder="Time"
              />
              {revert.isDirty(timeKey, item.time) && (
                <RevertButton
                  onRevert={() => {
                    const original = revert.revert(timeKey);
                    if (original !== undefined) updateItemTime(categoryId, item.id, original);
                  }}
                />
              )}
              {isOneTime ? (
                <span className="text-xs text-black/40 dark:text-white/40">
                  one-time · {formatDateShort(item.date)}
                </span>
              ) : (
                !isEveryDay && <span className="text-xs text-black/40 dark:text-white/40">not every day</span>
              )}
            </div>
          ) : (
            <div className="flex items-baseline gap-2">
              <span className="text-xl leading-none">{item.emoji}</span>
              <span className={`font-semibold text-white ${done ? 'line-through opacity-75' : ''}`}>{item.title}</span>
              {item.time && <span className="text-xs text-white">{item.time}</span>}
              {isOneTime && <span className="text-xs text-white">{formatDateShort(item.date)}</span>}
            </div>
          )}
          {!editMode && item.subSteps.length > 0 && (
            <div className="mt-1 text-xs text-white">
              {item.subSteps.filter((s) => s.done).length}/{item.subSteps.length} steps
            </div>
          )}
        </button>

        {editMode && (
          <div className="flex shrink-0 flex-col">
            <button
              type="button"
              onClick={onMoveUp}
              disabled={!canMoveUp}
              aria-label="Move item up"
              className="px-0.5 text-sm text-black/40 hover:text-black/70 disabled:pointer-events-none disabled:opacity-20 dark:text-white/40 dark:hover:text-white/70"
            >
              ▲
            </button>
            <button
              type="button"
              onClick={onMoveDown}
              disabled={!canMoveDown}
              aria-label="Move item down"
              className="px-0.5 text-sm text-black/40 hover:text-black/70 disabled:pointer-events-none disabled:opacity-20 dark:text-white/40 dark:hover:text-white/70"
            >
              ▼
            </button>
          </div>
        )}

        {(hasDetails || editMode) && (
          <button
            type="button"
            aria-label={expanded ? 'Collapse details' : 'Expand details'}
            onClick={() => setExpanded((e) => !e)}
            className={`shrink-0 h-9 w-9 flex items-center justify-center rounded-full ${
              editMode
                ? 'text-black/40 dark:text-white/40 hover:bg-black/5 dark:hover:bg-white/10'
                : 'text-white/80 hover:bg-white/10'
            }`}
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
                  onClick={() => updateItemMeta(categoryId, item.id, { date: '' })}
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
                    !isOneTime ? `${color.chip} text-white` : 'bg-black/5 text-black/50 dark:bg-white/10 dark:text-white/50'
                  }`}
                >
                  Repeats weekly
                </button>
                <button
                  type="button"
                  onClick={() => updateItemMeta(categoryId, item.id, { date: item.date || todayKey() })}
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
                    isOneTime ? `${color.chip} text-white` : 'bg-black/5 text-black/50 dark:bg-white/10 dark:text-white/50'
                  }`}
                >
                  One-time
                </button>
              </div>
              {isOneTime ? (
                <input
                  type="date"
                  value={item.date}
                  onChange={(e) => updateItemMeta(categoryId, item.id, { date: e.target.value })}
                  className="rounded-lg border border-black/10 dark:border-white/15 bg-transparent px-2 py-1 text-sm"
                />
              ) : (
                <DayPicker
                  days={item.days}
                  onChange={(days) => updateItemMeta(categoryId, item.id, { days })}
                  chipClass={color.chip}
                />
              )}
            </div>
          )}
          {editMode ? (
            <div className="flex items-start gap-1">
              <textarea
                value={item.notes}
                onChange={(e) => {
                  revert.capture(notesKey, item.notes);
                  updateItemNotes(categoryId, item.id, e.target.value);
                }}
                placeholder="Tip or instructions to help him get it right..."
                className="w-full min-w-0 flex-1 rounded-lg border border-black/10 dark:border-white/15 bg-transparent px-2 py-1.5 text-sm"
                rows={2}
              />
              {revert.isDirty(notesKey, item.notes) && (
                <RevertButton
                  onRevert={() => {
                    const original = revert.revert(notesKey);
                    if (original !== undefined) updateItemNotes(categoryId, item.id, original);
                  }}
                />
              )}
            </div>
          ) : (
            item.notes && (
              <p className={`text-sm italic ${editMode ? 'text-black/60 dark:text-white/60' : 'text-white'}`}>
                {item.notes}
              </p>
            )
          )}

          <ul className="space-y-1.5">
            {item.subSteps.map((s, index) => (
              <li key={s.id} className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label={s.done ? 'Mark step not done' : 'Mark step done'}
                  onClick={() => toggleSubStep(categoryId, item.id, s.id)}
                  className={`shrink-0 flex items-center justify-center h-6 w-6 rounded-full border-2 text-sm active:scale-90 ${
                    editMode
                      ? s.done
                        ? `${color.chip} border-transparent text-white`
                        : 'border-black/20 dark:border-white/25 text-transparent'
                      : s.done
                        ? `bg-white border-transparent ${color.checkFg}`
                        : 'border-white/70 text-transparent hover:border-white'
                  }`}
                >
                  {s.done ? '✓' : ''}
                </button>
                {editMode ? (
                  <>
                    <input
                      value={s.text}
                      onChange={(e) => {
                        revert.capture(`item:${item.id}:substep:${s.id}`, s.text);
                        updateSubStepText(categoryId, item.id, s.id, e.target.value);
                      }}
                      className="min-w-0 flex-1 rounded-lg border border-black/10 dark:border-white/15 bg-transparent px-2 py-1 text-sm"
                    />
                    {revert.isDirty(`item:${item.id}:substep:${s.id}`, s.text) && (
                      <RevertButton
                        onRevert={() => {
                          const original = revert.revert(`item:${item.id}:substep:${s.id}`);
                          if (original !== undefined) updateSubStepText(categoryId, item.id, s.id, original);
                        }}
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => reorderSubStep(categoryId, item.id, s.id, 'up')}
                      disabled={index === 0}
                      aria-label="Move step up"
                      className="shrink-0 px-0.5 text-sm text-black/40 hover:text-black/70 disabled:pointer-events-none disabled:opacity-20 dark:text-white/40 dark:hover:text-white/70"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      onClick={() => reorderSubStep(categoryId, item.id, s.id, 'down')}
                      disabled={index === item.subSteps.length - 1}
                      aria-label="Move step down"
                      className="shrink-0 px-0.5 text-sm text-black/40 hover:text-black/70 disabled:pointer-events-none disabled:opacity-20 dark:text-white/40 dark:hover:text-white/70"
                    >
                      ▼
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteSubStep(categoryId, item.id, s.id)}
                      className="shrink-0 text-black/40 hover:text-red-500 dark:text-white/40 dark:hover:text-red-400 text-sm px-1"
                      aria-label="Delete step"
                    >
                      ✕
                    </button>
                  </>
                ) : (
                  <span className={`text-sm text-white ${s.done ? 'line-through opacity-75' : ''}`}>{s.text}</span>
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
            <div className="pt-1">
              <button
                type="button"
                onClick={() => deleteItem(categoryId, item.id)}
                className="text-sm text-red-500 hover:text-red-600"
              >
                Delete this item
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
