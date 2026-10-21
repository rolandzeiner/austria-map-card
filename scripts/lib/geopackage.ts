/**
 * Line geometry out of a GeoPackage: the BEV's and BMLUK's downloads both
 * store it this way. Reading the file itself needs SQLite and stays in
 * `build-data.mjs`; this reads one geometry blob.
 */

/**
 * The lines of a MultiLineString (or a plain LineString) stored as a
 * GeoPackage geometry blob.
 *
 * The blob is a small header ("GP", version, flags, SRS id and an optional
 * envelope whose size the flags give) followed by standard well-known
 * binary. Z and M values, where present, are skipped.
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
