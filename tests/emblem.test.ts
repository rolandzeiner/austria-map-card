/**
 * The federal eagle in a theme's sea: its path data, and where it stands.
 */
import { describe, expect, it } from "vite-plus/test";

import { EMBLEM, EMBLEM_NAME, drawEmblem, tracePath } from "../src/map/emblem.ts";
import {
  EAGLE_BODY,
  EAGLE_GOLD,
  EAGLE_HEIGHT,
  EAGLE_RED,
  EAGLE_WIDTH,
} from "../src/map/emblem-data.ts";
import { GRID_LEFT } from "../src/map/grid.ts";
import { LIGHT_THEME } from "../src/map/palette.ts";
import { paletteFor } from "../src/map/themes.ts";
import { ShapeCache } from "../src/map/tiles.ts";
import { storeWith } from "./chunks.ts";
import { fakeContext, fakePath } from "./fake-canvas.ts";

/** A path that keeps the points it is given. */
function recorder(): { path: Path2D; ops: string[]; points: Array<[number, number]> } {
  const ops: string[] = [];
  const points: Array<[number, number]> = [];
  const path = {
    moveTo: (x: number, y: number) => (ops.push("M"), points.push([x, y])),
    lineTo: (x: number, y: number) => (ops.push("L"), points.push([x, y])),
    bezierCurveTo: (...n: number[]) => (
      ops.push("C"),
      points.push([n[0]!, n[1]!], [n[2]!, n[3]!], [n[4]!, n[5]!])
    ),
  } as unknown as Path2D;
  return { path, ops, points };
}

describe("path data", () => {
  it("draws curves and lines relative to the point before, ring after ring", () => {
    const { path, ops, points } = recorder();
    tracePath(path, "M10 20l5-5c1 2 3 4 5 6M0 0l1 1");
    expect(ops.join("")).toBe("MLCML");
    expect(points).toEqual([
      [10, 20],
      [15, 15],
      [16, 17],
      [18, 19],
      [20, 21],
      [0, 0],
      [1, 1],
    ]);
  });

  it("holds the eagle as three shapes that stay on their grid", () => {
    for (const data of [EAGLE_BODY, EAGLE_GOLD, EAGLE_RED]) {
      expect(data).toMatch(/^M[\dMcl -]+$/);
      const { path, ops, points } = recorder();
      tracePath(path, data);
      expect(ops[0]).toBe("M");
      for (const [x, y] of points) {
        expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true);
        expect(x).toBeGreaterThanOrEqual(-12);
        expect(x).toBeLessThanOrEqual(EAGLE_WIDTH + 12);
        expect(y).toBeGreaterThanOrEqual(-12);
        expect(y).toBeLessThanOrEqual(EAGLE_HEIGHT + 12);
      }
    }
    // Most of the drawing is the eagle; the shield's red is two bars and a tongue.
    expect(EAGLE_BODY.length).toBeGreaterThan(EAGLE_GOLD.length);
    expect(EAGLE_GOLD.length).toBeGreaterThan(EAGLE_RED.length);
  });
});

describe("where it stands", () => {
  const leonida = paletteFor("leonida", LIGHT_THEME);
  const half = (EMBLEM.height * EAGLE_WIDTH) / EAGLE_HEIGHT / 2;
  // The eagle and the name under it, with the name's letters and spacing allowed for.
  const box = {
    left: EMBLEM.centre - Math.max(half, 100),
    right: EMBLEM.centre + Math.max(half, 100),
    top: EMBLEM.top,
    bottom: EMBLEM.nameAt + EMBLEM.nameSize / 2,
  };

  it("lies in open sea: clear of the coast and of its shallows", () => {
    const reach = Math.max(...leonida.sea!.shelf.map((band) => band.reach));
    for (const ring of storeWith().overview!.country) {
      for (let at = 0; at < ring.length; at += 2) {
        const x = ring[at]!;
        const y = ring[at + 1]!;
        const outside =
          x < box.left - reach ||
          x > box.right + reach ||
          y < box.top - reach ||
          y > box.bottom + reach;
        expect(outside, `coast at ${x}, ${y}`).toBe(true);
      }
    }
  });

  it("stays inside the named cells of the grid, below where the card's buttons reach", () => {
    expect(box.left).toBeGreaterThan(GRID_LEFT);
    // The buttons' row ends 48 px down; on a card 760 px wide that is 63 map units.
    expect(box.top).toBeGreaterThan(63);
  });

  it("is drawn as the eagle's three shapes and the country's name", () => {
    const fake = fakeContext();
    drawEmblem(fake.ctx, new ShapeCache(fakePath), leonida.emblem!, "sans-serif");
    expect(fake.named("fill").map((call) => call.fillStyle)).toEqual([
      leonida.emblem!.body,
      leonida.emblem!.gold,
      leonida.emblem!.red,
    ]);
    expect(fake.texts()).toEqual([EMBLEM_NAME]);
    expect(fake.named("fillText")[0]!.args[2]).toBe(EMBLEM.nameAt);
    expect(fake.named("save")).toHaveLength(fake.named("restore").length);
  });
});
