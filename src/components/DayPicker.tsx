import { DAY_LABELS, DAY_NAMES } from '../types';

interface Props {
  days: number[];
  onChange: (days: number[]) => void;
  chipClass: string;
}

export function DayPicker({ days, onChange, chipClass }: Props) {
  function toggle(dayIndex: number) {
    const on = days.includes(dayIndex);
    const next = on ? days.filter((d) => d !== dayIndex) : [...days, dayIndex].sort();
    onChange(next);
  }

  return (
    <div className="flex items-center gap-1">
      {DAY_LABELS.map((label, i) => {
        const on = days.includes(i);
        return (
          <button
            key={i}
            type="button"
            aria-label={DAY_NAMES[i]}
            aria-pressed={on}
            onClick={() => toggle(i)}
            className={`h-7 w-7 shrink-0 rounded-full text-xs font-semibold transition-colors ${
              on
                ? `${chipClass} text-white`
                : 'bg-black/5 dark:bg-white/10 text-black/40 dark:text-white/40'
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
