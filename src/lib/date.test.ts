import { describe, expect, it, vi, afterEach } from 'vitest';
import { currentWeekDateKeys, dateKeyFor, formatDateShort, todayDayIndex, todayKey } from './date';

afterEach(() => {
  vi.useRealTimers();
});

describe('dateKeyFor', () => {
  it('formats a date as YYYY-MM-DD in local time', () => {
    expect(dateKeyFor(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('pads single-digit months and days', () => {
    expect(dateKeyFor(new Date(2026, 8, 3))).toBe('2026-09-03');
  });

  it('does not shift the date near a UTC day boundary', () => {
    // Late-night local time is a classic case where a UTC-based
    // formatter (e.g. toISOString()) would silently roll to the next day.
    const lateNight = new Date(2026, 0, 5, 23, 45);
    expect(dateKeyFor(lateNight)).toBe('2026-01-05');
  });
});

describe('todayKey / todayDayIndex', () => {
  it('reflects the current mocked date and weekday', () => {
    // 2026-08-25 is a Tuesday (day index 2).
    vi.setSystemTime(new Date(2026, 7, 25, 12, 0));
    expect(todayKey()).toBe('2026-08-25');
    expect(todayDayIndex()).toBe(2);
  });
});

describe('currentWeekDateKeys', () => {
  it('returns 7 keys spanning Sunday through Saturday of the current week', () => {
    // 2026-08-25 is a Tuesday; that week's Sunday is 2026-08-23.
    vi.setSystemTime(new Date(2026, 7, 25, 12, 0));
    expect(currentWeekDateKeys()).toEqual([
      '2026-08-23',
      '2026-08-24',
      '2026-08-25',
      '2026-08-26',
      '2026-08-27',
      '2026-08-28',
      '2026-08-29',
    ]);
  });

  it('handles a week that spans a month boundary', () => {
    // 2026-08-30 is a Sunday; the week runs into September.
    vi.setSystemTime(new Date(2026, 7, 30, 12, 0));
    expect(currentWeekDateKeys()).toEqual([
      '2026-08-30',
      '2026-08-31',
      '2026-09-01',
      '2026-09-02',
      '2026-09-03',
      '2026-09-04',
      '2026-09-05',
    ]);
  });

  it('starts from Sunday even when today is Sunday', () => {
    vi.setSystemTime(new Date(2026, 7, 30, 12, 0));
    expect(currentWeekDateKeys()[0]).toBe(todayKey());
  });
});

describe('formatDateShort', () => {
  it('parses a date key as local time, not UTC', () => {
    // Regression guard: new Date('YYYY-MM-DD') parses as UTC midnight,
    // which can display as the previous day west of UTC.
    const result = formatDateShort('2026-01-05');
    expect(result).toContain('5');
    expect(result).toMatch(/Jan/);
  });
});
