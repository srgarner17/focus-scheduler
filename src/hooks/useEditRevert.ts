import { useEffect, useRef, useState } from 'react';

// Lets a parent undo starting to edit the wrong field, even after they've
// already moved on to something else — not a general undo history, just a
// one-shot "put this field back to what it said when I started this edit
// session" per field. The snapshot is captured lazily, the first time a
// field actually changes, and lives for the rest of edit mode rather than
// disappearing on blur, since noticing "wait, that's not what I meant to
// edit" often happens after tabbing away from the field.
export function useEditRevert(editMode: boolean) {
  const snapshots = useRef<Map<string, string>>(new Map());
  // Snapshots live in a ref (not state) so capturing one doesn't itself
  // trigger a render on every keystroke — this counter is bumped only on
  // the rare actions (first change to a field, a revert) that should.
  const [, forceRender] = useState(0);

  useEffect(() => {
    if (!editMode) snapshots.current.clear();
  }, [editMode]);

  // Records `currentValue` as the field's original value, but only the
  // first time this is called for a given key in this edit-mode session —
  // a second call (the next keystroke) is a no-op, so the snapshot always
  // reflects the value before any edits this session, not the value before
  // the most recent one.
  function capture(key: string, currentValue: string) {
    if (!snapshots.current.has(key)) {
      snapshots.current.set(key, currentValue);
      forceRender((v) => v + 1);
    }
  }

  // Whether a field has something to revert to right now — a snapshot
  // exists and the live value has actually diverged from it (reverting
  // back to the original value on your own makes this false again).
  function isDirty(key: string, currentValue: string): boolean {
    const snap = snapshots.current.get(key);
    return snap !== undefined && snap !== currentValue;
  }

  // Returns the field's original value and clears its snapshot — a revert
  // is one-shot, not a multi-step undo stack, so once used there's nothing
  // further back to go to until the field is edited again this session.
  function revert(key: string): string | undefined {
    const snap = snapshots.current.get(key);
    if (snap !== undefined) {
      snapshots.current.delete(key);
      forceRender((v) => v + 1);
    }
    return snap;
  }

  return { capture, isDirty, revert };
}

export type EditRevertControls = ReturnType<typeof useEditRevert>;
