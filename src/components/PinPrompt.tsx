import { useState } from 'react';

interface Props {
  expectedPin: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function PinPrompt({ expectedPin, onSuccess, onCancel }: Props) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  function submit() {
    if (pin === expectedPin) {
      onSuccess();
    } else {
      setError(true);
      setPin('');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onCancel}>
      <div
        className="w-full max-w-xs space-y-4 rounded-2xl bg-white p-5 dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-center font-semibold">Enter parent PIN</p>
        <input
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          autoFocus
          maxLength={4}
          value={pin}
          onChange={(e) => {
            setError(false);
            setPin(e.target.value.replace(/\D/g, ''));
          }}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          className={`w-full rounded-lg border bg-transparent px-3 py-2 text-center text-2xl tracking-[0.5em] ${
            error ? 'border-red-500' : 'border-black/10 dark:border-white/15'
          }`}
        />
        {error && <p className="text-center text-sm text-red-500">Wrong PIN, try again.</p>}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-lg bg-black/5 py-2 text-sm font-medium dark:bg-white/10"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            className="flex-1 rounded-lg bg-neutral-900 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
          >
            Unlock
          </button>
        </div>
      </div>
    </div>
  );
}
