import type { Lines } from "../data/format.ts";
import { TiledLines, groupBoxes, traceLines } from "../map/tiles.ts";
import type { DrawContext } from "./registry.ts";

const tiled = new WeakMap<Lines, TiledLines>();

/**
 * Fill a set of rings in one colour, tile by tile, with the even-odd rule:
 * a ring inside another is a hole (an island in a lake, rock in an ice
 * field). `group` names the feature each ring belongs to, so a feature's
 * rings are boxed and tiled together. `key` prefixes the shape cache.
 */
export function fillRings(
  dc: DrawContext,
  key: string,
  rings: Lines,
  group: Int32Array,
  boxes: Float32Array,
  colour: string,
): void {
  const { ctx, shapes, box } = dc;
  let tiles = tiled.get(rings);
  if (tiles === undefined) {
    tiles = new TiledLines(rings, groupBoxes(group, boxes), null);
    tiled.set(rings, tiles);
  }
  ctx.fillStyle = colour;
  tiles.visit(box, 0, (tile, which) => {
    ctx.fill(
      shapes.get(`${key}:${tile}`, (path) => traceLines(path, rings, which)),
      "evenodd",
    );
  });
}
