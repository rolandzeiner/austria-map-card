import type { LayerDef } from "./registry.ts";
import type { Places } from "./store.ts";

/**
 * Towns are drawn as part of the label pass, not here: a dot without its
 * name says nothing, so which towns appear is decided together with the
 * names, by what fits. This entry tells the registry what the layer needs.
 */
export const citiesLayer: LayerDef = {
  id: "cities",
  icon: "mdi:city-variant-outline",
  minScale: 0,
  clipped: false,
  chunks: () => ["places"],
  draw: () => undefined,
};

/**
 * The fewest residents a place needs to be shown at a scale. Capitals are
 * always shown. Places come sorted largest first, so the label pass stops
 * at the first one below this.
 */
export function minimumRank(scale: number): number {
  if (scale < 0.75) return 40_000;
  if (scale < 1.2) return 25_000;
  if (scale < 2) return 12_000;
  if (scale < 3.5) return 5_000;
  if (scale < 6) return 2_000;
  if (scale < 10) return 800;
  return 0;
}

/** How prominently a place is drawn: 0 the federal capital, 4 a village. */
export function placeTier(places: Places, row: number): number {
  const capital = places.capital[row] as number;
  const rank = places.rank[row] as number;
  if (capital === 2) return 0;
  if (capital === 1 || rank >= 100_000) return 1;
  if (rank >= 20_000) return 2;
  if (rank >= 5_000) return 3;
  return 4;
}
