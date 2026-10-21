/**
 * Just enough of the Esri shapefile format to read polygons with their
 * attributes.
 *
 * Pure functions on bytes and arrays; `build-data.mjs` supplies the files.
 */

/** The rings of every polygon record in a .shp file, in file order. */
export function parseShapefilePolygons(bytes: Uint8Array): Array<Array<Array<[number, number]>>> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getInt32(0, false) !== 9994) throw new Error("not a shapefile");
  const shapes: Array<Array<Array<[number, number]>>> = [];
  let offset = 100;
  while (offset < bytes.byteLength) {
    const contentBytes = view.getInt32(offset + 4, false) * 2;
    const content = offset + 8;
    const type = view.getInt32(content, true);
    if (type !== 5 && type !== 0) throw new Error(`shape type ${type} is not a polygon`);
    const rings: Array<Array<[number, number]>> = [];
    if (type === 5) {
      const partCount = view.getInt32(content + 36, true);
      const pointCount = view.getInt32(content + 40, true);
      const partsAt = content + 44;
      const pointsAt = partsAt + partCount * 4;
      for (let part = 0; part < partCount; part += 1) {
        const from = view.getInt32(partsAt + part * 4, true);
        const to =
          part + 1 < partCount ? view.getInt32(partsAt + (part + 1) * 4, true) : pointCount;
        const ring: Array<[number, number]> = [];
        for (let index = from; index < to; index += 1) {
          ring.push([
            view.getFloat64(pointsAt + index * 16, true),
            view.getFloat64(pointsAt + index * 16 + 8, true),
          ]);
        }
        rings.push(ring);
      }
    }
    shapes.push(rings);
    offset = content + contentBytes;
  }
  return shapes;
}

/** The text of every record's fields in a .dbf file, in file order. */
export function parseDbf(bytes: Uint8Array, encoding = "utf-8"): Array<Record<string, string>> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const recordCount = view.getUint32(4, true);
  const headerBytes = view.getUint16(8, true);
  const recordBytes = view.getUint16(10, true);
  const decoder = new TextDecoder(encoding);
  const fields: Array<{ name: string; length: number }> = [];
  for (let offset = 32; bytes[offset] !== 0x0d; offset += 32) {
    const name = decoder.decode(bytes.subarray(offset, offset + 11)).split("\0")[0] as string;
    fields.push({ name, length: bytes[offset + 16] as number });
  }
  const records: Array<Record<string, string>> = [];
  for (let index = 0; index < recordCount; index += 1) {
    let at = headerBytes + index * recordBytes + 1;
    const record: Record<string, string> = {};
    for (const field of fields) {
      record[field.name] = decoder.decode(bytes.subarray(at, at + field.length)).trim();
      at += field.length;
    }
    records.push(record);
  }
  return records;
}
