import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ScheduleData } from '../types';

// useSchedule.ts (and the storage.ts it depends on) talk to Firestore
// directly. Rather than run the Firebase Local Emulator Suite, stub the SDK
// with a small in-memory "server document" so these tests exercise our own
// logic (optimistic updates, the write queue, the reset check) without a
// real network or persistence layer.
const { onSnapshotMock, runTransactionMock, setServerDoc, getServerDoc, fireSnapshot } = vi.hoisted(() => {
  let serverDoc: ScheduleData | undefined;
  let snapshotCallback: ((snap: { exists: () => boolean; data: () => ScheduleData | undefined }) => void) | null =
    null;

  function currentSnap() {
    return { exists: () => serverDoc !== undefined, data: () => serverDoc };
  }

  const runTransactionMock = vi.fn(async (_db: unknown, updateFn: (t: unknown) => unknown) => {
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
      result.current.updateItemMeta(category.id, itemId, { title: 'Typed mid-keystroke' });
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

  it('queues rapid same-device writes in order rather than racing them', async () => {
    const { result } = await mountSchedule();
    const categoryId = result.current.data!.categories[0].id;
    const itemId = result.current.data!.categories[0].items[0].id;

    act(() => {
      result.current.updateItemMeta(categoryId, itemId, { title: 'a' });
      result.current.updateItemMeta(categoryId, itemId, { title: 'ab' });
      result.current.updateItemMeta(categoryId, itemId, { title: 'abc' });
    });

    expect(result.current.data!.categories[0].items[0].title).toBe('abc');
    await waitFor(() => expect(getServerDoc()?.categories[0].items[0].title).toBe('abc'));
  });
});
