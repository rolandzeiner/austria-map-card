/**
 * Rivers for the map: from the national river network's lines to a few
 * simplified strokes.
 *
 * Pure functions on plain arrays, like the rest of this folder. Reading the
 * GeoPackage itself needs SQLite and stays in `build-data.mjs`.
 */
import { keepByDistance } from "./geometry.ts";

type Point = readonly [x: number, y: number];

/** One stretch of a river, in view-box units. */
export interface RiverLine {
  /** Stream order (Flussordnungszahl): 9 is the Danube, 5 a larger tributary. */
  readonly order: number;
  readonly name: string;
  readonly points: readonly Point[];
}

/**
 * The coordinates of a LineString stored as a GeoPackage geometry blob.
 *
 * The blob is a small header ("GP", version, flags, SRS id and an optional
 * envelope whose size the flags give) followed by standard well-known
 * binary. Z and M values, where present, are skipped.
 */
export function parseGeoPackageLine(blob: Uint8Array): Array<[number, number]> {
  if (blob[0] !== 0x47 || blob[1] !== 0x50) throw new Error("not a GeoPackage geometry");
  const envelopeBytes = [0, 32, 48, 48, 64][((blob[3] as number) >> 1) & 7];
  if (envelopeBytes === undefined) throw new Error("unknown GeoPackage envelope");
  const start = 8 + envelopeBytes;
  const view = new DataView(blob.buffer, blob.byteOffset + start, blob.byteLength - start);
  const little = view.getUint8(0) === 1;
  const type = view.getUint32(1, little);
  if (type % 1000 !== 2) throw new Error(`geometry type ${type} is not a LineString`);
  const family = Math.floor(type / 1000);
  const dimensions = 2 + (family === 1 || family === 3 ? 1 : 0) + (family >= 2 ? 1 : 0);
  const count = view.getUint32(5, little);
  const points: Array<[number, number]> = [];
  for (let index = 0; index < count; index += 1) {
    const offset = 9 + index * dimensions * 8;
    points.push([view.getFloat64(offset, little), view.getFloat64(offset + 8, little)]);
  }
  return points;
}

/**
 * The stretches of a line that run inside, each with one point of overlap.
 *
 * The network continues into Bavaria, Bohemia and Hungary, and the map ends
 * at the border, so what lies outside is not carried. The one extra point on
 * either side lets a stroke reach the border instead of ending just short
 * of it.
 */
export function runsInside<P extends Point>(
  points: readonly P[],
  inside: (point: P) => boolean,
): P[][] {
  const flags = points.map(inside);
  const runs: P[][] = [];
  let run: P[] = [];
  points.forEach((point, index) => {
    if (flags[index] || flags[index - 1] || flags[index + 1]) {
      run.push(point);
      return;
    }
    if (run.length > 1) runs.push(run);
    run = [];
  });
  if (run.length > 1) runs.push(run);
  return runs;
}

/** Douglas-Peucker on an open line in view-box units; both ends are kept. */
export function simplifyRiver(points: readonly Point[], tolerance: number): Point[] {
  const keep = keepByDistance(points, tolerance);
  return points.filter((_, index) => keep[index]);
}
