import type { CategoryColor } from '../types';

export interface ColorStyle {
  chip: string; // category header badge background
  soft: string; // light card background
  border: string;
  text: string;
  bar: string; // progress bar fill
  ring: string; // focus / expanded ring
}

export const colorStyles: Record<CategoryColor, ColorStyle> = {
  orange: {
    chip: 'bg-orange-500',
    soft: 'bg-orange-50 dark:bg-orange-950/40',
    border: 'border-orange-200 dark:border-orange-900',
    text: 'text-orange-700 dark:text-orange-300',
    bar: 'bg-orange-500',
    ring: 'ring-orange-400',
  },
  green: {
    chip: 'bg-emerald-500',
    soft: 'bg-emerald-50 dark:bg-emerald-950/40',
    border: 'border-emerald-200 dark:border-emerald-900',
    text: 'text-emerald-700 dark:text-emerald-300',
    bar: 'bg-emerald-500',
    ring: 'ring-emerald-400',
  },
  blue: {
    chip: 'bg-sky-500',
    soft: 'bg-sky-50 dark:bg-sky-950/40',
    border: 'border-sky-200 dark:border-sky-900',
    text: 'text-sky-700 dark:text-sky-300',
    bar: 'bg-sky-500',
    ring: 'ring-sky-400',
  },
  purple: {
    chip: 'bg-violet-500',
    soft: 'bg-violet-50 dark:bg-violet-950/40',
    border: 'border-violet-200 dark:border-violet-900',
    text: 'text-violet-700 dark:text-violet-300',
    bar: 'bg-violet-500',
    ring: 'ring-violet-400',
  },
  pink: {
    chip: 'bg-pink-500',
    soft: 'bg-pink-50 dark:bg-pink-950/40',
    border: 'border-pink-200 dark:border-pink-900',
    text: 'text-pink-700 dark:text-pink-300',
    bar: 'bg-pink-500',
    ring: 'ring-pink-400',
  },
  teal: {
    chip: 'bg-teal-500',
    soft: 'bg-teal-50 dark:bg-teal-950/40',
    border: 'border-teal-200 dark:border-teal-900',
    text: 'text-teal-700 dark:text-teal-300',
    bar: 'bg-teal-500',
    ring: 'ring-teal-400',
  },
};

export const colorOrder: CategoryColor[] = ['orange', 'green', 'blue', 'purple', 'pink', 'teal'];
