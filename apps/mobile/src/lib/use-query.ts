import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Minimal data loader: runs `load` when the screen gains focus and again whenever `deps` change.
 * Swap for TanStack Query if caching across screens is needed.
 */
export function useQuery<T>(load: () => Promise<T>, deps: readonly unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setData(await loadRef.current());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const key = JSON.stringify(deps);
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    reload();
  }, [key, reload]);

  return { data, error, loading, reload };
}
