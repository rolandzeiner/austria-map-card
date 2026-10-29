import type { Lines } from "../data/format.ts";
import { TiledLines, groupBoxes, traceLines } from "../map/tiles.ts";
import type { DrawContext, LayerDef } from "./registry.ts";

const tiled = new WeakMap<Lines, TiledLines>();

/**
 * Glacier ice, filled over the terrain; a rock island is a ring inside its
 * ice field. The names are drawn in the label pass.
 */
function draw(dc: DrawContext): void {
  const { ctx, store, palette, shapes, box } = dc;
  const glaciers = store.glaciers;
  if (glaciers === undefined) return;
  let tiles = tiled.get(glaciers.rings);
  if (tiles === undefined) {
    tiles = new TiledLines(glaciers.rings, groupBoxes(glaciers.field, glaciers.boxes), null);
    tiled.set(glaciers.rings, tiles);
  }
  const rings = glaciers.rings;
  ctx.fillStyle = palette.glacier;
  tiles.visit(box, 0, (tile, which) => {
    ctx.fill(
      shapes.get(`glaciers:${tile}`, (path) => traceLines(path, rings, which)),
      "evenodd",
    );
  });
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
