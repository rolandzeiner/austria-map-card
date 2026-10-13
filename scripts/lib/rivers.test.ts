/** Reading and trimming river lines. */
import { describe, expect, it } from "vitest";

import { parseGeoPackageLine, runsInside, simplifyRiver } from "./rivers.ts";

/** A GeoPackage LineString blob: header, optional envelope, well-known binary. */
function blob(points: number[][], options: { envelope?: boolean; type?: number } = {}): Uint8Array {
  const dimensions = points[0]?.length ?? 2;
  const envelope = options.envelope ? 32 : 0;
  const bytes = new Uint8Array(8 + envelope + 9 + points.length * dimensions * 8);
  const view = new DataView(bytes.buffer);
  bytes.set([0x47, 0x50, 0, options.envelope ? 0b11 : 0b01]);
  view.setInt32(4, 31287, true);
  const start = 8 + envelope;
  view.setUint8(start, 1);
  view.setUint32(start + 1, options.type ?? (dimensions === 3 ? 1002 : 2), true);
  view.setUint32(start + 5, points.length, true);
  points.flat().forEach((value, index) => view.setFloat64(start + 9 + index * 8, value, true));
  return bytes;
}

describe("parseGeoPackageLine", () => {
  it("reads the coordinates behind the header", () => {
    expect(parseGeoPackageLine(blob([[400000, 400000], [400500, 401000]]))).toEqual([
      [400000, 400000],
      [400500, 401000],
    ]);
  });

  it("skips an envelope and a Z value", () => {
    const line = parseGeoPackageLine(blob([[1, 2, 300], [4, 5, 600]], { envelope: true }));
    expect(line).toEqual([
      [1, 2],
      [4, 5],
    ]);
  });

  it("refuses anything that is not a GeoPackage LineString", () => {
    expect(() => parseGeoPackageLine(new Uint8Array(40))).toThrow(/GeoPackage/);
    expect(() => parseGeoPackageLine(blob([[1, 2]], { type: 3 }))).toThrow(/LineString/);
  });
});

describe("runsInside", () => {
  const inside = ([x]: readonly [number, number]): boolean => x >= 3 && x <= 6;
  const line = Array.from({ length: 12 }, (_, x) => [x, 0] as const);

  it("keeps what is inside, with one point of overlap on either side", () => {
    expect(runsInside(line, inside).map((run) => run.map(([x]) => x))).toEqual([
      [2, 3, 4, 5, 6, 7],
    ]);
  });

  it("splits a line that leaves and comes back", () => {
    const twice = ([x]: readonly [number, number]): boolean => x === 1 || x === 9;
    expect(runsInside(line, twice).map((run) => run.map(([x]) => x))).toEqual([
      [0, 1, 2],
      [8, 9, 10],
    ]);
  });

  it("returns nothing for a line that never enters", () => {
    expect(runsInside(line, () => false)).toEqual([]);
  });
});

describe("simplifyRiver", () => {
  it("drops meanders smaller than the tolerance and keeps both ends", () => {
    const meander = [[0, 0], [1, 0.2], [2, -0.2], [3, 0.1], [10, 0], [10, 5]] as const;
    expect(simplifyRiver(meander, 0.5)).toEqual([
      [0, 0],
      [10, 0],
      [10, 5],
    ]);
    expect(simplifyRiver(meander, 0.05)).toHaveLength(6);
  });
});
