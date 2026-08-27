import { type ClassValue, clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/*
 * Noto's type scale is named — `text-h2`, `text-body-sm`, `text-caption` —
 * rather than sized, so tailwind-merge cannot tell those apart from text
 * *colour* utilities and falls back to treating them as colours. Left alone it
 * quietly deletes `text-on-brand` from a button that also asks for
 * `text-button`, and the label inherits whatever the page colour happens to be.
 *
 * Naming the scale here is what keeps size and colour in separate groups.
 */
const TYPE_SCALE = [
  'display',
  'h1',
  'h2',
  'h3',
  'h4',
  'body',
  'body-lg',
  'body-sm',
  'caption',
  'button',
];

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: TYPE_SCALE }],
    },
  },
});

/**
 * Merges class names, letting a caller's utility override a component's default
 * rather than both landing in the class list and the cascade deciding.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
