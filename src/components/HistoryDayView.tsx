import type { HistoryDay } from '../types';
import { colorStyles } from '../lib/colors';
import { historyItemState, historyProgress } from '../lib/history';

// Read-only record of a past day: same bold solid-color pills as Today, but
// with the state it actually ended in. Nothing here is tappable — history
// shows what happened and can't be changed after the fact.
export function HistoryDayView({ day }: { day: HistoryDay }) {
  const { done, total } = historyProgress(day);

  return (
    <div className="space-y-5">
      {total > 0 && (
        <p className="text-center text-sm font-semibold">
          {done}/{total} done
        </p>
      )}
      {day.categories.length === 0 && (
        <p className="py-10 text-center text-black/40 dark:text-white/40">Nothing was scheduled this day.</p>
      )}
      {day.categories.map((c) => {
        const color = colorStyles[c.color];
        return (
          <section key={c.name} className="space-y-2">
            <div className="flex items-center gap-2">
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-base text-white ${color.chip}`}
              >
                {c.emoji}
              </span>
              <h3 className="font-bold">{c.name}</h3>
            </div>
            <ul className="space-y-1.5">
              {c.items.map((it, i) => {
                const state = historyItemState(it);
                return (
                <li key={i} className={`flex items-center gap-3 rounded-xl px-3 py-2 ${color.solid}`}>
                  <span
                    aria-label={
                      state === 'skipped'
                        ? 'Skipped'
                        : state === 'awaiting'
                          ? 'Checked off, never approved'
                          : state === 'done'
                            ? 'Done'
                            : 'Not done'
                    }
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-sm ${
                      state === 'skipped'
                        ? 'border-transparent bg-white/25 text-white'
                        : state === 'awaiting'
                          ? 'border-transparent bg-amber-300 text-amber-900'
                          : state === 'done'
                            ? `border-transparent bg-white ${color.checkFg}`
                            : 'border-white/70 text-transparent'
                    }`}
                  >
                    {state === 'skipped' ? '－' : state === 'awaiting' ? '⏳' : state === 'done' ? '✓' : ''}
                  </span>
                  <span className="text-lg leading-none">{it.emoji}</span>
                  <span className={`flex-1 font-medium text-white ${state === 'done' ? 'line-through opacity-75' : ''}`}>
                    {it.title}
                  </span>
                  {state === 'skipped' ? (
                    <span className="text-xs text-white">Skipped</span>
                  ) : state === 'awaiting' ? (
                    <span className="rounded-full bg-amber-300 px-2 py-0.5 text-xs font-semibold text-amber-900">
                      Never approved
                    </span>
                  ) : (
                    it.subSteps.length > 0 && (
                      <span className="text-xs text-white">
                        {it.subSteps.filter((s) => s.done).length}/{it.subSteps.length} steps
                      </span>
                    )
                  )}
                </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
