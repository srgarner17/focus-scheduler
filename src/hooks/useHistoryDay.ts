import { useEffect, useState } from 'react';
import { getDoc } from 'firebase/firestore';
import type { HistoryDay } from '../types';
import { ensureSignedIn } from '../lib/firebase';
import { historyDocRef } from '../lib/storage';

export type HistoryState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'error' }
  | { status: 'ready'; day: HistoryDay };

// A history doc is immutable once written, so a one-off read (no listener)
// is enough, and a fetched result never needs refetching this session.
// Errors and "no record yet" aren't cached — a day that's still ending
// might get its snapshot written moments later.
const cache = new Map<string, HistoryDay>();

export function useHistoryDay(dateKey: string | null): HistoryState {
  const [result, setResult] = useState<{ key: string; state: HistoryState } | null>(null);

  useEffect(() => {
    if (!dateKey || cache.has(dateKey)) return;
    let cancelled = false;
    ensureSignedIn()
      .then(() => getDoc(historyDocRef(dateKey)))
      .then((snap) => {
        if (cancelled) return;
        if (snap.exists()) {
          const day = snap.data() as HistoryDay;
          cache.set(dateKey, day);
          setResult({ key: dateKey, state: { status: 'ready', day } });
        } else {
          setResult({ key: dateKey, state: { status: 'missing' } });
        }
      })
      .catch((err) => {
        console.error('Failed to load history:', err);
        if (!cancelled) setResult({ key: dateKey, state: { status: 'error' } });
      });
    return () => {
      cancelled = true;
    };
  }, [dateKey]);

  if (!dateKey) return { status: 'idle' };
  const cached = cache.get(dateKey);
  if (cached) return { status: 'ready', day: cached };
  if (result?.key === dateKey) return result.state;
  return { status: 'loading' };
}

// Test-only: clears the module-level cache between cases.
export function clearHistoryCache() {
  cache.clear();
}
