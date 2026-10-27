import type { Lines } from "../data/format.ts";
import { TiledLines, traceLines } from "../map/tiles.ts";
import type { DrawContext, LayerDef } from "./registry.ts";

const tiled = new WeakMap<Lines, TiledLines>();

/**
 * Lakes, filled in the water colour. A lake and its islands are rings of
 * one path filled with the even-odd rule, so an island stays land; that
 * only holds while every ring of a lake lands in the same tile, which is
 * why the rings are filed by the box of the whole lake, not their own.
 */
function draw(dc: DrawContext): void {
  const { ctx, store, palette, shapes, box } = dc;
  const lakes = store.lakes;
  if (lakes === undefined) return;
  let tiles = tiled.get(lakes.rings);
  if (tiles === undefined) {
    tiles = new TiledLines(lakes.rings, lakeBoxes(lakes.lake, lakes.boxes), null);
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

/** Per ring: the box around every ring of its lake. */
function lakeBoxes(lake: Int32Array, boxes: Float32Array): Float32Array {
  const byLake = new Map<number, [number, number, number, number]>();
  lake.forEach((row, ring) => {
    const at = ring * 4;
    const own: [number, number, number, number] = [
      boxes[at] as number,
      boxes[at + 1] as number,
      boxes[at + 2] as number,
      boxes[at + 3] as number,
    ];
    const known = byLake.get(row);
    byLake.set(
      row,
      known === undefined
        ? own
        : [
            Math.min(known[0], own[0]),
            Math.min(known[1], own[1]),
            Math.max(known[2], own[2]),
            Math.max(known[3], own[3]),
          ],
    );
  });
  const out = new Float32Array(boxes.length);
  lake.forEach((row, ring) => out.set(byLake.get(row) as number[], ring * 4));
  return out;
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
