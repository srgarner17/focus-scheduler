import { useState } from 'react';
import type { Category } from '../types';
import { DAY_LABELS, DAY_NAMES, isItemScheduledOn } from '../types';
import { colorStyles } from '../lib/colors';
import { currentWeekDateKeys, formatDateShort, todayKey } from '../lib/date';
import { useHistoryDay } from '../hooks/useHistoryDay';
import { HistoryDayView } from './HistoryDayView';

interface Props {
  categories: Category[];
  todayIndex: number;
}

export function WeekView({ categories, todayIndex }: Props) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState(todayIndex);
  const weekDateKeys = currentWeekDateKeys(weekOffset);
  const selectedDateKey = weekDateKeys[selectedDay];
  const isThisWeek = weekOffset === 0;
  const isSelectedToday = isThisWeek && selectedDay === todayIndex;
  // Past days show what actually happened (a persisted snapshot); today and
  // future days keep showing what's scheduled, from the live schedule.
  const isPast = selectedDateKey < todayKey();
  const history = useHistoryDay(isPast ? selectedDateKey : null);

  const dayCategories = categories
    .map((c) => ({
      ...c,
      items: c.items.filter((it) => isItemScheduledOn(it, selectedDateKey, selectedDay)),
    }))
    .filter((c) => c.items.length > 0);

  const totalForDay = dayCategories.reduce((sum, c) => sum + c.items.length, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          aria-label="Previous week"
          onClick={() => setWeekOffset((w) => w - 1)}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-black/5 text-lg dark:bg-white/10"
        >
          ‹
        </button>
        <div className="text-center">
          <p className="text-sm font-semibold">
            {formatDateShort(weekDateKeys[0])} – {formatDateShort(weekDateKeys[6])}
          </p>
          {!isThisWeek && (
            <button
              type="button"
              onClick={() => {
                setWeekOffset(0);
                setSelectedDay(todayIndex);
              }}
              className="text-xs font-medium text-black/50 underline underline-offset-2 dark:text-white/50"
            >
              Back to this week
            </button>
          )}
        </div>
        <button
          type="button"
          aria-label="Next week"
          onClick={() => setWeekOffset((w) => w + 1)}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-black/5 text-lg dark:bg-white/10"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {DAY_LABELS.map((label, i) => {
          const dotCats = categories.filter((c) => c.items.some((it) => isItemScheduledOn(it, weekDateKeys[i], i)));
          const isSelected = selectedDay === i;
          const isToday = isThisWeek && todayIndex === i;
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
          {DAY_NAMES[selectedDay]}, {formatDateShort(selectedDateKey)}
          {isSelectedToday ? ' · Today' : ''}
          {!isPast && ` — ${totalForDay} ${totalForDay === 1 ? 'item' : 'items'}`}
        </p>

        {isPast ? (
          <>
            {history.status === 'loading' && (
              <p className="py-10 text-center text-black/40 dark:text-white/40">Loading…</p>
            )}
            {history.status === 'missing' && (
              <p className="py-10 text-center text-black/40 dark:text-white/40">No record for this day.</p>
            )}
            {history.status === 'error' && (
              <p className="py-10 text-center text-red-500">Couldn't load this day. Try again in a moment.</p>
            )}
            {history.status === 'ready' && <HistoryDayView day={history.day} />}
          </>
        ) : (
          <>
            {dayCategories.length === 0 && (
              <p className="py-10 text-center text-black/40 dark:text-white/40">Nothing scheduled — free day! 🎉</p>
            )}

            {dayCategories.map((c) => {
              const color = colorStyles[c.color];
              return (
                <section key={c.id} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-base text-white ${color.chip}`}
                    >
                      {c.emoji}
                    </span>
                    <h3 className="font-bold">{c.name}</h3>
                  </div>
                  <ul className="space-y-1.5">
                    {c.items.map((it) => (
                      <li key={it.id} className={`flex items-center gap-2 rounded-xl px-3 py-2 ${color.solid}`}>
                        <span className="text-lg leading-none">{it.emoji}</span>
                        <span className="flex-1 font-medium text-white">{it.title}</span>
                        {it.date && <span className="text-xs text-white">{formatDateShort(it.date)}</span>}
                        {it.subSteps.length > 0 && (
                          <span className="text-xs text-white">{it.subSteps.length} steps</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
