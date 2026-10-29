/**
 * Line geometry out of a GeoPackage: the BEV's and BMLUK's downloads both
 * store it this way. Reading the file itself needs SQLite and stays in
 * `build-data.mjs`; this reads one geometry blob.
 */

/**
 * The well-known binary inside a GeoPackage geometry blob: past a small
 * header ("GP", version, flags, SRS id) and an optional envelope whose size
 * the flags give.
 */
function wellKnownBinary(blob: Uint8Array): DataView {
  if (blob[0] !== 0x47 || blob[1] !== 0x50) throw new Error("not a GeoPackage geometry");
  const envelopeBytes = [0, 32, 48, 48, 64][((blob[3] as number) >> 1) & 7];
  if (envelopeBytes === undefined) throw new Error("unknown GeoPackage envelope");
  return new DataView(blob.buffer, blob.byteOffset + 8 + envelopeBytes);
}

/** Values per point of a WKB geometry type: x and y, plus Z (1000s, 3000s) and M (2000s, 3000s). */
function dimensionsOf(type: number): number {
  const family = Math.floor(type / 1000);
  return 2 + (family === 1 || family === 3 ? 1 : 0) + (family >= 2 ? 1 : 0);
}

/** `count` points from `at` on, x and y of each; Z and M are skipped. */
function readPoints(
  view: DataView,
  at: number,
  count: number,
  little: boolean,
  dimensions: number,
): { points: Array<[number, number]>; end: number } {
  const points: Array<[number, number]> = [];
  let next = at;
  for (let index = 0; index < count; index += 1) {
    points.push([view.getFloat64(next, little), view.getFloat64(next + 8, little)]);
    next += dimensions * 8;
  }
  return { points, end: next };
}

/**
 * The lines of a MultiLineString (or a plain LineString) stored as a
 * GeoPackage geometry blob.
 *
 * The blob is a small header ("GP", version, flags, SRS id and an optional
 * envelope whose size the flags give) followed by standard well-known
 * binary. Z and M values, where present, are skipped.
 */
export function parseGeoPackageLines(blob: Uint8Array): Array<Array<[number, number]>> {
  const view = wellKnownBinary(blob);
  let at = 0;
  const lineString = (): Array<[number, number]> => {
    const little = view.getUint8(at) === 1;
    const type = view.getUint32(at + 1, little);
    if (type % 1000 !== 2) throw new Error(`geometry type ${type} is not a LineString`);
    const count = view.getUint32(at + 5, little);
    at += 9;
    const points = readPoints(view, at, count, little, dimensionsOf(type));
    at = points.end;
    return points.points;
  };
  const little = view.getUint8(0) === 1;
  const type = view.getUint32(1, little) % 1000;
  if (type === 2) return [lineString()];
  if (type !== 5) throw new Error(`geometry type ${type} is not a (Multi)LineString`);
  const count = view.getUint32(5, little);
  at = 9;
  return Array.from({ length: count }, lineString);
}

/**
 * The polygons of a MultiPolygon (or a plain Polygon) stored as a
 * GeoPackage geometry blob: per polygon its rings, the outer ring first and
 * then its holes, each closed (the first point repeated at the end, as WKB
 * has it). Z and M values, where present, are skipped.
 */
export function parseGeoPackagePolygons(blob: Uint8Array): Array<Array<Array<[number, number]>>> {
  const view = wellKnownBinary(blob);
  let at = 0;
  const polygon = (): Array<Array<[number, number]>> => {
    const little = view.getUint8(at) === 1;
    const type = view.getUint32(at + 1, little);
    if (type % 1000 !== 3) throw new Error(`geometry type ${type} is not a Polygon`);
    const dimensions = dimensionsOf(type);
    const ringCount = view.getUint32(at + 5, little);
    at += 9;
    return Array.from({ length: ringCount }, () => {
      const count = view.getUint32(at, little);
      const ring = readPoints(view, at + 4, count, little, dimensions);
      at = ring.end;
      return ring.points;
    });
  };
  const little = view.getUint8(0) === 1;
  const type = view.getUint32(1, little) % 1000;
  if (type === 3) return [polygon()];
  if (type !== 6) throw new Error(`geometry type ${type} is not a (Multi)Polygon`);
  const count = view.getUint32(5, little);
  at = 9;
  return Array.from({ length: count }, polygon);
}
