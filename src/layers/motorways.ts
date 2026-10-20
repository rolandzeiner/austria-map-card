import type { Lines } from "../data/format.ts";
import type { Box } from "../map/camera.ts";
import { traceLines } from "../map/tiles.ts";
import type { DrawContext, LayerDef } from "./registry.ts";
import { grown } from "./scales.ts";
import type { MapStore } from "./store.ts";

/** Stroke widths in pixels: the amber line, and the casing round it. */
export const MOTORWAY_WIDTH = 2;
export const MOTORWAY_CASING = 3.6;

/**
 * Motorways and expressways, casing first and the amber line over it. 145
 * strokes for the whole country, so they are one path each and need no
 * tiles.
 */
function draw(dc: DrawContext): void {
  const { ctx, store, palette, shapes, scale } = dc;
  const motorways = store.motorways;
  if (motorways === undefined) return;
  const path = shapes.get("motorways", (target) => traceLines(target, motorways.lines));
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = palette.motorwayCasing;
  ctx.lineWidth = grown(MOTORWAY_CASING, scale) / scale;
  ctx.stroke(path);
  ctx.strokeStyle = palette.motorway;
  ctx.lineWidth = grown(MOTORWAY_WIDTH, scale) / scale;
  ctx.stroke(path);
}

/** The lines of one route. */
export function motorwayLines(store: MapStore, ref: string): { lines: Lines; which: number[] } | undefined {
  const motorways = store.motorways;
  const route = motorways?.refs.indexOf(ref) ?? -1;
  if (motorways === undefined || route < 0) return undefined;
  const which: number[] = [];
  for (let line = 0; line < motorways.lines.count; line += 1) if (motorways.route[line] === route) which.push(line);
  return { lines: motorways.lines, which };
}

/** The box round a whole route. */
export function motorwayBox(store: MapStore, ref: string): Box | undefined {
  const found = motorwayLines(store, ref);
  const boxes = store.motorways?.boxes;
  if (found === undefined || boxes === undefined || found.which.length === 0) return undefined;
  let box: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const line of found.which) {
    box = [
      Math.min(box[0], boxes[line * 4] as number),
      Math.min(box[1], boxes[line * 4 + 1] as number),
      Math.max(box[2], boxes[line * 4 + 2] as number),
      Math.max(box[3], boxes[line * 4 + 3] as number),
    ];
  }
  return box;
}

/** The route of the motorway nearest a map point, if one is within `reach` map units. */
export function motorwayNear(store: MapStore, x: number, y: number, reach: number): string | undefined {
  const motorways = store.motorways;
  if (motorways === undefined) return undefined;
  const { xy, start } = motorways.lines;
  let best = reach;
  let found: string | undefined;
  for (let line = 0; line < motorways.lines.count; line += 1) {
    const b = motorways.boxes;
    if (x < (b[line * 4] as number) - reach || x > (b[line * 4 + 2] as number) + reach) continue;
    if (y < (b[line * 4 + 1] as number) - reach || y > (b[line * 4 + 3] as number) + reach) continue;
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
        found = motorways.refs[motorways.route[line] as number];
      }
    }
  }
  return found;
}

export const motorwaysLayer: LayerDef = {
  id: "motorways",
  icon: "mdi:highway",
  minScale: 0,
  clipped: false,
  chunks: () => ["motorways"],
  draw,
};
