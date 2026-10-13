/** The terrain pipeline, piece by piece, on grids small enough to read. */
import { describe, expect, it } from "vitest";

import {
  GridAccumulator,
  generaliseRings,
  growOutwards,
  isoRings,
  lambertToGeographic,
  parseAsciiGrid,
  smooth,
  type ElevationGrid,
} from "./terrain.ts";

const grid = (rows: number[][]): ElevationGrid => ({
  columns: rows[0]?.length ?? 0,
  rows: rows.length,
  values: Float64Array.from(rows.flat()),
});
const N = Number.NaN;

describe("parseAsciiGrid", () => {
  const tile = [
    "ncols        3",
    "nrows        2",
    "xllcorner    99750.000000000000",
    "yllcorner    299750.000000000000",
    "cellsize     500.000000000000",
    "NODATA_value      0",
    " 0 1958.995 1862.815",
    " 400 0 612.5",
    "",
  ].join("\r\n");

  it("reads the header and the values, top row first", () => {
    const parsed = parseAsciiGrid(tile);
    expect(parsed).toMatchObject({
      columns: 3,
      rows: 2,
      left: 99750,
      bottom: 299750,
      cellSize: 500,
      noData: 0,
    });
    expect([...parsed.values]).toEqual([0, 1958.995, 1862.815, 400, 0, 612.5]);
  });

  it("refuses a tile whose body does not match its header", () => {
    expect(() => parseAsciiGrid(tile.replace(" 400 0 612.5", " 400 0"))).toThrow(/5 values/);
    expect(() => parseAsciiGrid("nrows 2\n1 2")).toThrow(/ncols/);
  });
});

describe("lambertToGeographic", () => {
  it("maps the grid's false origin to 47°30' N, 13°20' E", () => {
    const [latitude, longitude] = lambertToGeographic(400000, 400000);
    expect(latitude).toBeCloseTo(47.5, 6);
    expect(longitude).toBeCloseTo(13 + 1 / 3, 6);
  });

  it("puts north up and east right, at the scale of a metre", () => {
    const [latitude, longitude] = lambertToGeographic(400000, 500000);
    expect(longitude).toBeCloseTo(13 + 1 / 3, 6);
    // 100 km north is 0.9 degrees of latitude on the Bessel ellipsoid.
    expect(latitude - 47.5).toBeCloseTo(0.8993, 3);
    expect(lambertToGeographic(500000, 400000)[1]).toBeGreaterThan(14.6);
  });
});

describe("GridAccumulator", () => {
  it("averages the samples of a cell and leaves untouched cells empty", () => {
    const accumulator = new GridAccumulator(2, 2, 4);
    accumulator.add(1, 1, 100);
    accumulator.add(3, 2, 300);
    accumulator.add(5, 7, 50);
    accumulator.add(-1, 0, 999);
    accumulator.add(8, 0, 999);
    const { values } = accumulator.toGrid();
    expect(values[0]).toBe(200);
    expect(values[1]).toBeNaN();
    expect(values[3]).toBe(50);
  });
});

describe("growOutwards", () => {
  it("fills empty neighbours with the mean of what is next to them", () => {
    const grown = growOutwards(grid([[100, N, N, N]]), 1);
    expect(grown.values[1]).toBe(100);
    expect(grown.values[2]).toBeNaN();
    expect(growOutwards(grid([[100, N, N, N]]), 3).values[3]).toBe(100);
  });
});

describe("smooth", () => {
  it("keeps a flat surface flat and empty cells empty", () => {
    const flat = smooth(grid([[5, 5, 5, N]]), 1.5);
    for (const value of flat.values.slice(0, 3)) expect(value).toBeCloseTo(5, 9);
    expect(flat.values[3]).toBeNaN();
  });

  it("spreads a single peak without changing the total much", () => {
    const peak = smooth(grid([[0, 0, 0], [0, 90, 0], [0, 0, 0]]), 1);
    expect(peak.values[4]).toBeLessThan(90);
    expect(peak.values[0]).toBeGreaterThan(0);
  });
});

describe("isoRings", () => {
  it("draws one ring around a single high cell, half-way to its neighbours", () => {
    const rings = isoRings(grid([[0, 0, 0], [0, 100, 0], [0, 0, 0]]), 50, 10);
    expect(rings).toHaveLength(1);
    const xs = rings[0]?.map(([x]) => x) ?? [];
    const ys = rings[0]?.map(([, y]) => y) ?? [];
    expect(Math.min(...xs)).toBe(10);
    expect(Math.max(...xs)).toBe(20);
    expect(Math.min(...ys)).toBe(10);
    expect(Math.max(...ys)).toBe(20);
  });

  it("places the outline where the height crosses the level", () => {
    // 0 at x = 5, 100 at x = 15: the 25 m line is a quarter of the way.
    const rings = isoRings(grid([[0, 100], [0, 100]]), 25, 10);
    const crossing = rings[0]?.find(([x, y]) => x < 15 && y === 5);
    expect(crossing?.[0]).toBeCloseTo(7.5, 6);
  });

  it("closes outlines that run into the edge of the data", () => {
    const rings = isoRings(grid([[100, 100], [100, N]]), 50, 10);
    expect(rings).toHaveLength(1);
    expect(rings[0]?.length).toBeGreaterThanOrEqual(4);
  });

  it("draws a basin as a ring inside the ring around it", () => {
    const high = Array.from({ length: 5 }, () => [100, 100, 100, 100, 100]);
    (high[2] as number[])[2] = 0;
    expect(isoRings(grid(high), 50, 10)).toHaveLength(2);
  });

  it("joins two diagonal peaks only when the saddle between them is high", () => {
    expect(isoRings(grid([[100, 0], [0, 100]]), 40, 10)).toHaveLength(1);
    expect(isoRings(grid([[100, 0], [0, 100]]), 60, 10)).toHaveLength(2);
  });

  it("finds nothing above the highest ground", () => {
    expect(isoRings(grid([[1, 2], [3, 4]]), 10, 10)).toEqual([]);
  });
});

describe("generaliseRings", () => {
  const square = [
    [0, 0],
    [5, 0.1],
    [10, 0],
    [10, 10],
    [0, 10],
  ] as Array<readonly [number, number]>;

  it("drops points that barely leave the line and keeps the corners", () => {
    const [ring] = generaliseRings([square], 0.5, 1);
    expect(ring).toHaveLength(4);
    expect(generaliseRings([square], 0.05, 1)[0]).toHaveLength(5);
  });

  it("drops patches too small to see", () => {
    expect(generaliseRings([square], 0.5, 200)).toEqual([]);
  });
});
