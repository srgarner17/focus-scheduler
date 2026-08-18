interface Props {
  percent: number;
  barClass: string;
}

export function ProgressBar({ percent, barClass }: Props) {
  return (
    <div className="h-2.5 w-full rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ease-out ${barClass}`}
        style={{ width: `${Math.round(percent)}%` }}
      />
    </div>
  );
}
