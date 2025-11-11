import { useEffect, useState } from 'react';

// Lightweight debounce hook used to soften rapid filter toggles before
// triggering React Query refetches.
export const useDebounce = <T,>(value: T, delayMs: number): T => {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const handle = window.setTimeout(() => setDebounced(value), delayMs);

    return () => {
      window.clearTimeout(handle);
    };
  }, [value, delayMs]);

  return debounced;
};
