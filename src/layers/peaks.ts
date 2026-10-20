import type { LayerDef } from "./registry.ts";

/**
 * Summits are drawn in the label pass, like the towns: a mark without its
 * name and height says nothing, so which summits appear is decided with the
 * names, by what fits.
 */
export const peaksLayer: LayerDef = {
  id: "peaks",
  icon: "mdi:summit",
  minScale: 0,
  clipped: false,
  chunks: () => ["peaks"],
  draw: () => undefined,
};
