import { useState } from 'react';
import type { CategoryColor } from '../types';
import { colorOrder, colorStyles } from '../lib/colors';

interface Props {
  onAdd: (name: string, emoji: string, color: CategoryColor) => void;
}

export function AddCategory({ onAdd }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('⭐');
  const [color, setColor] = useState<CategoryColor>('purple');

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onAdd(trimmed, emoji || '⭐', color);
    setName('');
    setEmoji('⭐');
    setColor('purple');
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-2xl border-2 border-dashed border-black/15 dark:border-white/20 py-4 text-sm font-medium text-black/50 dark:text-white/50 hover:border-black/30"
      >
        + Add a new category
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-black/10 dark:border-white/15 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <input
          value={emoji}
          onChange={(e) => setEmoji(e.target.value)}
          className="w-11 rounded-lg border border-black/10 dark:border-white/15 bg-transparent px-2 py-1 text-center"
        />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="Category name"
          className="flex-1 rounded-lg border border-black/10 dark:border-white/15 bg-transparent px-2 py-1"
          autoFocus
        />
      </div>
      <div className="flex items-center gap-2">
        {colorOrder.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={c}
            onClick={() => setColor(c)}
            className={`h-7 w-7 rounded-full ${colorStyles[c].chip} ${
              color === c ? 'ring-2 ring-offset-2 ring-black/40 dark:ring-offset-neutral-900' : ''
            }`}
          />
        ))}
      </div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={submit} className="rounded-lg bg-black/5 dark:bg-white/10 px-3 py-1.5 text-sm font-medium">
          Add category
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-black/40">
          Cancel
        </button>
      </div>
    </div>
  );
}
