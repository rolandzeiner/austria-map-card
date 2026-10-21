/** Reading a shapefile and merging its polygons, on files built by hand. */
import { describe, expect, it } from "vite-plus/test";

import { parseDbf, parseShapefilePolygons } from "./shapefile.ts";

/** A .shp file holding the given polygon records. */
function shp(records: number[][][][]): Uint8Array {
  const bodies = records.map((rings) => {
    const points = rings.flat();
    const body = new Uint8Array(44 + rings.length * 4 + points.length * 16);
    const view = new DataView(body.buffer);
    view.setInt32(0, 5, true);
    view.setInt32(36, rings.length, true);
    view.setInt32(40, points.length, true);
    let start = 0;
    rings.forEach((ring, index) => {
      view.setInt32(44 + index * 4, start, true);
      start += ring.length;
    });
    points.forEach(([x, y], index) => {
      view.setFloat64(44 + rings.length * 4 + index * 16, x as number, true);
      view.setFloat64(44 + rings.length * 4 + index * 16 + 8, y as number, true);
    });
    return body;
  });
  const file = new Uint8Array(100 + bodies.reduce((sum, body) => sum + 8 + body.length, 0));
  const view = new DataView(file.buffer);
  view.setInt32(0, 9994, false);
  let offset = 100;
  bodies.forEach((body, index) => {
    view.setInt32(offset, index + 1, false);
    view.setInt32(offset + 4, body.length / 2, false);
    file.set(body, offset + 8);
    offset += 8 + body.length;
  });
  return file;
}

/** A .dbf file with character fields of the given widths. */
function dbf(fields: Array<[string, number]>, rows: string[][]): Uint8Array {
  const headerBytes = 32 + fields.length * 32 + 1;
  const recordBytes = 1 + fields.reduce((sum, [, width]) => sum + width, 0);
  const file = new Uint8Array(headerBytes + rows.length * recordBytes).fill(0x20);
  const view = new DataView(file.buffer);
  file.fill(0, 0, headerBytes);
  view.setUint32(4, rows.length, true);
  view.setUint16(8, headerBytes, true);
  view.setUint16(10, recordBytes, true);
  const encoder = new TextEncoder();
  fields.forEach(([name, width], index) => {
    file.set(encoder.encode(name), 32 + index * 32);
    file[32 + index * 32 + 11] = 0x43;
    file[32 + index * 32 + 16] = width;
  });
  file[headerBytes - 1] = 0x0d;
  rows.forEach((row, rowIndex) => {
    let at = headerBytes + rowIndex * recordBytes + 1;
    row.forEach((value, index) => {
      file.set(encoder.encode(value), at);
      at += (fields[index] as [string, number])[1];
    });
  });
  return file;
}

// Clockwise, as shapefiles wind their shells.
type Ring = Array<[number, number]>;

const square = (x: number, y: number, size = 1): Ring => [
  [x, y],
  [x, y + size],
  [x + size, y + size],
  [x + size, y],
  [x, y],
];

describe("parseShapefilePolygons", () => {
  it("reads every record's rings in file order", () => {
    const shapes = parseShapefilePolygons(shp([[square(0, 0)], [square(5, 5), square(8, 8)]]));
    expect(shapes).toHaveLength(2);
    expect(shapes[0]).toEqual([square(0, 0)]);
    expect(shapes[1]).toHaveLength(2);
    expect(shapes[1]?.[1]?.[2]).toEqual([9, 9]);
  });

  it("refuses a file that is not a polygon shapefile", () => {
    expect(() => parseShapefilePolygons(new Uint8Array(120))).toThrow(/not a shapefile/);
    const points = shp([[square(0, 0)]]);
    new DataView(points.buffer).setInt32(108, 1, true);
    expect(() => parseShapefilePolygons(points)).toThrow(/not a polygon/);
  });
});

describe("parseDbf", () => {
  it("reads trimmed text fields, umlauts included", () => {
    const records = parseDbf(
      dbf(
        [
          ["BL_KZ", 1],
          ["BL", 20],
        ],
        [
          ["3", "Niederösterreich"],
          ["9", "Wien"],
        ],
      ),
    );
    expect(records).toEqual([
      { BL_KZ: "3", BL: "Niederösterreich" },
      { BL_KZ: "9", BL: "Wien" },
    ]);
  });
});
