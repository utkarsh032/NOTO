export type DiffKind = 'same' | 'added' | 'removed';

export interface DiffLine {
  kind: DiffKind;
  text: string;
}

/**
 * Beyond this many cells, the table is not built: the middle of the two texts
 * is reported as removed-then-added instead. Twenty million comparisons is
 * several hundred milliseconds on a phone, and a document that different from
 * an old version is better shown whole than diffed slowly.
 */
const MAX_CELLS = 4_000_000;

/**
 * A line-by-line diff: what `after` removed from `before`, and what it added.
 *
 * Common lines at either end are trimmed first, which in practice leaves a
 * small middle — an edit is usually somewhere, not everywhere — and the middle
 * is compared with a longest-common-subsequence table.
 */
export function diffLines(before: string, after: string): DiffLine[] {
  const a = before.split('\n');
  const b = after.split('\n');

  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start += 1;

  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA -= 1;
    endB -= 1;
  }

  const head = a.slice(0, start).map((text): DiffLine => ({ kind: 'same', text }));
  const tail = a.slice(endA).map((text): DiffLine => ({ kind: 'same', text }));

  const midA = a.slice(start, endA);
  const midB = b.slice(start, endB);

  return [...head, ...diffMiddle(midA, midB), ...tail];
}

function diffMiddle(a: string[], b: string[]): DiffLine[] {
  if (a.length === 0) return b.map((text) => ({ kind: 'added', text }));
  if (b.length === 0) return a.map((text) => ({ kind: 'removed', text }));

  if (a.length * b.length > MAX_CELLS) {
    return [
      ...a.map((text): DiffLine => ({ kind: 'removed', text })),
      ...b.map((text): DiffLine => ({ kind: 'added', text })),
    ];
  }

  // lengths[i][j]: the LCS of a[i..] and b[j..], in one flat array.
  const width = b.length + 1;
  const lengths = new Uint32Array((a.length + 1) * width);

  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      lengths[i * width + j] =
        a[i] === b[j]
          ? lengths[(i + 1) * width + j + 1]! + 1
          : Math.max(lengths[(i + 1) * width + j]!, lengths[i * width + j + 1]!);
    }
  }

  const result: DiffLine[] = [];
  let i = 0;
  let j = 0;

  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      result.push({ kind: 'same', text: a[i]! });
      i += 1;
      j += 1;
    } else if (lengths[(i + 1) * width + j]! >= lengths[i * width + j + 1]!) {
      result.push({ kind: 'removed', text: a[i]! });
      i += 1;
    } else {
      result.push({ kind: 'added', text: b[j]! });
      j += 1;
    }
  }

  while (i < a.length) result.push({ kind: 'removed', text: a[(i += 1) - 1]! });
  while (j < b.length) result.push({ kind: 'added', text: b[(j += 1) - 1]! });

  return result;
}

/** How many lines a diff added and removed, for a one-line summary. */
export function diffStats(lines: readonly DiffLine[]): { added: number; removed: number } {
  let added = 0;
  let removed = 0;

  for (const line of lines) {
    if (line.kind === 'added') added += 1;
    if (line.kind === 'removed') removed += 1;
  }

  return { added, removed };
}
