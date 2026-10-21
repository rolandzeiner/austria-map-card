/**
 * Motorways for the map: from the BEV's road pieces to one set of long
 * strokes per route.
 *
 * Pure functions on plain arrays, like the rest of this folder. Reading the
 * GeoPackage itself needs SQLite and stays in `build-data.mjs`.
 */
import { keepByDistance } from "./geometry.ts";

type Point = readonly [x: number, y: number];

/**
 * The lines of a MultiLineString (or a plain LineString) stored as a
 * GeoPackage geometry blob: the GeoPackage header, then well-known binary.
 * Z and M values, where present, are skipped.
 */
export function parseGeoPackageLines(blob: Uint8Array): Array<Array<[number, number]>> {
  if (blob[0] !== 0x47 || blob[1] !== 0x50) throw new Error("not a GeoPackage geometry");
  const envelopeBytes = [0, 32, 48, 48, 64][((blob[3] as number) >> 1) & 7];
  if (envelopeBytes === undefined) throw new Error("unknown GeoPackage envelope");
  const view = new DataView(blob.buffer, blob.byteOffset + 8 + envelopeBytes);
  let at = 0;
  const lineString = (): Array<[number, number]> => {
    const little = view.getUint8(at) === 1;
    const type = view.getUint32(at + 1, little);
    if (type % 1000 !== 2) throw new Error(`geometry type ${type} is not a LineString`);
    const family = Math.floor(type / 1000);
    const dimensions = 2 + (family === 1 || family === 3 ? 1 : 0) + (family >= 2 ? 1 : 0);
    const count = view.getUint32(at + 5, little);
    at += 9;
    const points: Array<[number, number]> = [];
    for (let index = 0; index < count; index += 1) {
      points.push([view.getFloat64(at, little), view.getFloat64(at + 8, little)]);
      at += dimensions * 8;
    }
    return points;
  };
  const little = view.getUint8(0) === 1;
  const type = view.getUint32(1, little) % 1000;
  if (type === 2) return [lineString()];
  if (type !== 5) throw new Error(`geometry type ${type} is not a (Multi)LineString`);
  const count = view.getUint32(5, little);
  at = 9;
  return Array.from({ length: count }, lineString);
}

const keyOf = ([x, y]: Point): string => `${Math.round(x * 100)},${Math.round(y * 100)}`;

/**
 * Join pieces that meet end to end into long lines. Where exactly two
 * pieces meet, they become one; at a fork (three or more ends) every line
 * stops. Each piece is used once, in whichever direction continues the line.
 */
export function joinPieces(pieces: ReadonlyArray<readonly Point[]>): Point[][] {
  const ends = new Map<string, number[]>();
  const touch = (point: Point, piece: number): void => {
    const key = keyOf(point);
    const list = ends.get(key);
    if (list === undefined) ends.set(key, [piece]);
    else list.push(piece);
  };
  pieces.forEach((piece, index) => {
    touch(piece[0] as Point, index);
    touch(piece[piece.length - 1] as Point, index);
  });
  const used = new Uint8Array(pieces.length);
  /** The piece that continues the line at `point`, other than `from`, if the point is not a fork. */
  const next = (point: Point, from: number): number | undefined => {
    const list = ends.get(keyOf(point)) as number[];
    if (list.length !== 2) return undefined;
    const other = list[0] === from ? list[1] : list[0];
    return other === undefined || used[other] ? undefined : other;
  };
  const grow = (line: Point[], from: number): void => {
    for (let piece = next(line[line.length - 1] as Point, from); piece !== undefined;) {
      used[piece] = 1;
      const points = pieces[piece] as readonly Point[];
      const forward = keyOf(points[0] as Point) === keyOf(line[line.length - 1] as Point);
      const along = forward ? points : [...points].reverse();
      line.push(...along.slice(1));
      piece = next(line[line.length - 1] as Point, piece);
    }
  };
  const lines: Point[][] = [];
  pieces.forEach((piece, index) => {
    if (used[index]) return;
    used[index] = 1;
    const line = [...piece];
    grow(line, index);
    line.reverse();
    grow(line, index);
    lines.push(line);
  });
  return lines;
}

export const lengthOf = (points: readonly Point[]): number =>
  points.reduce(
    (sum, point, index) =>
      index === 0
        ? 0
        : sum +
          Math.hypot(
            point[0] - (points[index - 1] as Point)[0],
            point[1] - (points[index - 1] as Point)[1],
          ),
    0,
  );

/** Douglas-Peucker on an open line in view-box units; both ends are kept. */
export function simplifyRoad(points: readonly Point[], tolerance: number): Point[] {
  const keep = keepByDistance(points, tolerance);
  return points.filter((_, index) => keep[index]);
}

/**
 * The length of a route along the road, in the units of its points.
 *
 * A motorway is drawn as two carriageways, so the sum of its lines is twice
 * the route. A stretch of line counts half where another line of the route
 * runs alongside it, in either direction, within `pairDistance`; elsewhere,
 * on a single-tube tunnel or a two-lane road, it counts in full.
 *
 * Only separate lines pair up. The two legs of a hairpin run side by side
 * too, but they are one line, joined at the bend: pass the route's pieces
 * through `joinPieces` first, or the Glocknerstraße loses a quarter of its
 * length.
 */
export function routeLength(lines: ReadonlyArray<readonly Point[]>, pairDistance: number): number {
  interface Segment {
    readonly a: Point;
    readonly b: Point;
    readonly line: number;
  }
  const cell = pairDistance;
  const grid = new Map<string, Segment[]>();
  lines.forEach((points, line) => {
    for (let index = 1; index < points.length; index += 1) {
      const segment = { a: points[index - 1] as Point, b: points[index] as Point, line };
      const [x0, x1] = [
        Math.min(segment.a[0], segment.b[0]),
        Math.max(segment.a[0], segment.b[0]),
      ].map((v) => Math.floor(v / cell));
      const [y0, y1] = [
        Math.min(segment.a[1], segment.b[1]),
        Math.max(segment.a[1], segment.b[1]),
      ].map((v) => Math.floor(v / cell));
      for (let x = x0 as number; x <= (x1 as number); x += 1) {
        for (let y = y0 as number; y <= (y1 as number); y += 1) {
          const key = `${x},${y}`;
          const list = grid.get(key);
          if (list === undefined) grid.set(key, [segment]);
          else list.push(segment);
        }
      }
    }
  });
  /** Whether a segment of another line runs alongside at `mid`, heading along (ux, uy) or against it. */
  const paired = (mid: Point, ux: number, uy: number, line: number): boolean => {
    const cx = Math.floor(mid[0] / cell);
    const cy = Math.floor(mid[1] / cell);
    for (let x = cx - 1; x <= cx + 1; x += 1) {
      for (let y = cy - 1; y <= cy + 1; y += 1) {
        for (const other of grid.get(`${x},${y}`) ?? []) {
          if (other.line === line) continue;
          const length = Math.hypot(other.b[0] - other.a[0], other.b[1] - other.a[1]);
          if (length === 0) continue;
          const vx = (other.b[0] - other.a[0]) / length;
          const vy = (other.b[1] - other.a[1]) / length;
          // Roughly parallel: within 18 degrees.
          if (Math.abs(ux * vx + uy * vy) < 0.95) continue;
          const t = Math.max(
            0,
            Math.min(length, (mid[0] - other.a[0]) * vx + (mid[1] - other.a[1]) * vy),
          );
          if (Math.hypot(mid[0] - other.a[0] - t * vx, mid[1] - other.a[1] - t * vy) < pairDistance)
            return true;
        }
      }
    }
    return false;
  };
  let total = 0;
  lines.forEach((points, line) => {
    for (let index = 1; index < points.length; index += 1) {
      const a = points[index - 1] as Point;
      const b = points[index] as Point;
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (length === 0) continue;
      const mid: Point = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      total += paired(mid, (b[0] - a[0]) / length, (b[1] - a[1]) / length, line)
        ? length / 2
        : length;
    }
  });
  return total;
}
