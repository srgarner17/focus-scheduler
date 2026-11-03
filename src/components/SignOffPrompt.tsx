import { useState } from 'react';

interface Props {
  itemTitle: string;
  // Empty means no PIN is set (or the parent is already in edit mode, which
  // they got into with it) — approving needs nothing extra.
  expectedPin: string;
  onApprove: () => void;
  onSendBack: () => void;
  onCancel: () => void;
}

// A parent reviewing a checked-off item that requires sign-off. Uses the
// same PIN as edit mode, so he can't approve his own work.
export function SignOffPrompt({ itemTitle, expectedPin, onApprove, onSendBack, onCancel }: Props) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  function submit(action: () => void) {
    if (expectedPin && pin !== expectedPin) {
      setError(true);
      setPin('');
      return;
    }
    action();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onCancel}>
      <div
        className="w-full max-w-xs space-y-4 rounded-2xl bg-white p-5 dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center">
          <p className="font-semibold">Check this one</p>
          <p className="mt-1 text-sm text-black/60 dark:text-white/60">{itemTitle}</p>
        </div>
        {expectedPin && (
          <>
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              autoFocus
              maxLength={4}
              placeholder="Parent PIN"
              aria-label="Parent PIN"
              value={pin}
              onChange={(e) => {
                setError(false);
                setPin(e.target.value.replace(/\D/g, ''));
              }}
              onKeyDown={(e) => e.key === 'Enter' && submit(onApprove)}
              className={`w-full rounded-lg border bg-transparent px-3 py-2 text-center text-2xl tracking-[0.5em] ${
                error ? 'border-red-500' : 'border-black/10 dark:border-white/15'
              }`}
            />
            {error && <p className="text-center text-sm text-red-500">Wrong PIN, try again.</p>}
          </>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => submit(onSendBack)}
            className="flex-1 rounded-lg bg-black/5 py-2 text-sm font-medium dark:bg-white/10"
          >
            Not done yet
          </button>
          <button
            type="button"
            onClick={() => submit(onApprove)}
            className="flex-1 rounded-lg bg-neutral-900 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
          >
            Approve
          </button>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="w-full text-center text-sm text-black/50 dark:text-white/50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
