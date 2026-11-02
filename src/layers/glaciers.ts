import { fillRings } from "./filled.ts";
import type { DrawContext, LayerDef } from "./registry.ts";

/**
 * Glacier ice, filled over the terrain; a rock island is a ring inside its
 * ice field. The names are drawn in the label pass.
 */
function draw(dc: DrawContext): void {
  const glaciers = dc.store.glaciers;
  if (glaciers === undefined) return;
  fillRings(dc, "glaciers", glaciers.rings, glaciers.field, glaciers.boxes, dc.palette.glacier);
}

export const glaciersLayer: LayerDef = {
  id: "glaciers",
  icon: "mdi:snowflake",
  minScale: 0,
  // The source is Austria's alone, so the ice on the border ends there.
  clipped: true,
  chunks: () => ["glaciers"],
  draw,
};
