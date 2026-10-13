import { traceSmoothRings } from "../map/tiles.ts";
import type { DrawContext, LayerDef } from "./registry.ts";
import { SCALES } from "./scales.ts";

/**
 * Ground above each level, filled from the lowest level up.
 *
 * The bands nest (what is above 1000 m is also above 700 m), so painting
 * each one opaque in its own shade gives the same picture as stacking
 * translucent tints, without blending eleven layers over the whole canvas
 * on every frame.
 */
function draw(dc: DrawContext): void {
  const { ctx, store, palette, shapes, scale } = dc;
  const detail = scale >= SCALES.terrainDetail ? store.terrainDetail : undefined;
  const terrain = detail ?? store.overview?.terrain;
  if (terrain === undefined) return;
  const set = detail === undefined ? "overview" : "detail";
  terrain.bands.forEach((band, index) => {
    ctx.fillStyle = palette.band(terrain.levels[index] as number);
    ctx.fill(
      shapes.get(`terrain:${set}:${index}`, (path) => traceSmoothRings(path, band)),
      "evenodd",
    );
  });
}

export const terrainLayer: LayerDef = {
  id: "terrain",
  icon: "mdi:image-filter-hdr",
  minScale: 0,
  clipped: true,
  chunks: (scale) => (scale >= SCALES.terrainDetail ? ["terrain-detail"] : []),
  draw,
};
