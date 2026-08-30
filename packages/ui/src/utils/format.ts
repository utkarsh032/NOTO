/**
 * The small formatters the interface repeats everywhere: when something
 * happened, how big it is, what to call the group it belongs to.
 *
 * All of them take the locale from the platform rather than hard-coding one —
 * Noto ships in one language today, but a date written the American way round
 * on a European desktop is wrong in any language.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * "Just now", "2h ago", "Yesterday", "May 12, 2024".
 *
 * Deliberately not `Intl.RelativeTimeFormat` past a couple of days: "3 weeks
 * ago" is harder to place than the date itself, and a document list is scanned
 * for the one thing the reader half-remembers writing on a Tuesday.
 */
export function relativeTime(value: string | number | Date, now: number = Date.now()): string {
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
  if (Number.isNaN(time)) return '';

  const elapsed = now - time;

  if (elapsed < MINUTE) return 'Just now';
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)}m ago`;
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)}h ago`;

  const days = Math.floor(elapsed / DAY);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;

  return formatDate(time);
}

/** "Today, 9:41 AM" / "Yesterday, 4:20 PM" / "May 12, 2024" — for list rows. */
export function timestampLabel(value: string | number | Date, now: number = Date.now()): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const today = new Date(now);
  const isSameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

  const yesterday = new Date(now - DAY);

  if (isSameDay(date, today)) return `Today, ${formatTime(date)}`;
  if (isSameDay(date, yesterday)) return `Yesterday, ${formatTime(date)}`;

  return formatDate(date);
}

export function formatTime(value: string | number | Date): string {
  try {
    return new Intl.DateTimeFormat(undefined, { timeStyle: 'short' }).format(new Date(value));
  } catch {
    return '';
  }
}

export function formatDate(value: string | number | Date): string {
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value));
  } catch {
    return '';
  }
}

export function formatDateTime(value: string | number | Date): string {
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
      new Date(value),
    );
  } catch {
    return '';
  }
}

/** Which heading a timestamp belongs under in a grouped list. */
export function relativeGroup(value: string | number | Date, now: number = Date.now()): string {
  const time = new Date(value).getTime();
  const elapsed = now - time;

  if (elapsed < DAY && new Date(time).toDateString() === new Date(now).toDateString())
    return 'Today';
  if (new Date(time).toDateString() === new Date(now - DAY).toDateString()) return 'Yesterday';
  if (elapsed < 7 * DAY) return 'This week';
  if (elapsed < 30 * DAY) return 'This month';

  return 'Earlier';
}

/**
 * Whether a timestamp falls inside the last `days` days.
 *
 * A function rather than a comparison written at the call site: reading the
 * clock while rendering makes a component's output depend on when it happened
 * to render, and keeping that read here means one place to pass a fixed `now`
 * to from a test.
 */
export function isWithinDays(
  value: string | number | Date,
  days: number,
  now = Date.now(),
): boolean {
  const time = new Date(value).getTime();
  return !Number.isNaN(time) && now - time < days * DAY;
}

/** 1024-based, because this counts what is on disk. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;

  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unit = 0;

  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }

  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`;
}

/** "1 word" / "482 words", with the thousands separator the locale uses. */
export function pluralise(count: number, singular: string, plural = `${singular}s`): string {
  return `${count.toLocaleString()} ${count === 1 ? singular : plural}`;
}

/** The greeting on Home, which depends only on the hour. */
export function greetingFor(date: Date = new Date()): string {
  const hour = date.getHours();

  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';

  return 'Good evening';
}
