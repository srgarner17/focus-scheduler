import type { HistoryDay, ScheduleData } from '../types';
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
          subSteps: it.subSteps.map((s) => ({ text: s.text, done: s.done })),
        })),
    }))
    .filter((cat) => cat.items.length > 0);
  return { date: dateKey, categories };
}

// Counts toward progress the same way the live Today view does: skipped
// items are excluded entirely.
export function historyProgress(day: HistoryDay): { done: number; total: number } {
  const counted = day.categories.flatMap((c) => c.items).filter((it) => !it.skipped);
  return { done: counted.filter((it) => it.done).length, total: counted.length };
}
