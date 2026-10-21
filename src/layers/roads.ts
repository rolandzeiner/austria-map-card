/**
 * The road layers: motorways and expressways (A, S), and the main roads
 * (B, the former Bundesstraßen). Both come as strokes per route from the
 * BEV's transport theme, so one set of functions draws, finds and frames
 * either; a route number says which set it is in.
 */
import type { Lines } from "../data/format.ts";
import type { Box } from "../map/camera.ts";
import type { Palette } from "../map/palette.ts";
import { traceLines } from "../map/tiles.ts";
import type { LayerId } from "../types.ts";
import type { DrawContext, LayerDef } from "./registry.ts";
import { grown } from "./scales.ts";
import type { MapStore, Roads } from "./store.ts";

export type RoadClass = "motorway" | "main";

/** How a class of road is drawn: widths in pixels, colours from the palette. */
export interface RoadStyle {
  readonly width: number;
  readonly casing: number;
  readonly fill: (palette: Palette) => string;
  readonly casingColour: (palette: Palette) => string;
  /**
   * Below this scale a main road is one thin line: 10 000 km of cased road
   * would bury the whole-country map.
   */
  readonly fullFrom: number;
  readonly thin: number;
}

export const ROAD_STYLES: Readonly<Record<RoadClass, RoadStyle>> = {
  motorway: {
    width: 2,
    casing: 3.6,
    fill: (palette) => palette.motorway,
    casingColour: (palette) => palette.motorwayCasing,
    fullFrom: 0,
    thin: 0,
  },
  main: {
    width: 1.4,
    casing: 2.6,
    fill: (palette) => palette.road,
    casingColour: (palette) => palette.roadCasing,
    fullFrom: 1.6,
    thin: 0.7,
  },
};

/** The layer each class belongs to. */
export const ROAD_LAYER: Readonly<Record<RoadClass, LayerId>> = {
  motorway: "motorways",
  main: "main_roads",
};

export const roadSet = (store: MapStore, kind: RoadClass): Roads | undefined =>
  kind === "motorway" ? store.motorways : store.mainRoads;

/** The class of a route number: B roads are main roads, A and S motorways. */
export const classOf = (ref: string): RoadClass => (ref.startsWith("B") ? "main" : "motorway");

/** One class of roads, casing first and the fill over it; thin and uncased while far out. */
function drawRoads(dc: DrawContext, kind: RoadClass): void {
  const { ctx, store, palette, shapes, scale } = dc;
  const roads = roadSet(store, kind);
  if (roads === undefined) return;
  const style = ROAD_STYLES[kind];
  const path = shapes.get(`roads:${kind}`, (target) => traceLines(target, roads.lines));
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (scale < style.fullFrom) {
    ctx.strokeStyle = style.casingColour(palette);
    ctx.lineWidth = style.thin / scale;
    ctx.stroke(path);
    return;
  }
  ctx.strokeStyle = style.casingColour(palette);
  ctx.lineWidth = grown(style.casing, scale) / scale;
  ctx.stroke(path);
  ctx.strokeStyle = style.fill(palette);
  ctx.lineWidth = grown(style.width, scale) / scale;
  ctx.stroke(path);
}

/** The lines of one route. */
export function roadLines(
  store: MapStore,
  ref: string,
): { lines: Lines; which: number[] } | undefined {
  const roads = roadSet(store, classOf(ref));
  const route = roads?.refs.indexOf(ref) ?? -1;
  if (roads === undefined || route < 0) return undefined;
  const which: number[] = [];
  for (let line = 0; line < roads.lines.count; line += 1)
    if (roads.route[line] === route) which.push(line);
  return { lines: roads.lines, which };
}

/** The box round a whole route. */
export function roadBox(store: MapStore, ref: string): Box | undefined {
  const found = roadLines(store, ref);
  const boxes = roadSet(store, classOf(ref))?.boxes;
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

/** The route of the road nearest a map point among one set, if within `reach` map units. */
function nearIn(
  roads: Roads,
  x: number,
  y: number,
  reach: number,
): { ref: string; distance: number } | undefined {
  const { xy, start } = roads.lines;
  let best = reach;
  let found: string | undefined;
  for (let line = 0; line < roads.lines.count; line += 1) {
    const b = roads.boxes;
    if (x < (b[line * 4] as number) - reach || x > (b[line * 4 + 2] as number) + reach) continue;
    if (y < (b[line * 4 + 1] as number) - reach || y > (b[line * 4 + 3] as number) + reach)
      continue;
    for (let point = start[line] as number; point + 1 < (start[line + 1] as number); point += 1) {
      const x1 = xy[point * 2] as number;
      const y1 = xy[point * 2 + 1] as number;
      const dx = (xy[point * 2 + 2] as number) - x1;
      const dy = (xy[point * 2 + 3] as number) - y1;
      const length = dx * dx + dy * dy;
      const t =
        length === 0 ? 0 : Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / length));
      const distance = Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
      if (distance < best) {
        best = distance;
        found = roads.refs[roads.route[line] as number];
      }
    }
  }
  return found === undefined ? undefined : { ref: found, distance: best };
}

/**
 * The route of the road nearest a map point, among the layers that are on.
 * A motorway wins a near tie: it is drawn over the main road beside it.
 */
export function roadNear(
  store: MapStore,
  layers: ReadonlySet<LayerId>,
  x: number,
  y: number,
  reach: number,
): string | undefined {
  const motorway =
    layers.has("motorways") && store.motorways ? nearIn(store.motorways, x, y, reach) : undefined;
  const main =
    layers.has("main_roads") && store.mainRoads ? nearIn(store.mainRoads, x, y, reach) : undefined;
  if (motorway !== undefined && (main === undefined || motorway.distance <= main.distance * 1.5))
    return motorway.ref;
  return main?.ref;
}

export const motorwaysLayer: LayerDef = {
  id: "motorways",
  icon: "mdi:highway",
  minScale: 0,
  clipped: false,
  chunks: () => ["motorways"],
  draw: (dc) => drawRoads(dc, "motorway"),
};

export const mainRoadsLayer: LayerDef = {
  id: "main_roads",
  icon: "mdi:road-variant",
  minScale: 0,
  clipped: false,
  chunks: () => ["main-roads"],
  draw: (dc) => drawRoads(dc, "main"),
};
