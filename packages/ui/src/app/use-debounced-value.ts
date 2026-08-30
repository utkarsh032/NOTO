import { useEffect, useState } from 'react';

/**
 * A value that lags behind the one being typed.
 *
 * Search runs against it rather than against the field, so a query is filtered
 * once the typing pauses instead of once per keystroke. The field itself stays
 * immediate — the caret must never wait for a list.
 */
export function useDebouncedValue<T>(value: T, delayMs = 180): T {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return settled;
}
