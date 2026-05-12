import { useEffect, useRef, useState } from 'react';

/** Fetch + auto-refresh, with loading & error state. */
export function useFetch<T>(
  fn: () => Promise<T>,
  deps: unknown[],
  options: { pollMs?: number; pollWhile?: (data: T) => boolean } = {},
): {
  data: T | null;
  error: string | null;
  loading: boolean;
  refresh: () => void;
} {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const lastFnRef = useRef(fn);
  lastFnRef.current = fn;

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const run = async () => {
      try {
        const next = await lastFnRef.current();
        if (cancelled) return;
        setData(next);
        setError(null);
        if (options.pollMs && options.pollMs > 0) {
          if (!options.pollWhile || options.pollWhile(next)) {
            timer = setTimeout(run, options.pollMs);
          }
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    setLoading(true);
    void run();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  return { data, error, loading, refresh: () => setTick((t) => t + 1) };
}
