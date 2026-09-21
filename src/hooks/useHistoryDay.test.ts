import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { HistoryDay } from '../types';

const { getDocMock } = vi.hoisted(() => ({ getDocMock: vi.fn() }));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_db: unknown, ...segments: string[]) => ({ path: segments.join('/') })),
  getDoc: getDocMock,
}));

vi.mock('../lib/firebase', () => ({
  db: {},
  ensureSignedIn: vi.fn(() => Promise.resolve()),
}));

const { useHistoryDay, clearHistoryCache } = await import('./useHistoryDay');

const day: HistoryDay = { date: '2026-08-24', categories: [] };

beforeEach(() => {
  getDocMock.mockReset();
  clearHistoryCache();
});

describe('useHistoryDay', () => {
  it('is idle and reads nothing when no date is given', () => {
    const { result } = renderHook(() => useHistoryDay(null));
    expect(result.current.status).toBe('idle');
    expect(getDocMock).not.toHaveBeenCalled();
  });

  it('loads a day from history/<date>', async () => {
    getDocMock.mockResolvedValue({ exists: () => true, data: () => day });
    const { result } = renderHook(() => useHistoryDay('2026-08-24'));
    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current).toEqual({ status: 'ready', day }));
    expect(getDocMock).toHaveBeenCalledWith({ path: 'history/2026-08-24' });
  });

  it('reports missing when no snapshot exists for that date', async () => {
    getDocMock.mockResolvedValue({ exists: () => false, data: () => undefined });
    const { result } = renderHook(() => useHistoryDay('2026-08-24'));
    await waitFor(() => expect(result.current.status).toBe('missing'));
  });

  it('reports an error when the read fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    getDocMock.mockRejectedValue(new Error('permission-denied'));
    const { result } = renderHook(() => useHistoryDay('2026-08-24'));
    await waitFor(() => expect(result.current.status).toBe('error'));
  });

  it('does not refetch a day it already has — history is immutable', async () => {
    getDocMock.mockResolvedValue({ exists: () => true, data: () => day });
    const first = renderHook(() => useHistoryDay('2026-08-24'));
    await waitFor(() => expect(first.result.current.status).toBe('ready'));
    first.unmount();

    const second = renderHook(() => useHistoryDay('2026-08-24'));
    expect(second.result.current.status).toBe('ready');
    expect(getDocMock).toHaveBeenCalledTimes(1);
  });
});
