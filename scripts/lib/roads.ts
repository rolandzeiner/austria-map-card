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
    for (let piece = next(line[line.length - 1] as Point, from); piece !== undefined; ) {
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
      index === 0 ? 0 : sum + Math.hypot(point[0] - (points[index - 1] as Point)[0], point[1] - (points[index - 1] as Point)[1]),
    0,
  );

/** Douglas-Peucker on an open line in view-box units; both ends are kept. */
export function simplifyRoad(points: readonly Point[], tolerance: number): Point[] {
  const keep = keepByDistance(points, tolerance);
  return points.filter((_, index) => keep[index]);
}
