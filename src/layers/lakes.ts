import type { Lines } from "../data/format.ts";
import { TiledLines, groupBoxes, traceLines } from "../map/tiles.ts";
import type { DrawContext, LayerDef } from "./registry.ts";

const tiled = new WeakMap<Lines, TiledLines>();

/** Lakes, filled in the water colour; an island is a ring inside its lake. */
function draw(dc: DrawContext): void {
  const { ctx, store, palette, shapes, box } = dc;
  const lakes = store.lakes;
  if (lakes === undefined) return;
  let tiles = tiled.get(lakes.rings);
  if (tiles === undefined) {
    tiles = new TiledLines(lakes.rings, groupBoxes(lakes.lake, lakes.boxes), null);
    tiled.set(lakes.rings, tiles);
  }
  const rings = lakes.rings;
  ctx.fillStyle = palette.water;
  tiles.visit(box, 0, (tile, which) => {
    ctx.fill(
      shapes.get(`lakes:${tile}`, (path) => traceLines(path, rings, which)),
      "evenodd",
    );
  });
}

export const lakesLayer: LayerDef = {
  id: "lakes",
  icon: "mdi:water",
  minScale: 0,
  // Cut at the border. The source is Austria's alone, so the Neusiedler See
  // and the Bodensee end where the country does, and the clip makes that
  // edge the border's own line.
  clipped: true,
  chunks: () => ["lakes"],
  draw,
};
