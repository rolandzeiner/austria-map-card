import { lineBoxes, type Lines } from "../data/format.ts";
import { TiledLines, traceLines } from "../map/tiles.ts";
import type { DrawContext, LayerDef } from "./registry.ts";
import { SCALES, grown } from "./scales.ts";
import type { Borders } from "./store.ts";

/** A border's level: 0 the national border, down to 3 between municipalities. */
export type BorderLevel = 0 | 1 | 2 | 3;

/** Stroke width in pixels by level. */
export const BORDER_WIDTHS: readonly number[] = [1.5, 1.1, 0.8, 0.5];

const tiled = new WeakMap<Lines, TiledLines>();

function tiledBorders(borders: Borders, classOf: ArrayLike<number> | null): TiledLines {
  let tiles = tiled.get(borders.lines);
  if (tiles === undefined) {
    tiles = new TiledLines(borders.lines, lineBoxes(borders.lines), classOf);
    tiled.set(borders.lines, tiles);
  }
  return tiles;
}

/**
 * Stroke the borders of one level.
 *
 * On the fine borders the three upper levels are one set of arcs told apart
 * by their level, and the municipal borders are a set of their own. On the
 * generalised borders there are only two levels: abroad on one side, or not.
 */
export function drawBorders(dc: DrawContext, level: BorderLevel): void {
  const { ctx, store, palette, shapes, scale, box, fine } = dc;
  let tiles: TiledLines | undefined;
  let set = "";
  let group: number = level;
  if (level === 3) {
    if (store.municipalArcs === undefined) return;
    tiles = tiledBorders(store.municipalArcs, null);
    set = "municipal";
    group = 0;
  } else if (fine && store.detail !== undefined) {
    tiles = tiledBorders(store.detail.arcs, store.detail.level);
    set = "fine";
  } else if (store.overview !== undefined && level < 2) {
    const { arcs } = store.overview;
    tiles = tiledBorders(
      arcs,
      Uint8Array.from(arcs.a, (side) => (side < 0 ? 0 : 1)),
    );
    set = "coarse";
  }
  if (tiles === undefined) return;
  const lines = tiles.lines;
  ctx.strokeStyle = [palette.outline, palette.province, palette.district, palette.municipality][
    level
  ] as string;
  ctx.lineWidth = grown(BORDER_WIDTHS[level] as number, scale) / scale;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  tiles.visit(box, group, (tile, which) => {
    ctx.stroke(
      shapes.get(`borders:${set}:${level}:${tile}`, (path) => traceLines(path, lines, which)),
    );
  });
}

export const provincesLayer: LayerDef = {
  id: "provinces",
  icon: "mdi:map-outline",
  minScale: 0,
  clipped: false,
  chunks: () => [],
  draw: (dc) => drawBorders(dc, 1),
};

export const districtsLayer: LayerDef = {
  id: "districts",
  icon: "mdi:vector-polygon",
  minScale: 0,
  clipped: false,
  chunks: () => ["borders"],
  draw: (dc) => drawBorders(dc, 2),
};

export const municipalitiesLayer: LayerDef = {
  id: "municipalities",
  icon: "mdi:vector-square",
  minScale: SCALES.municipalities,
  clipped: false,
  // Nothing loads while the layer waits for zoom: 190 KB of borders that
  // would not be drawn.
  chunks: (scale) => (scale >= SCALES.municipalities ? ["borders", "gemeinden"] : []),
  draw: (dc) => drawBorders(dc, 3),
};
