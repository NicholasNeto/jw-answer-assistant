import { useEffect, useState } from "react";

type ApiState<T> = {
  data: T | null;
  error: string | null;
  loading: boolean;
};

// Faz GET a `url`. Com `intervalMs`, repete o pedido (útil para o estado do telemóvel).
export function useApi<T>(url: string, intervalMs?: number): ApiState<T> {
  const [state, setState] = useState<ApiState<T>>({ data: null, error: null, loading: true });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as T;
        if (!cancelled) setState({ data, error: null, loading: false });
      } catch (e) {
        if (!cancelled) {
          setState((s) => ({ data: s.data, error: (e as Error).message, loading: false }));
        }
      }
    };

    load();
    const timer = intervalMs ? setInterval(load, intervalMs) : undefined;
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [url, intervalMs]);

  return state;
}
