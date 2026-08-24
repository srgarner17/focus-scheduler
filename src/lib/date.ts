export function dateKeyFor(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayKey(): string {
  return dateKeyFor(new Date());
}

export function todayDayIndex(): number {
  return new Date().getDay();
}

// The YYYY-MM-DD date for each day of the current week (Sun..Sat), so
// one-time items can be matched against the actual calendar date shown in
// each of the week view's 7 slots, not just an abstract weekday.
export function currentWeekDateKeys(): string[] {
  const today = new Date();
  const sunday = new Date(today);
  sunday.setDate(today.getDate() - today.getDay());
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    return dateKeyFor(d);
  });
}

export function formatDateShort(dateKey: string): string {
  // Parse as local time, not UTC — new Date("YYYY-MM-DD") is UTC-midnight,
  // which can display as the previous day in western time zones.
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function friendlyDate(): string {
  return new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}
