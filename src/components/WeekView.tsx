import { useState } from 'react';
import type { Category } from '../types';
import { DAY_LABELS, DAY_NAMES, isItemScheduledOn } from '../types';
import { colorStyles } from '../lib/colors';
import { currentWeekDateKeys, formatDateShort } from '../lib/date';

interface Props {
  categories: Category[];
  todayIndex: number;
}

export function WeekView({ categories, todayIndex }: Props) {
  const [selectedDay, setSelectedDay] = useState(todayIndex);
  const weekDateKeys = currentWeekDateKeys();

  const dayCategories = categories
    .map((c) => ({
      ...c,
      items: c.items.filter((it) => isItemScheduledOn(it, weekDateKeys[selectedDay], selectedDay)),
    }))
    .filter((c) => c.items.length > 0);

  const totalForDay = dayCategories.reduce((sum, c) => sum + c.items.length, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-7 gap-1.5">
        {DAY_LABELS.map((label, i) => {
          const dotCats = categories.filter((c) => c.items.some((it) => isItemScheduledOn(it, weekDateKeys[i], i)));
          const isSelected = selectedDay === i;
          const isToday = todayIndex === i;
          return (
            <button
              key={i}
              type="button"
              aria-label={DAY_NAMES[i] + (isToday ? ' (today)' : '')}
              aria-pressed={isSelected}
              onClick={() => setSelectedDay(i)}
              className={`flex flex-col items-center gap-2 rounded-2xl py-3 transition-colors ${
                isSelected
                  ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                  : isToday
                    ? 'bg-black/5 dark:bg-white/10'
                    : ''
              }`}
            >
              <span className="text-sm font-bold">{label}</span>
              <span className="flex h-1.5 items-center gap-0.5">
                {dotCats.length === 0 ? (
                  <span className="h-1.5 w-1.5" />
                ) : (
                  dotCats
                    .slice(0, 4)
                    .map((c) => <span key={c.id} className={`h-1.5 w-1.5 rounded-full ${colorStyles[c.color].chip}`} />)
                )}
              </span>
            </button>
          );
        })}
      </div>

      <div className="space-y-5">
        <p className="text-center text-sm font-medium text-black/50 dark:text-white/50">
          {DAY_NAMES[selectedDay]}
          {selectedDay === todayIndex ? ' · Today' : ''} — {totalForDay} {totalForDay === 1 ? 'item' : 'items'}
        </p>

        {dayCategories.length === 0 && (
          <p className="py-10 text-center text-black/40 dark:text-white/40">Nothing scheduled — free day! 🎉</p>
        )}

        {dayCategories.map((c) => {
          const color = colorStyles[c.color];
          return (
            <section key={c.id} className="space-y-2">
              <div className="flex items-center gap-2">
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-base text-white ${color.chip}`}
                >
                  {c.emoji}
                </span>
                <h3 className="font-bold">{c.name}</h3>
              </div>
              <ul className="space-y-1.5">
                {c.items.map((it) => (
                  <li
                    key={it.id}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${color.border} ${color.soft}`}
                  >
                    <span className="text-lg leading-none">{it.emoji}</span>
                    <span className="flex-1 font-medium">{it.title}</span>
                    {it.time && <span className="text-xs text-black/50 dark:text-white/50">{it.time}</span>}
                    {it.date && (
                      <span className="text-xs text-black/40 dark:text-white/40">{formatDateShort(it.date)}</span>
                    )}
                    {it.subSteps.length > 0 && (
                      <span className="text-xs text-black/40 dark:text-white/40">{it.subSteps.length} steps</span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
