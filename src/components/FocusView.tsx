import type { Category, ScheduleItem } from '../types';
import { isItemDone } from '../types';
import type { ColorStyle } from '../lib/colors';

interface Props {
  category: Category;
  item: ScheduleItem;
  color: ColorStyle;
  doneCount: number;
  totalCount: number;
  toggleItem: (categoryId: string, itemId: string) => void;
  toggleSubStep: (categoryId: string, itemId: string, subStepId: string) => void;
  onExit: () => void;
}

// One task at a time, in the same order edit mode's category/item reordering
// already controls — no new priority concept, see the roadmap's "What's
// next" scoping. The checkbox here is the same toggleItem used everywhere
// else, so completing an item (and, for multi-step items, all its
// sub-steps) behaves identically to the full-list view.
export function FocusView({ category, item, color, doneCount, totalCount, toggleItem, toggleSubStep, onExit }: Props) {
  const done = isItemDone(item);
  return (
    <div className="mx-auto max-w-md">
      <div className="mb-3 flex items-center justify-between text-sm text-black/50 dark:text-white/50">
        <span>
          {doneCount}/{totalCount} done
        </span>
        <button
          type="button"
          onClick={onExit}
          className="font-medium underline underline-offset-2 hover:text-black/70 dark:hover:text-white/70"
        >
          See full list
        </button>
      </div>
      <div className={`rounded-3xl ${color.solid} p-6 text-white`}>
        <div className="mb-4 flex items-center gap-2 text-sm font-medium text-white/80">
          <span>{category.emoji}</span>
          <span>{category.name}</span>
        </div>
        <div className="flex items-start gap-4">
          <button
            type="button"
            aria-label={done ? 'Mark not done' : 'Mark done'}
            onClick={() => toggleItem(category.id, item.id)}
            className={`shrink-0 flex items-center justify-center h-14 w-14 rounded-full border-2 text-2xl transition-all active:scale-90 ${
              done ? `bg-white border-transparent ${color.checkFg}` : 'border-white/70 text-transparent hover:border-white'
            }`}
          >
            {done ? '✓' : ''}
          </button>
          <div className="min-w-0 flex-1 pt-1">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl leading-none">{item.emoji}</span>
              <span className="text-xl font-bold">{item.title}</span>
            </div>
            {item.notes && <p className="mt-2 text-sm italic text-white/90">{item.notes}</p>}
          </div>
        </div>

        {item.subSteps.length > 0 && (
          <ul className="mt-5 space-y-2 pl-[4.5rem]">
            {item.subSteps.map((s) => (
              <li key={s.id} className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label={s.done ? 'Mark step not done' : 'Mark step done'}
                  onClick={() => toggleSubStep(category.id, item.id, s.id)}
                  className={`shrink-0 flex items-center justify-center h-7 w-7 rounded-full border-2 text-sm active:scale-90 ${
                    s.done ? `bg-white border-transparent ${color.checkFg}` : 'border-white/70 text-transparent hover:border-white'
                  }`}
                >
                  {s.done ? '✓' : ''}
                </button>
                <span className={`text-sm ${s.done ? 'line-through opacity-75' : ''}`}>{s.text}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function FocusComplete({ onExit }: { onExit: () => void }) {
  return (
    <div className="mx-auto max-w-md text-center">
      <div className="rounded-3xl bg-neutral-900 dark:bg-white p-10 text-white dark:text-neutral-900">
        <p className="text-2xl font-bold">🎉 Everything done — great focus today!</p>
      </div>
      <button
        type="button"
        onClick={onExit}
        className="mt-4 text-sm font-medium underline underline-offset-2 text-black/60 hover:text-black/80 dark:text-white/60 dark:hover:text-white/80"
      >
        See full list
      </button>
    </div>
  );
}
