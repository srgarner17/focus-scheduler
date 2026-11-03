import type { HistoryDay, HistoryItem, ScheduleData } from '../types';
import { isItemDone, isItemScheduledOn } from '../types';
import { dayIndexFor } from './date';

// Captures what `dateKey` looked like in `data` — only items actually
// scheduled that day, with done/skipped state resolved (an item with
// sub-steps is done only when every step is). Categories with nothing
// scheduled that day are left out.
export function buildHistorySnapshot(data: ScheduleData, dateKey: string): HistoryDay {
  const dayIndex = dayIndexFor(dateKey);
  const categories = data.categories
    .map((cat) => ({
      name: cat.name,
      emoji: cat.emoji,
      color: cat.color,
      items: cat.items
        .filter((it) => isItemScheduledOn(it, dateKey, dayIndex))
        .map((it) => ({
          title: it.title,
          emoji: it.emoji,
          done: isItemDone(it),
          skipped: it.skipped,
          requiresSignOff: it.requiresSignOff,
          signedOff: it.signedOff,
          subSteps: it.subSteps.map((s) => ({ text: s.text, done: s.done })),
        })),
    }))
    .filter((cat) => cat.items.length > 0);
  return { date: dateKey, categories };
}

export type HistoryItemState = 'done' | 'awaiting' | 'skipped' | 'notDone';

// How a past item ended its day. "awaiting" is checked off but never
// approved by a parent — worth telling apart from done, since the whole
// point of sign-off is that checked isn't the same as finished. Records
// from before sign-off existed have no requiresSignOff and read as plain
// done / not done.
export function historyItemState(it: HistoryItem): HistoryItemState {
  if (it.skipped) return 'skipped';
  if (!it.done) return 'notDone';
  return it.requiresSignOff && !it.signedOff ? 'awaiting' : 'done';
}

// Counts toward progress the same way the live Today view does: skipped
// items are excluded entirely, and a checked-off item that never got its
// required approval isn't counted as done.
export function historyProgress(day: HistoryDay): { done: number; total: number } {
  const counted = day.categories.flatMap((c) => c.items).filter((it) => !it.skipped);
  return { done: counted.filter((it) => historyItemState(it) === 'done').length, total: counted.length };
}
