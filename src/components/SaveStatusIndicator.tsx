import type { SaveStatus } from '../hooks/useSchedule';

interface Props {
  status: SaveStatus;
  onRetry: () => void;
}

export function SaveStatusIndicator({ status, onRetry }: Props) {
  return (
    // Fixed height, always rendered (even when idle) so the normal
    // saving/saved cycle never shifts the Edit button — or anything below it
    // on the page — up and down. The rare error message is allowed to wrap
    // onto a second line rather than stretching the header wider, which on
    // a narrow screen pushed the Edit button partly off-screen.
    <div className="flex min-h-4 shrink-0 items-center justify-end">
      {status === 'error' ? (
        <button
          type="button"
          onClick={onRetry}
          className="max-w-[9rem] text-right text-xs font-medium leading-tight text-red-500 underline decoration-dotted underline-offset-2 hover:text-red-600"
        >
          Couldn't save — tap to retry
        </button>
      ) : (
        <span className="text-xs font-medium text-black/40 dark:text-white/40">
          {status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved' : ''}
        </span>
      )}
    </div>
  );
}
