import type { SaveStatus } from '../hooks/useSchedule';

interface Props {
  status: SaveStatus;
  onRetry: () => void;
}

export function SaveStatusIndicator({ status, onRetry }: Props) {
  if (status === 'idle') return null;

  if (status === 'error') {
    return (
      <button
        type="button"
        onClick={onRetry}
        className="shrink-0 text-xs font-medium text-red-500 underline decoration-dotted underline-offset-2 hover:text-red-600"
      >
        Couldn't save — tap to retry
      </button>
    );
  }

  return (
    <span className="shrink-0 text-xs font-medium text-black/40 dark:text-white/40">
      {status === 'saving' ? 'Saving…' : 'Saved'}
    </span>
  );
}
