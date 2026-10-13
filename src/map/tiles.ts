/**
 * Paths for the canvas, built once and kept, and lines sorted into map
 * tiles so that a zoomed-in frame only strokes what is in view.
 */
import { boxesTouch, type Box } from "./camera.ts";
import type { Lines } from "../data/format.ts";

/** Makes an empty path. The browser's `Path2D`, or a stand-in outside one. */
export type PathFactory = () => Path2D;

/** Paths by name. The data never changes once loaded, so nothing is ever evicted. */
export class ShapeCache {
  private readonly paths = new Map<string, Path2D>();
  private readonly create: PathFactory;

  public constructor(create: PathFactory) {
    this.create = create;
  }

  public get(key: string, build: (path: Path2D) => void): Path2D {
    let path = this.paths.get(key);
    if (path === undefined) {
      path = this.create();
      build(path);
      this.paths.set(key, path);
    }
    return path;
  }

  public get size(): number {
    return this.paths.size;
  }
}

/** Add lines to a path: all of them, or the ones listed. Rings are closed. */
export function traceLines(path: Path2D, lines: Lines, which?: Iterable<number>): void {
  const { xy, start, closed } = lines;
  const one = (line: number): void => {
    const from = start[line] as number;
    const to = start[line + 1] as number;
    if (to - from < 2) return;
    path.moveTo(xy[from * 2] as number, xy[from * 2 + 1] as number);
    for (let point = from + 1; point < to; point += 1) {
      path.lineTo(xy[point * 2] as number, xy[point * 2 + 1] as number);
    }
    if (closed) path.closePath();
  };
  if (which === undefined) for (let line = 0; line < lines.count; line += 1) one(line);
  else for (const line of which) one(line);
}

/**
 * Add rings to a path as smooth curves through the middles of their sides,
 * each corner pulling the curve towards it. Terrain outlines are traced on a
 * grid and would show its facets when zoomed in; borders are surveyed lines
 * and must not be rounded, so this is for terrain only.
 */
export function traceSmoothRings(path: Path2D, lines: Lines): void {
  const { xy, start } = lines;
  for (let line = 0; line < lines.count; line += 1) {
    const from = start[line] as number;
    const count = (start[line + 1] as number) - from;
    if (count < 3) continue;
    const x = (index: number): number => xy[(from + (index % count)) * 2] as number;
    const y = (index: number): number => xy[(from + (index % count)) * 2 + 1] as number;
    path.moveTo((x(0) + x(1)) / 2, (y(0) + y(1)) / 2);
    for (let index = 1; index <= count; index += 1) {
      path.quadraticCurveTo(x(index), y(index), (x(index) + x(index + 1)) / 2, (y(index) + y(index + 1)) / 2);
    }
    path.closePath();
  }
}

/** Add closed rings, given as flat x, y pairs, to a path. */
export function traceRings(path: Path2D, rings: ReadonlyArray<Float32Array>): void {
  for (const ring of rings) {
    if (ring.length < 6) continue;
    path.moveTo(ring[0] as number, ring[1] as number);
    for (let index = 2; index < ring.length; index += 2) {
      path.lineTo(ring[index] as number, ring[index + 1] as number);
    }
    path.closePath();
  }
}

interface Tile {
  /** The box around everything filed here, which can reach past the tile. */
  box: [number, number, number, number];
  byClass: Map<number, number[]>;
}

/**
 * Lines filed by map tile and by class (a border's level, a river's order).
 *
 * A line belongs to the tile its middle falls in, and each tile remembers
 * the box around all its lines. A tile is drawn when that box touches the
 * view, so a line that sticks out of its tile is never missed.
 */
export class TiledLines {
  public readonly lines: Lines;
  private readonly tiles = new Map<number, Tile>();

  public constructor(lines: Lines, boxes: Float32Array, classOf: ArrayLike<number> | null, tile = 64) {
    this.lines = lines;
    for (let line = 0; line < lines.count; line += 1) {
      const left = boxes[line * 4] as number;
      const top = boxes[line * 4 + 1] as number;
      const right = boxes[line * 4 + 2] as number;
      const bottom = boxes[line * 4 + 3] as number;
      const id = Math.floor((top + bottom) / 2 / tile) * 4096 + Math.floor((left + right) / 2 / tile);
      let entry = this.tiles.get(id);
      if (entry === undefined) {
        entry = { box: [left, top, right, bottom], byClass: new Map() };
        this.tiles.set(id, entry);
      } else {
        entry.box = [
          Math.min(entry.box[0], left),
          Math.min(entry.box[1], top),
          Math.max(entry.box[2], right),
          Math.max(entry.box[3], bottom),
        ];
      }
      const group = classOf === null ? 0 : (classOf[line] as number);
      const list = entry.byClass.get(group);
      if (list === undefined) entry.byClass.set(group, [line]);
      else list.push(line);
    }
  }

  /** Call `each` for every tile in view that has lines of this class. */
  public visit(view: Box, group: number, each: (tile: number, lines: readonly number[]) => void): void {
    for (const [id, tile] of this.tiles) {
      if (!boxesTouch(tile.box, view)) continue;
      const list = tile.byClass.get(group);
      if (list !== undefined) each(id, list);
    }
  }

  public get tileCount(): number {
    return this.tiles.size;
  }
}
