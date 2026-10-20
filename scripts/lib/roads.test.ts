/** Reading motorway pieces and joining them into routes. */
import { describe, expect, it } from "vitest";

import { joinPieces, lengthOf, parseGeoPackageLines, routeLength } from "./roads.ts";

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
    expect(parseGeoPackageLines(multi([[[0, 0], [1, 1]], [[5, 5], [6, 5], [7, 5]]]))).toEqual([
      [[0, 0], [1, 1]],
      [[5, 5], [6, 5], [7, 5]],
    ]);
  });
});

describe("joinPieces", () => {
  it("joins pieces that meet end to end, whichever way round they run", () => {
    const joined = joinPieces([
      [[1, 0], [2, 0]],
      [[0, 0], [1, 0]],
      [[3, 0], [2, 0]],
    ]);
    expect(joined).toHaveLength(1);
    expect(lengthOf(joined[0]!)).toBeCloseTo(3);
    expect(joined[0]![0]![0] === 0 || joined[0]![0]![0] === 3).toBe(true);
  });

  it("stops at a fork", () => {
    const joined = joinPieces([
      [[0, 0], [1, 0]],
      [[1, 0], [2, 0]],
      [[1, 0], [1, 1]],
    ]);
    expect(joined).toHaveLength(3);
  });
});

describe("routeLength", () => {
  it("counts a motorway's two carriageways once", () => {
    const east: Array<[number, number]> = [[0, 0], [1000, 0]];
    const west: Array<[number, number]> = [[1000, 30], [0, 30]];
    expect(routeLength([east, west], 80)).toBe(1000);
  });

  it("counts a single carriageway, and one too far from the other, in full", () => {
    expect(routeLength([[[0, 0], [1000, 0]]], 80)).toBe(1000);
    expect(routeLength([[[0, 0], [1000, 0]], [[0, 200], [1000, 200]]], 80)).toBe(2000);
  });

  it("halves only where the second carriageway runs alongside", () => {
    // Two tubes of a tunnel merge into one for the last 500 m.
    expect(routeLength([[[0, 0], [1000, 0], [1500, 0]], [[1000, 30], [0, 30]]], 80)).toBe(1500);
  });

  it("does not take the legs of a hairpin for a second carriageway", () => {
    const hairpin: Array<[number, number]> = [[0, 0], [500, 0], [520, 20], [500, 40], [0, 40]];
    expect(routeLength([hairpin], 80)).toBeCloseTo(lengthOf(hairpin));
  });
});
