interface Props {
  percent: number;
  barClass: string;
  trackClass?: string;
}

export function ProgressBar({ percent, barClass, trackClass = 'bg-black/10 dark:bg-white/10' }: Props) {
  return (
    <div className={`h-2.5 w-full rounded-full overflow-hidden ${trackClass}`}>
      <div
        className={`h-full rounded-full transition-all duration-500 ease-out ${barClass}`}
        style={{ width: `${Math.round(percent)}%` }}
      />
    </div>
  );
}
