import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ScheduleData } from '../types';

// useSchedule.ts (and the storage.ts it depends on) talk to Firestore
// directly. Rather than run the Firebase Local Emulator Suite, stub the SDK
// with a small in-memory "server document" so these tests exercise our own
// logic (optimistic updates, the write queue, the reset check) without a
// real network or persistence layer.
const { onSnapshotMock, runTransactionMock, setServerDoc, getServerDoc, fireSnapshot, failNextTransactions } =
  vi.hoisted(() => {
    let serverDoc: ScheduleData | undefined;
    let snapshotCallback: ((snap: { exists: () => boolean; data: () => ScheduleData | undefined }) => void) | null =
      null;
    let failCount = 0;

    function currentSnap() {
      return { exists: () => serverDoc !== undefined, data: () => serverDoc };
    }

    const runTransactionMock = vi.fn(async (_db: unknown, updateFn: (t: unknown) => unknown) => {
      if (failCount > 0) {
        failCount -= 1;
        throw new Error('simulated write failure');
      }
      const transaction = {
        get: vi.fn(async () => currentSnap()),
        set: vi.fn((_ref: unknown, data: ScheduleData) => {
          serverDoc = data;
        }),
      };
      await updateFn(transaction);
    });

    const onSnapshotMock = vi.fn((_ref: unknown, cb: (snap: ReturnType<typeof currentSnap>) => void) => {
      snapshotCallback = cb;
      cb(currentSnap());
      return () => {
        snapshotCallback = null;
      };
    });

    return {
      onSnapshotMock,
      runTransactionMock,
      setServerDoc: (d: ScheduleData | undefined) => {
        serverDoc = d;
      },
      getServerDoc: () => serverDoc,
      fireSnapshot: () => snapshotCallback?.(currentSnap()),
      failNextTransactions: (n = 1) => {
        failCount = n;
      },
    };
  });

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => ({})),
  onSnapshot: onSnapshotMock,
  runTransaction: runTransactionMock,
}));

vi.mock('../lib/firebase', () => ({
  db: {},
  ensureSignedIn: vi.fn(() => Promise.resolve()),
}));

const { useSchedule } = await import('./useSchedule');

beforeEach(() => {
  setServerDoc(undefined);
  onSnapshotMock.mockClear();
  runTransactionMock.mockClear();
  failNextTransactions(0);
});

afterEach(() => {
  vi.useRealTimers();
});

async function mountSchedule() {
  const view = renderHook(() => useSchedule());
  await waitFor(() => expect(view.result.current.data).not.toBeNull());
  return view;
}

describe('useSchedule', () => {
  it('updates local state synchronously on mutate, before the Firestore transaction resolves (cursor-jump regression)', async () => {
    const { result } = await mountSchedule();
    const category = result.current.data!.categories[0];
    const itemId = category.items[0].id;

    act(() => {
      result.current.updateItemTitle(category.id, itemId, 'Typed mid-keystroke');
    });

    // Assert in the same tick as the call above, before awaiting anything —
    // this is exactly the timing that broke before the optimistic setData()
    // fix: the value must update on every keystroke without waiting on the
    // async write to resolve, or the cursor jumps to the end of the input.
    expect(result.current.data!.categories[0].items[0].title).toBe('Typed mid-keystroke');
  });

  it('resets stale completion state when the tab regains focus on a new day', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 7, 24, 9, 0));

    const { result } = await mountSchedule();
    const category = result.current.data!.categories[0];
    const itemId = category.items[0].id;

    act(() => {
      result.current.toggleItem(category.id, itemId);
    });
    await waitFor(() => expect(getServerDoc()?.categories[0].items[0].subSteps.every((s) => s.done)).toBe(true));

    // Device left open overnight, untouched — then the tab regains focus
    // the next morning.
    vi.setSystemTime(new Date(2026, 7, 25, 8, 0));
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
      await Promise.resolve();
    });
    await waitFor(() => expect(getServerDoc()?.lastResetDate).toBe('2026-08-25'));

    act(() => {
      fireSnapshot();
    });
    await waitFor(() =>
      expect(result.current.data!.categories[0].items[0].subSteps.every((s) => s.done)).toBe(false),
    );
  });

  it('toggleItem flips every sub-step together for an item that has them', async () => {
    const { result } = await mountSchedule();
    const category = result.current.data!.categories[0];
    const withSubSteps = category.items[0];
    expect(withSubSteps.subSteps.length).toBeGreaterThan(0);

    act(() => {
      result.current.toggleItem(category.id, withSubSteps.id);
    });
    expect(result.current.data!.categories[0].items[0].subSteps.every((s) => s.done)).toBe(true);

    act(() => {
      result.current.toggleItem(category.id, withSubSteps.id);
    });
    expect(result.current.data!.categories[0].items[0].subSteps.every((s) => s.done)).toBe(false);
  });

  it('addItem appends a new item and deleteItem removes it, persisting through the transaction', async () => {
    const { result } = await mountSchedule();
    const categoryId = result.current.data!.categories[0].id;
    const startCount = result.current.data!.categories[0].items.length;

    let newItemId = '';
    act(() => {
      newItemId = result.current.addItem(categoryId);
    });
    expect(result.current.data!.categories[0].items).toHaveLength(startCount + 1);
    await waitFor(() => expect(getServerDoc()?.categories[0].items).toHaveLength(startCount + 1));

    act(() => {
      result.current.deleteItem(categoryId, newItemId);
    });
    expect(result.current.data!.categories[0].items).toHaveLength(startCount);
    await waitFor(() => expect(getServerDoc()?.categories[0].items).toHaveLength(startCount));
  });

  it('queues rapid same-device immediate writes in order rather than racing them', async () => {
    const { result } = await mountSchedule();
    const categoryId = result.current.data!.categories[0].id;
    const itemId = result.current.data!.categories[0].items[0].id;

    // emoji is one of the fields that stays immediate (not debounced) — a
    // quick tap/paste, not sustained typing.
    act(() => {
      result.current.updateItemMeta(categoryId, itemId, { emoji: 'a' });
      result.current.updateItemMeta(categoryId, itemId, { emoji: 'ab' });
      result.current.updateItemMeta(categoryId, itemId, { emoji: 'abc' });
    });

    expect(result.current.data!.categories[0].items[0].emoji).toBe('abc');
    await waitFor(() => expect(getServerDoc()?.categories[0].items[0].emoji).toBe('abc'));
  });

  it('reports saving immediately, then saved once the write settles, fading back to idle after a delay', async () => {
    const { result } = await mountSchedule();
    const category = result.current.data!.categories[0];
    const itemId = category.items[0].id;
    expect(result.current.saveStatus).toBe('idle');

    // Fake only setTimeout (not Date/setInterval), and only from here, so the
    // save-fade timeout below is scheduled as a fake timer we can fast-
    // forward — mounting above still relied on real timers throughout.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      act(() => {
        result.current.toggleItem(category.id, itemId);
      });
      // Synchronous, same tick — a parent should see "Saving…" the instant
      // they act, not only once the transaction resolves.
      expect(result.current.saveStatus).toBe('saving');

      // The mocked transaction settles via microtasks, not a timer, so it
      // still resolves under fake timers — just flush it manually instead
      // of using waitFor (whose polling would itself need fake time to pass).
      await act(async () => {
        for (let i = 0; i < 10; i++) {
          await Promise.resolve();
        }
      });
      expect(result.current.saveStatus).toBe('saved');

      act(() => {
        vi.advanceTimersByTime(2100);
      });
      expect(result.current.saveStatus).toBe('idle');
    } finally {
      vi.useRealTimers();
    }
  });

  it('surfaces a save error and retries the exact same write via retrySave, without double-applying it', async () => {
    const { result } = await mountSchedule();
    const category = result.current.data!.categories[0];
    const itemId = category.items[0].id;

    failNextTransactions(1);
    act(() => {
      result.current.toggleItem(category.id, itemId);
    });
    await waitFor(() => expect(result.current.saveStatus).toBe('error'));

    // The optimistic local update already reflects the toggle even though
    // the write failed...
    expect(result.current.data!.categories[0].items[0].subSteps.every((s) => s.done)).toBe(true);
    // ...but the server never actually got it.
    expect(getServerDoc()?.categories[0].items[0].subSteps.every((s) => s.done)).toBe(false);

    act(() => {
      result.current.retrySave();
    });
    await waitFor(() => expect(result.current.saveStatus).toBe('saved'));

    // Retrying re-queues the same transaction against fresh server data —
    // it must not re-run the toggle a second time (which would flip it back
    // off) just because it re-applies the original mutation function.
    expect(getServerDoc()?.categories[0].items[0].subSteps.every((s) => s.done)).toBe(true);
    expect(result.current.data!.categories[0].items[0].subSteps.every((s) => s.done)).toBe(true);
  });

  it('retrySave is a no-op when there is nothing to retry', async () => {
    const { result } = await mountSchedule();
    const callsAfterMount = runTransactionMock.mock.calls.length;

    act(() => {
      result.current.retrySave();
    });
    expect(result.current.saveStatus).toBe('idle');
    expect(runTransactionMock.mock.calls.length).toBe(callsAfterMount);
  });

  it('debounces setChildName, sending only the final value after a pause, not one write per keystroke', async () => {
    const { result } = await mountSchedule();
    const callsBeforeTyping = runTransactionMock.mock.calls.length;

    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      act(() => result.current.setChildName('S'));
      expect(result.current.data!.childName).toBe('S');
      // Same tick — a parent should see "Saving…" the instant they type,
      // not only once the debounce window elapses.
      expect(result.current.saveStatus).toBe('saving');

      act(() => vi.advanceTimersByTime(300));
      act(() => result.current.setChildName('Sa'));
      expect(result.current.data!.childName).toBe('Sa');

      act(() => vi.advanceTimersByTime(300));
      act(() => result.current.setChildName('Sam'));
      expect(result.current.data!.childName).toBe('Sam');

      // Still within the debounce window after every keystroke above (each
      // one arrived under 600ms after the last) — nothing sent yet.
      expect(runTransactionMock.mock.calls.length).toBe(callsBeforeTyping);

      act(() => vi.advanceTimersByTime(650));
      await act(async () => {
        for (let i = 0; i < 10; i++) await Promise.resolve();
      });

      // Exactly one transaction for the whole typing session, carrying the
      // final value — not three, one per keystroke.
      expect(runTransactionMock.mock.calls.length).toBe(callsBeforeTyping + 1);
      expect(getServerDoc()?.childName).toBe('Sam');
      expect(result.current.saveStatus).toBe('saved');
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not block an unrelated immediate write while a debounced write is still pending', async () => {
    const { result } = await mountSchedule();
    const category = result.current.data!.categories[0];
    const itemId = category.items[0].id;

    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      act(() => result.current.setChildName('Sam')); // starts a 600ms debounce
      act(() => result.current.toggleItem(category.id, itemId)); // immediate

      await act(async () => {
        for (let i = 0; i < 10; i++) await Promise.resolve();
      });
      // The immediate toggle went through even though the name edit hasn't
      // debounced yet.
      expect(getServerDoc()?.categories[0].items[0].subSteps.every((s) => s.done)).toBe(true);
      // saveStatus stays "saving" — the name write is still pending.
      expect(result.current.saveStatus).toBe('saving');

      act(() => vi.advanceTimersByTime(650));
      await act(async () => {
        for (let i = 0; i < 10; i++) await Promise.resolve();
      });
      expect(getServerDoc()?.childName).toBe('Sam');
      expect(result.current.saveStatus).toBe('saved');
    } finally {
      vi.useRealTimers();
    }
  });

  it('flushes a pending debounced write on unmount instead of dropping it', async () => {
    const { result, unmount } = await mountSchedule();

    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      act(() => result.current.setChildName('Sam'));
      unmount();
      await act(async () => {
        for (let i = 0; i < 10; i++) await Promise.resolve();
      });
      expect(getServerDoc()?.childName).toBe('Sam');
    } finally {
      vi.useRealTimers();
    }
  });

  it('debounces updateCategoryName the same way as setChildName, sending only the final value', async () => {
    const { result } = await mountSchedule();
    const categoryId = result.current.data!.categories[0].id;
    const callsBeforeTyping = runTransactionMock.mock.calls.length;

    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      act(() => result.current.updateCategoryName(categoryId, 'C'));
      act(() => vi.advanceTimersByTime(300));
      act(() => result.current.updateCategoryName(categoryId, 'Ch'));
      act(() => vi.advanceTimersByTime(300));
      act(() => result.current.updateCategoryName(categoryId, 'Chores!'));
      expect(result.current.data!.categories[0].name).toBe('Chores!');

      expect(runTransactionMock.mock.calls.length).toBe(callsBeforeTyping);

      act(() => vi.advanceTimersByTime(650));
      await act(async () => {
        for (let i = 0; i < 10; i++) await Promise.resolve();
      });

      expect(runTransactionMock.mock.calls.length).toBe(callsBeforeTyping + 1);
      expect(getServerDoc()?.categories[0].name).toBe('Chores!');
    } finally {
      vi.useRealTimers();
    }
  });

  it('debounces two different categories\' name edits independently, without one canceling the other', async () => {
    const { result } = await mountSchedule();
    const categoryAId = result.current.data!.categories[0].id;
    const categoryBId = result.current.data!.categories[1].id;
    const callsBeforeTyping = runTransactionMock.mock.calls.length;

    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      act(() => result.current.updateCategoryName(categoryAId, 'Morning Stuff'));
      act(() => vi.advanceTimersByTime(300));
      // Editing a DIFFERENT category's name shouldn't reset or cancel
      // category A's still-pending debounce.
      act(() => result.current.updateCategoryName(categoryBId, 'House Jobs'));

      act(() => vi.advanceTimersByTime(350)); // A's window (600ms from its own keystroke) elapses
      await act(async () => {
        for (let i = 0; i < 10; i++) await Promise.resolve();
      });
      expect(getServerDoc()?.categories[0].name).toBe('Morning Stuff');
      // B was only set 300ms ago at this point — not sent yet.
      expect(getServerDoc()?.categories[1].name).not.toBe('House Jobs');

      act(() => vi.advanceTimersByTime(350)); // B's own 600ms window elapses
      await act(async () => {
        for (let i = 0; i < 10; i++) await Promise.resolve();
      });
      expect(getServerDoc()?.categories[1].name).toBe('House Jobs');

      // One transaction per category, not one shared/merged write.
      expect(runTransactionMock.mock.calls.length).toBe(callsBeforeTyping + 2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('debounces updateItemTitle the same way as setChildName, sending only the final value', async () => {
    const { result } = await mountSchedule();
    const categoryId = result.current.data!.categories[0].id;
    const itemId = result.current.data!.categories[0].items[0].id;
    const callsBeforeTyping = runTransactionMock.mock.calls.length;

    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      act(() => result.current.updateItemTitle(categoryId, itemId, 'M'));
      act(() => vi.advanceTimersByTime(300));
      act(() => result.current.updateItemTitle(categoryId, itemId, 'Make'));
      act(() => vi.advanceTimersByTime(300));
      act(() => result.current.updateItemTitle(categoryId, itemId, 'Make the Bed!'));
      expect(result.current.data!.categories[0].items[0].title).toBe('Make the Bed!');

      expect(runTransactionMock.mock.calls.length).toBe(callsBeforeTyping);

      act(() => vi.advanceTimersByTime(650));
      await act(async () => {
        for (let i = 0; i < 10; i++) await Promise.resolve();
      });

      expect(runTransactionMock.mock.calls.length).toBe(callsBeforeTyping + 1);
      expect(getServerDoc()?.categories[0].items[0].title).toBe('Make the Bed!');
    } finally {
      vi.useRealTimers();
    }
  });

  it('debounces different fields on the same item independently (title vs. notes)', async () => {
    const { result } = await mountSchedule();
    const categoryId = result.current.data!.categories[0].id;
    const itemId = result.current.data!.categories[0].items[0].id;

    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      act(() => result.current.updateItemTitle(categoryId, itemId, 'New Title'));
      act(() => vi.advanceTimersByTime(300));
      // Editing notes shouldn't reset or cancel the still-pending title edit.
      act(() => result.current.updateItemNotes(categoryId, itemId, 'New Notes'));

      act(() => vi.advanceTimersByTime(350)); // title's own 600ms window elapses
      await act(async () => {
        for (let i = 0; i < 10; i++) await Promise.resolve();
      });
      expect(getServerDoc()?.categories[0].items[0].title).toBe('New Title');
      expect(getServerDoc()?.categories[0].items[0].notes).not.toBe('New Notes');

      act(() => vi.advanceTimersByTime(350)); // notes' own 600ms window elapses
      await act(async () => {
        for (let i = 0; i < 10; i++) await Promise.resolve();
      });
      expect(getServerDoc()?.categories[0].items[0].notes).toBe('New Notes');
    } finally {
      vi.useRealTimers();
    }
  });

  it('debounces two different sub-steps on the same item independently', async () => {
    const { result } = await mountSchedule();
    const categoryId = result.current.data!.categories[0].id;
    const item = result.current.data!.categories[0].items[0];
    const [subStepA, subStepB] = item.subSteps;
    expect(subStepA).toBeDefined();
    expect(subStepB).toBeDefined();

    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      act(() => result.current.updateSubStepText(categoryId, item.id, subStepA.id, 'Step A edited'));
      act(() => vi.advanceTimersByTime(300));
      act(() => result.current.updateSubStepText(categoryId, item.id, subStepB.id, 'Step B edited'));

      act(() => vi.advanceTimersByTime(350));
      await act(async () => {
        for (let i = 0; i < 10; i++) await Promise.resolve();
      });
      const stepsAfterA = getServerDoc()?.categories[0].items[0].subSteps;
      expect(stepsAfterA?.find((s) => s.id === subStepA.id)?.text).toBe('Step A edited');
      expect(stepsAfterA?.find((s) => s.id === subStepB.id)?.text).not.toBe('Step B edited');

      act(() => vi.advanceTimersByTime(350));
      await act(async () => {
        for (let i = 0; i < 10; i++) await Promise.resolve();
      });
      const stepsAfterB = getServerDoc()?.categories[0].items[0].subSteps;
      expect(stepsAfterB?.find((s) => s.id === subStepB.id)?.text).toBe('Step B edited');
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not let an incoming snapshot overwrite text still mid-debounce (real-device typing-sync regression)', async () => {
    const { result } = await mountSchedule();

    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      act(() => result.current.setChildName('Sam'));
      expect(result.current.data!.childName).toBe('Sam');

      // Simulate a snapshot arriving mid-debounce — from another device's
      // edit, the periodic reset check, or just an echo of an earlier write
      // from this same device. The mocked "server" still has the old value
      // (nothing has been sent for this debounce yet), so if this were
      // applied it would visually revert what's being typed.
      act(() => fireSnapshot());
      expect(result.current.data!.childName).toBe('Sam');

      // Once the debounce fires and settles, this device is caught up with
      // the server again, and a subsequent snapshot applies normally.
      act(() => vi.advanceTimersByTime(650));
      await act(async () => {
        for (let i = 0; i < 10; i++) await Promise.resolve();
      });
      expect(result.current.saveStatus).toBe('saved');

      setServerDoc({ ...getServerDoc()!, childName: 'Changed on another device' });
      act(() => fireSnapshot());
      expect(result.current.data!.childName).toBe('Changed on another device');
    } finally {
      vi.useRealTimers();
    }
  });

  it('reorderSubStep swaps a sub-step with its neighbor, immediately, and is a no-op at either end', async () => {
    const { result } = await mountSchedule();
    const category = result.current.data!.categories[0];
    const item = category.items[0];
    const originalOrder = item.subSteps.map((s) => s.id);
    expect(originalOrder.length).toBeGreaterThanOrEqual(3);

    act(() => {
      result.current.reorderSubStep(category.id, item.id, originalOrder[1], 'up');
    });
    // Same tick — immediate, not debounced, like the day picker/toggle.
    const afterUp = result.current.data!.categories[0].items[0].subSteps.map((s) => s.id);
    expect(afterUp).toEqual([originalOrder[1], originalOrder[0], ...originalOrder.slice(2)]);
    await waitFor(() =>
      expect(getServerDoc()?.categories[0].items[0].subSteps.map((s) => s.id)).toEqual(afterUp),
    );

    // Moving the first step up, or the last step down, has nothing to swap
    // with — no-op, not a crash or a wraparound.
    act(() => {
      result.current.reorderSubStep(category.id, item.id, afterUp[0], 'up');
    });
    expect(result.current.data!.categories[0].items[0].subSteps.map((s) => s.id)).toEqual(afterUp);

    const lastId = afterUp[afterUp.length - 1];
    act(() => {
      result.current.reorderSubStep(category.id, item.id, lastId, 'down');
    });
    expect(result.current.data!.categories[0].items[0].subSteps.map((s) => s.id)).toEqual(afterUp);
  });

  it('reorderItems sets the full item order from an ordered id list, immediately', async () => {
    const { result } = await mountSchedule();
    const category = result.current.data!.categories[0];
    const originalOrder = category.items.map((it) => it.id);
    expect(originalOrder.length).toBeGreaterThanOrEqual(3);

    const reversed = [...originalOrder].reverse();
    act(() => {
      result.current.reorderItems(category.id, reversed);
    });
    // Same tick — immediate, not debounced, like reorderSubStep.
    expect(result.current.data!.categories[0].items.map((it) => it.id)).toEqual(reversed);
    await waitFor(() => expect(getServerDoc()?.categories[0].items.map((it) => it.id)).toEqual(reversed));
  });

  it('reorderItems appends any item missing from the ordered list, preserving its relative order', async () => {
    const { result } = await mountSchedule();
    const category = result.current.data!.categories[0];
    const originalOrder = category.items.map((it) => it.id);
    expect(originalOrder.length).toBeGreaterThanOrEqual(4);

    // Drag-and-drop only ever reorders the items edit mode actually shows —
    // an expired one-time item stays hidden and out of the dragged list, but
    // must still end up somewhere sane afterward, not dropped.
    const draggedOrder = [originalOrder[2], originalOrder[0], originalOrder[1]];
    act(() => {
      result.current.reorderItems(category.id, draggedOrder);
    });
    expect(result.current.data!.categories[0].items.map((it) => it.id)).toEqual([
      ...draggedOrder,
      ...originalOrder.slice(3),
    ]);
  });

  it('restoreCategory re-inserts a deleted category at its original index, fully intact', async () => {
    const { result } = await mountSchedule();
    const categoryToDelete = result.current.data!.categories[1];
    const originalIds = result.current.data!.categories.map((c) => c.id);

    act(() => {
      result.current.deleteCategory(categoryToDelete.id);
    });
    expect(result.current.data!.categories.map((c) => c.id)).toEqual(
      originalIds.filter((id) => id !== categoryToDelete.id),
    );
    await waitFor(() =>
      expect(getServerDoc()?.categories.map((c) => c.id)).toEqual(
        originalIds.filter((id) => id !== categoryToDelete.id),
      ),
    );

    act(() => {
      result.current.restoreCategory(categoryToDelete, 1);
    });
    expect(result.current.data!.categories.map((c) => c.id)).toEqual(originalIds);
    // Restored with every one of its items intact, not just an empty shell.
    expect(result.current.data!.categories[1].items).toEqual(categoryToDelete.items);
    await waitFor(() => expect(getServerDoc()?.categories.map((c) => c.id)).toEqual(originalIds));
  });

  it('restoreItem re-inserts a deleted item at its original index within its category', async () => {
    const { result } = await mountSchedule();
    const category = result.current.data!.categories[0];
    const itemToDelete = category.items[1];
    const originalIds = category.items.map((it) => it.id);

    act(() => {
      result.current.deleteItem(category.id, itemToDelete.id);
    });
    expect(result.current.data!.categories[0].items.map((it) => it.id)).toEqual(
      originalIds.filter((id) => id !== itemToDelete.id),
    );

    act(() => {
      result.current.restoreItem(category.id, itemToDelete, 1);
    });
    expect(result.current.data!.categories[0].items.map((it) => it.id)).toEqual(originalIds);
    await waitFor(() =>
      expect(getServerDoc()?.categories[0].items.map((it) => it.id)).toEqual(originalIds),
    );
  });

  it('restoreItem is a silent no-op if the category was also deleted in the meantime', async () => {
    const { result } = await mountSchedule();
    const category = result.current.data!.categories[0];
    const item = category.items[0];

    act(() => {
      result.current.deleteItem(category.id, item.id);
      result.current.deleteCategory(category.id);
    });
    expect(result.current.data!.categories.find((c) => c.id === category.id)).toBeUndefined();

    // Should not throw, and should not resurrect the category just to hold
    // the restored item.
    act(() => {
      result.current.restoreItem(category.id, item, 0);
    });
    expect(result.current.data!.categories.find((c) => c.id === category.id)).toBeUndefined();
  });
});
