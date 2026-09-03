import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useEditRevert } from './useEditRevert';

describe('useEditRevert', () => {
  it('is not dirty until a field is captured and its value changes', () => {
    const { result } = renderHook(() => useEditRevert(true));
    expect(result.current.isDirty('title', 'new value')).toBe(false);

    act(() => {
      result.current.capture('title', 'original');
    });
    // Same value as the snapshot — nothing to revert to yet.
    expect(result.current.isDirty('title', 'original')).toBe(false);
    // Value has since diverged from the snapshot.
    expect(result.current.isDirty('title', 'new value')).toBe(true);
  });

  it('only records the value from the FIRST change this session, not later ones', () => {
    const { result } = renderHook(() => useEditRevert(true));
    act(() => {
      result.current.capture('title', 'original');
    });
    act(() => {
      // A second edit shouldn't overwrite the snapshot with the intermediate value.
      result.current.capture('title', 'intermediate');
    });

    let reverted: string | undefined;
    act(() => {
      reverted = result.current.revert('title');
    });
    expect(reverted).toBe('original');
  });

  it('revert is one-shot: clears the snapshot so a second revert has nothing to return', () => {
    const { result } = renderHook(() => useEditRevert(true));
    act(() => {
      result.current.capture('title', 'original');
    });
    act(() => {
      result.current.revert('title');
    });
    expect(result.current.isDirty('title', 'changed again')).toBe(false);

    let secondRevert: string | undefined;
    act(() => {
      secondRevert = result.current.revert('title');
    });
    expect(secondRevert).toBeUndefined();
  });

  it('keeps independent snapshots per key', () => {
    const { result } = renderHook(() => useEditRevert(true));
    act(() => {
      result.current.capture('title', 'original title');
      result.current.capture('notes', 'original notes');
    });
    expect(result.current.isDirty('title', 'edited title')).toBe(true);
    expect(result.current.isDirty('notes', 'original notes')).toBe(false);
  });

  it('clears all snapshots once edit mode is exited', () => {
    const { result, rerender } = renderHook(({ editMode }) => useEditRevert(editMode), {
      initialProps: { editMode: true },
    });
    act(() => {
      result.current.capture('title', 'original');
    });
    expect(result.current.isDirty('title', 'edited')).toBe(true);

    rerender({ editMode: false });
    expect(result.current.isDirty('title', 'edited')).toBe(false);

    let reverted: string | undefined;
    act(() => {
      reverted = result.current.revert('title');
    });
    expect(reverted).toBeUndefined();
  });
});
