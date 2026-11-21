/**
 * The reference grid: which cells there are, and what of them a frame draws.
 */
import { describe, expect, it } from "vite-plus/test";

import { fitScale, homeCamera, visibleBox, type Camera } from "../src/map/camera.ts";
import {
  GRID_CELL,
  GRID_COLUMNS,
  GRID_LEFT,
  GRID_ROWS,
  RULER,
  columnName,
  drawGrid,
  drawRuler,
  gridLines,
  rowName,
  rulerInset,
} from "../src/map/grid.ts";
import { LIGHT_THEME } from "../src/map/palette.ts";
import { MAP_HEIGHT, MAP_WIDTH } from "../src/map/projection.ts";
import { paletteFor } from "../src/map/themes.ts";
import { storeWith } from "./chunks.ts";
import { fakeContext } from "./fake-canvas.ts";

const style = paletteFor("leonida", LIGHT_THEME).grid!;
const size = { width: 760, height: 403 };
const home = homeCamera(size);

describe("the cells", () => {
  it("are square, ten by five, and hold the whole country", () => {
    const right = GRID_LEFT + GRID_COLUMNS * GRID_CELL;
    const bottom = GRID_ROWS * GRID_CELL;
    for (const ring of storeWith().overview!.country) {
      for (let at = 0; at < ring.length; at += 2) {
        expect(ring[at]).toBeGreaterThanOrEqual(GRID_LEFT);
        expect(ring[at]).toBeLessThanOrEqual(right);
        expect(ring[at + 1]).toBeGreaterThanOrEqual(0);
        expect(ring[at + 1]).toBeLessThanOrEqual(bottom);
      }
    }
    expect(bottom).toBe(MAP_HEIGHT);
    expect(GRID_LEFT + right).toBeCloseTo(MAP_WIDTH);
  });

  it("are numbered west to east and lettered north to south, and nameless out at sea", () => {
    expect([0, 1, 9].map(columnName)).toEqual(["1", "2", "10"]);
    expect([0, 1, 4].map(rowName)).toEqual(["A", "B", "E"]);
    expect([columnName(-1), columnName(10), rowName(-1), rowName(5)]).toEqual(["", "", "", ""]);
  });

  it("are a frame of eleven lines down and six across for the tilted map", () => {
    const lines = gridLines();
    expect(lines.count).toBe(GRID_COLUMNS + 1 + GRID_ROWS + 1);
    expect(lines.closed).toBe(false);
    expect(Array.from(lines.xy.slice(0, 4))).toEqual([GRID_LEFT, 0, GRID_LEFT, MAP_HEIGHT]);
    expect(lines.start.at(-1)).toBe(lines.count * 2);
  });
});

describe("a frame", () => {
  it("strokes only the lines in view, each on a whole pixel", () => {
    const fake = fakeContext();
    drawGrid(fake.ctx, home, size, visibleBox(home, size), style);
    // The nine lines between the ten columns: columns 1 and 10 run off the
    // canvas. The rows show their top, their bottom and the four between.
    const vertical = fake.named("moveTo").filter((call) => call.args[1] === 0);
    const horizontal = fake.named("moveTo").filter((call) => call.args[0] === 0);
    expect(vertical).toHaveLength(9);
    expect(horizontal).toHaveLength(6);
    for (const call of vertical) expect((call.args[0] as number) % 1).toBe(0.5);
    expect(fake.named("stroke")).toHaveLength(1);

    const near: Camera = { x: 500, y: 265, k: fitScale(size) * 20 };
    const zoomed = fakeContext();
    drawGrid(zoomed.ctx, near, size, visibleBox(near, size), style);
    expect(zoomed.named("moveTo").length).toBeLessThan(3);
  });

  it("names the cells along the bottom and the right edge, where no button sits", () => {
    const fake = fakeContext();
    drawRuler(fake.ctx, home, size, visibleBox(home, size), style, "sans-serif");
    expect(fake.texts()).toEqual("1 2 3 4 5 6 7 8 9 10 A B C D E".split(" "));
    const strips = fake.named("fillRect");
    expect(strips.map((call) => call.args)).toEqual([
      [0, size.height - RULER, size.width, RULER],
      [size.width - RULER, 0, RULER, size.height - RULER],
    ]);
    const numbers = fake.named("fillText").slice(0, 10);
    for (const call of numbers) expect(call.args[2]).toBeGreaterThan(size.height - RULER);
  });

  it("names a cell on the part of it that is in view, and no sliver", () => {
    // Cell C5, far in: one number and one letter, each in the middle of its strip.
    const camera: Camera = {
      x: GRID_LEFT + 4.5 * GRID_CELL,
      y: 2.5 * GRID_CELL,
      k: fitScale(size) * 12,
    };
    const fake = fakeContext();
    drawRuler(fake.ctx, camera, size, visibleBox(camera, size), style, "sans-serif");
    expect(fake.texts()).toEqual(["5", "C"]);
    const [number, letter] = fake.named("fillText");
    expect(number!.args[1]).toBeCloseTo((size.width - RULER) / 2);
    expect(letter!.args[2]).toBeCloseTo((size.height - RULER) / 2 + 0.5);
  });

  it("keeps the names on the map clear of the strips", () => {
    expect(rulerInset(size)).toEqual({
      x: 0,
      y: 0,
      w: size.width - RULER,
      h: size.height - RULER,
    });
  });
});
