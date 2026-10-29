/** Reading line geometry out of GeoPackage blobs. */
import { describe, expect, it } from "vite-plus/test";

import { parseGeoPackageLines, parseGeoPackagePolygons } from "./geopackage.ts";

/** A GeoPackage blob of a MultiLineString with an envelope. */
function multi(lines: number[][][]): Uint8Array {
  const size = 8 + 32 + 9 + lines.reduce((sum, line) => sum + 9 + line.length * 16, 0);
  const bytes = new Uint8Array(size);
  const view = new DataView(bytes.buffer);
  bytes.set([0x47, 0x50, 0, 0b11]);
  let at = 40;
  view.setUint8(at, 1);
  view.setUint32(at + 1, 5, true);
  view.setUint32(at + 5, lines.length, true);
  at += 9;
  for (const line of lines) {
    view.setUint8(at, 1);
    view.setUint32(at + 1, 2, true);
    view.setUint32(at + 5, line.length, true);
    at += 9;
    for (const [x, y] of line) {
      view.setFloat64(at, x!, true);
      view.setFloat64(at + 8, y!, true);
      at += 16;
    }
  }
  return bytes;
}

describe("parseGeoPackageLines", () => {
  it("reads every line of a MultiLineString", () => {
    expect(
      parseGeoPackageLines(
        multi([
          [
            [0, 0],
            [1, 1],
          ],
          [
            [5, 5],
            [6, 5],
            [7, 5],
          ],
        ]),
      ),
    ).toEqual([
      [
        [0, 0],
        [1, 1],
      ],
      [
        [5, 5],
        [6, 5],
        [7, 5],
      ],
    ]);
  });
});

/** A GeoPackage blob of a MultiPolygon without an envelope. */
function multiPolygon(polygons: number[][][][]): Uint8Array {
  const size =
    8 +
    9 +
    polygons.reduce(
      (sum, rings) => sum + 9 + rings.reduce((inner, ring) => inner + 4 + ring.length * 16, 0),
      0,
    );
  const bytes = new Uint8Array(size);
  const view = new DataView(bytes.buffer);
  bytes.set([0x47, 0x50, 0, 0b1]);
  let at = 8;
  view.setUint8(at, 1);
  view.setUint32(at + 1, 6, true);
  view.setUint32(at + 5, polygons.length, true);
  at += 9;
  for (const rings of polygons) {
    view.setUint8(at, 1);
    view.setUint32(at + 1, 3, true);
    view.setUint32(at + 5, rings.length, true);
    at += 9;
    for (const ring of rings) {
      view.setUint32(at, ring.length, true);
      at += 4;
      for (const [x, y] of ring) {
        view.setFloat64(at, x!, true);
        view.setFloat64(at + 8, y!, true);
        at += 16;
      }
    }
  }
  return bytes;
}

describe("parseGeoPackagePolygons", () => {
  it("reads every polygon of a MultiPolygon, its shore and its islands", () => {
    const shore = [
      [0, 0],
      [4, 0],
      [4, 4],
      [0, 0],
    ];
    const island = [
      [1, 1],
      [2, 1],
      [2, 2],
      [1, 1],
    ];
    const pond = [
      [9, 9],
      [10, 9],
      [10, 10],
      [9, 9],
    ];
    expect(parseGeoPackagePolygons(multiPolygon([[shore, island], [pond]]))).toEqual([
      [shore, island],
      [pond],
    ]);
  });

  it("refuses lines", () => {
    const blob = multiPolygon([]);
    new DataView(blob.buffer).setUint32(9, 5, true);
    expect(() => parseGeoPackagePolygons(blob)).toThrow(/not a \(Multi\)Polygon/);
  });
});
