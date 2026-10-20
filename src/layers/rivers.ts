import type { Lines } from "../data/format.ts";
import type { Box } from "../map/camera.ts";
import { TiledLines, traceLines } from "../map/tiles.ts";
import type { DrawContext, LayerDef } from "./registry.ts";
import { SCALES, grown } from "./scales.ts";
import type { MapStore, Rivers } from "./store.ts";

/** Stroke width in pixels by stream order; 9 is the Danube. */
export const RIVER_WIDTHS: Readonly<Record<number, number>> = { 9: 2.2, 8: 1.8, 7: 1.5, 6: 1.1, 5: 0.8, 4: 0.6, 3: 0.45 };

/** The river set to draw at a scale, and the lowest stream order to show from it. */
export function riversAt(store: MapStore, scale: number): { rivers: Rivers; set: string; minOrder: number } | undefined {
  const detail = scale >= SCALES.riversDetail ? store.riversDetail : undefined;
  if (detail !== undefined) {
    return { rivers: detail, set: "detail", minOrder: scale >= SCALES.streams ? 3 : 4 };
  }
  const overview = store.overview?.rivers;
  return overview === undefined ? undefined : { rivers: overview, set: "overview", minOrder: 5 };
}

const tiled = new WeakMap<Lines, TiledLines>();

/** The lines of a river set, filed by map tile and stream order. */
export function tiledRivers(rivers: Rivers): TiledLines {
  let tiles = tiled.get(rivers.lines);
  if (tiles === undefined) {
    tiles = new TiledLines(rivers.lines, rivers.boxes, rivers.order);
    tiled.set(rivers.lines, tiles);
  }
  return tiles;
}

function draw(dc: DrawContext): void {
  const { ctx, store, palette, shapes, scale, box } = dc;
  const current = riversAt(store, scale);
  if (current === undefined) return;
  const tiles = tiledRivers(current.rivers);
  ctx.strokeStyle = palette.water;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  // Small streams first, so a river is drawn over the brooks that join it.
  for (let order = current.minOrder; order <= 9; order += 1) {
    ctx.lineWidth = grown(RIVER_WIDTHS[order] ?? 0.45, scale) / scale;
    tiles.visit(box, order, (tile, lines) => {
      ctx.stroke(
        shapes.get(`rivers:${current.set}:${order}:${tile}`, (path) => traceLines(path, current.rivers.lines, lines)),
      );
    });
  }
}

/** The lines of one river, by name, in the set drawn at a scale. */
export function riverLines(store: MapStore, scale: number, name: string): { lines: Lines; which: number[] } | undefined {
  const current = riversAt(store, scale);
  if (current === undefined) return undefined;
  const row = current.rivers.names.indexOf(name);
  if (row < 0) return undefined;
  const which: number[] = [];
  for (let line = 0; line < current.rivers.lines.count; line += 1) {
    if (current.rivers.name[line] === row && (current.rivers.order[line] as number) >= current.minOrder) which.push(line);
  }
  return { lines: current.rivers.lines, which };
}

/** The box around every line of a river, in whichever set knows it best. */
export function riverBox(store: MapStore, name: string): Box | undefined {
  const rivers = store.riversDetail ?? store.overview?.rivers;
  if (rivers === undefined) return undefined;
  const row = rivers.names.indexOf(name);
  if (row < 0) return undefined;
  let box: [number, number, number, number] | undefined;
  for (let line = 0; line < rivers.lines.count; line += 1) {
    if (rivers.name[line] !== row) continue;
    const at = line * 4;
    const b = rivers.boxes;
    box =
      box === undefined
        ? [b[at] as number, b[at + 1] as number, b[at + 2] as number, b[at + 3] as number]
        : [
            Math.min(box[0], b[at] as number),
            Math.min(box[1], b[at + 1] as number),
            Math.max(box[2], b[at + 2] as number),
            Math.max(box[3], b[at + 3] as number),
          ];
  }
  return box;
}

/**
 * The named river nearest to a map point, if one is within `reach` map
 * units. Streams the source does not name are passed over: there would be
 * nothing to say about them.
 */
export function riverNear(
  store: MapStore,
  scale: number,
  x: number,
  y: number,
  reach: number,
): { name: string; order: number } | undefined {
  const current = riversAt(store, scale);
  if (current === undefined) return undefined;
  const { rivers, minOrder } = current;
  const { xy, start } = rivers.lines;
  let best = reach;
  let found: { name: string; order: number } | undefined;
  for (let line = 0; line < rivers.lines.count; line += 1) {
    const order = rivers.order[line] as number;
    const name = rivers.names[rivers.name[line] as number] as string;
    if (order < minOrder || name === "") continue;
    const at = line * 4;
    if (
      x < (rivers.boxes[at] as number) - reach ||
      x > (rivers.boxes[at + 2] as number) + reach ||
      y < (rivers.boxes[at + 1] as number) - reach ||
      y > (rivers.boxes[at + 3] as number) + reach
    ) {
      continue;
    }
    for (let point = start[line] as number; point + 1 < (start[line + 1] as number); point += 1) {
      const x1 = xy[point * 2] as number;
      const y1 = xy[point * 2 + 1] as number;
      const dx = (xy[point * 2 + 2] as number) - x1;
      const dy = (xy[point * 2 + 3] as number) - y1;
      const length = dx * dx + dy * dy;
      const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / length));
      const distance = Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
      if (distance < best) {
        best = distance;
        found = { name, order };
      }
    }
  }
  return found;
}

export const riversLayer: LayerDef = {
  id: "rivers",
  icon: "mdi:waves",
  minScale: 0,
  // Not cut off at the border: a border river runs on it, and the cut would
  // take half its width or all of it. The data ends just past the border.
  clipped: false,
  chunks: (scale) => (scale >= SCALES.riversDetail ? ["rivers-detail"] : []),
  draw,
};
