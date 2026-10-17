import { useEffect, useState } from 'react';
import { fetchSpatialModel } from '../data/datasets';
import type { SpatialModel } from '../types/domain';

function useResource<T>(load: () => Promise<T>) {
  const [value, setValue] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    load().then((data) => { if (alive) setValue(data); }).catch((err: unknown) => {
      if (alive) setError(err instanceof Error ? err.message : 'Unable to load static spatial data.');
    });
    return () => { alive = false; };
  }, [load]);
  return { value, ready: Boolean(value), error };
}

export function useSpatialModel() { return useResource<SpatialModel>(fetchSpatialModel); }
