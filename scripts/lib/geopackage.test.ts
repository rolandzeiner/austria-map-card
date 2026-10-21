/** Reading line geometry out of GeoPackage blobs. */
import { describe, expect, it } from "vite-plus/test";

import { parseGeoPackageLines } from "./geopackage.ts";

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
