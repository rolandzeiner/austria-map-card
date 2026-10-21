/**
 * The borders and rivers of the tilted map, as lines for WebGL.
 *
 * Painted into the image laid over the relief, a border is a few pixels of
 * a 3072 px picture, and zoomed in that picture is magnified tenfold: the
 * lines turn into blurred bands. So the tilted map draws them as lines of
 * their own, lying on the ground, a constant number of pixels wide at any
 * zoom, and hidden where a mountain stands in front of them.
 *
 * This file decides which lines, in which colour and width, from the same
 * data, the same scales and the same palette as the flat map. The vertices
 * are plain segments on the map; the shader in relief-gl.ts finds their
 * height and their width on screen.
 */
import type { Lines } from "../data/format.ts";
import { BORDER_WIDTHS } from "../layers/borders.ts";
import { ROAD_LAYER, ROAD_STYLES, roadLines, roadSet } from "../layers/roads.ts";
import { useFineBorders } from "../layers/registry.ts";
import { RIVER_WIDTHS, riverLines, riversAt } from "../layers/rivers.ts";
import { SCALES, grown } from "../layers/scales.ts";
import type { MapStore } from "../layers/store.ts";
import type { LayerId } from "../types.ts";
import type { Feature } from "./labels.ts";
import { parseColour, type Palette, type Rgb } from "./palette.ts";

/** One batch of lines: one colour, one width. */
export interface LineSet {
  /** Names the data, not the style: the segments are built once per key. */
  readonly key: string;
  readonly segments: () => Float32Array;
  readonly colour: Rgb;
  /** Pixels on screen, CSS. */
  readonly width: number;
}

/**
 * Where a step from (x1, y1) to (x2, y2) crosses an edge of the relief's
 * triangles, as fractions of the way, in order.
 *
 * The mesh has a vertex at every cell centre (k + 0.5) and splits each
 * cell along the diagonal where x + y is a whole number (relief-gl.ts). A
 * straight piece inside one triangle lies exactly on its plane; a piece
 * across a ridge between two would cut through the mountain and vanish.
 * Every second line of the grid is also an edge of the coarser mesh drawn
 * for the whole country, so these cuts serve both.
 */
function crossings(x1: number, y1: number, x2: number, y2: number): number[] {
  const cuts: number[] = [];
  const across = (from: number, to: number): void => {
    if (from === to) return;
    const low = Math.min(from, to);
    const high = Math.max(from, to);
    for (let edge = Math.floor(low) + 1; edge < high; edge += 1)
      cuts.push((edge - from) / (to - from));
  };
  across(x1 - 0.5, x2 - 0.5);
  across(y1 - 0.5, y2 - 0.5);
  across(x1 + y1, x2 + y2);
  cuts.sort((a, b) => a - b);
  return cuts;
}

/**
 * Segments as x1, y1, x2, y2 for the chosen lines, cut at every edge of the
 * relief's triangles, so each lies flat on the ground. Rings are closed.
 */
export function segmentsOf(
  lines: Lines,
  keep: (line: number) => boolean,
  closed = lines.closed,
): Float32Array {
  const { xy, start } = lines;
  const out: number[] = [];
  const push = (x1: number, y1: number, x2: number, y2: number): void => {
    let t0 = 0;
    for (const t1 of [...crossings(x1, y1, x2, y2), 1]) {
      if (t1 - t0 < 1e-6) continue;
      out.push(x1 + (x2 - x1) * t0, y1 + (y2 - y1) * t0, x1 + (x2 - x1) * t1, y1 + (y2 - y1) * t1);
      t0 = t1;
    }
  };
  for (let line = 0; line < lines.count; line += 1) {
    if (!keep(line)) continue;
    const from = start[line] as number;
    const to = start[line + 1] as number;
    for (let point = from; point + 1 < to; point += 1) {
      push(
        xy[point * 2] as number,
        xy[point * 2 + 1] as number,
        xy[point * 2 + 2] as number,
        xy[point * 2 + 3] as number,
      );
    }
    if (closed && to - from > 2) {
      push(
        xy[(to - 1) * 2] as number,
        xy[(to - 1) * 2 + 1] as number,
        xy[from * 2] as number,
        xy[from * 2 + 1] as number,
      );
    }
  }
  return Float32Array.from(out);
}

/** Rings as one set of closed lines. */
function ringLines(rings: readonly Float32Array[]): Lines {
  const total = rings.reduce((sum, ring) => sum + ring.length / 2, 0);
  const xy = new Float32Array(total * 2);
  const start = new Uint32Array(rings.length + 1);
  let at = 0;
  rings.forEach((ring, index) => {
    start[index] = at;
    xy.set(ring, at * 2);
    at += ring.length / 2;
  });
  start[rings.length] = at;
  return { xy, start, count: rings.length, closed: true };
}

const rgb = (colour: string): Rgb => parseColour(colour) ?? [0, 0, 0];

/** Every line the tilted map draws, bottom first: rivers, borders from fine to national, the selection. */
export function reliefLines(
  store: MapStore,
  layers: ReadonlySet<LayerId>,
  scale: number,
  selection: Feature | null,
  palette: Palette,
): LineSet[] {
  const sets: LineSet[] = [];

  if (layers.has("rivers")) {
    const current = riversAt(store, scale);
    if (current !== undefined) {
      const { rivers } = current;
      for (let order = current.minOrder; order <= 9; order += 1) {
        sets.push({
          key: `rivers:${current.set}:${order}`,
          segments: () => segmentsOf(rivers.lines, (line) => rivers.order[line] === order),
          colour: rgb(palette.water),
          width: grown(RIVER_WIDTHS[order] ?? 0.45, scale),
        });
      }
    }
  }

  const colours = [palette.outline, palette.province, palette.district, palette.municipality];
  const border = (level: number, key: string, segments: () => Float32Array): void => {
    sets.push({
      key,
      segments,
      colour: rgb(colours[level] as string),
      width: grown(BORDER_WIDTHS[level] as number, scale),
    });
  };
  const fine = useFineBorders(store, layers, scale) && store.detail !== undefined;
  if (
    layers.has("municipalities") &&
    scale >= SCALES.municipalities &&
    store.municipalArcs !== undefined
  ) {
    const arcs = store.municipalArcs;
    border(3, "borders:municipal", () => segmentsOf(arcs.lines, () => true));
  }
  if (fine) {
    const detail = store.detail!;
    const levels = [0, 1, 2].filter(
      (level) => level === 0 || (level === 1 ? layers.has("provinces") : layers.has("districts")),
    );
    for (const level of levels.reverse()) {
      border(level, `borders:fine:${level}`, () =>
        segmentsOf(detail.arcs.lines, (line) => detail.level[line] === level),
      );
    }
  } else if (store.overview !== undefined) {
    const { arcs } = store.overview;
    if (layers.has("provinces"))
      border(1, "borders:coarse:1", () =>
        segmentsOf(arcs.lines, (line) => (arcs.a[line] as number) >= 0),
      );
    border(0, "borders:coarse:0", () =>
      segmentsOf(arcs.lines, (line) => (arcs.a[line] as number) < 0),
    );
  }

  // As on the flat map: over the inner borders, under the national one;
  // main roads under motorways.
  const roads: LineSet[] = [];
  for (const kind of ["main", "motorway"] as const) {
    const set = layers.has(ROAD_LAYER[kind]) ? roadSet(store, kind) : undefined;
    if (set === undefined) continue;
    const style = ROAD_STYLES[kind];
    const key = `roads:${kind}`;
    const all = (): Float32Array => segmentsOf(set.lines, () => true);
    if (scale < style.fullFrom) {
      roads.push({
        key,
        segments: all,
        colour: rgb(style.casingColour(palette)),
        width: style.thin,
      });
      continue;
    }
    roads.push({
      key,
      segments: all,
      colour: rgb(style.casingColour(palette)),
      width: grown(style.casing, scale),
    });
    roads.push({
      key,
      segments: all,
      colour: rgb(style.fill(palette)),
      width: grown(style.width, scale),
    });
  }
  const national = sets.findIndex(
    (set) => set.key.startsWith("borders:") && set.key.endsWith(":0"),
  );
  sets.splice(national < 0 ? sets.length : national, 0, ...roads);

  const accent = rgb(palette.accent);
  if (selection?.kind === "road") {
    const route = roadLines(store, selection.ref);
    if (route !== undefined) {
      const which = new Set(route.which);
      sets.push({
        key: `selected:road:${selection.ref}`,
        segments: () => segmentsOf(route.lines, (line) => which.has(line)),
        colour: accent,
        width: grown(3.2, scale),
      });
    }
  } else if (selection?.kind === "river") {
    const river = riverLines(store, scale, selection.name);
    if (river !== undefined) {
      const which = new Set(river.which);
      sets.push({
        key: `selected:river:${selection.name}:${scale >= SCALES.riversDetail ? "detail" : "overview"}:${which.size}`,
        segments: () => segmentsOf(river.lines, (line) => which.has(line)),
        colour: accent,
        width: grown(2.6, scale),
      });
    }
  } else if (selection !== null && selection.kind !== "city" && selection.kind !== "peak") {
    const index =
      selection.kind === "province"
        ? fine
          ? store.detail?.provinceIndex
          : store.overview?.index
        : selection.kind === "district"
          ? store.detail?.districtIndex
          : store.municipalityIndex;
    if (index !== undefined) {
      sets.push({
        key: `selected:${selection.kind}:${selection.row}:${fine ? "fine" : "coarse"}`,
        segments: () => segmentsOf(ringLines(index.rings(selection.row)), () => true),
        colour: accent,
        width: 2,
      });
    }
  }
  return sets;
}
