import { useEffect, useState } from 'react';
import { fetchLayers, fetchGraph, tiles } from '../data/datasets';
import type { Graph, LayerBundle } from '../types/domain';

/** Bundled heat grid exposure (used by panels that don't need geometry). */
export function tileLoadState() {
  return tiles.tiles;
}

/**
 * Lazily loads the heavy OSM layer geometries. Guards against rapid
 * re-mounts and exposes a `ready` flag so pages can render placeholders.
 */
export function useLayers() {
  const [layers, setLayers] = useState<LayerBundle | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    fetchLayers()
      .then((d) => {
        if (mounted) setLayers(d);
      })
      .catch((e: unknown) => {
        if (mounted) setError(e instanceof Error ? e.message : 'Failed to load map layers');
      });
    return () => {
      mounted = false;
    };
  }, []);

  return { layers, ready: layers !== null, error };
}

/** Lazily loads the route graph. */
export function useGraph() {
  const [graph, setGraph] = useState<Graph | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    fetchGraph()
      .then((d) => {
        if (mounted) setGraph(d);
      })
      .catch((e: unknown) => {
        if (mounted) setError(e instanceof Error ? e.message : 'Failed to load route graph');
      });
    return () => {
      mounted = false;
    };
  }, []);

  return { graph, ready: graph !== null, error };
}