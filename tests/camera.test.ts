import { describe, expect, it } from "vitest";

import {
  MAX_ZOOM,
  boxesTouch,
  clampCamera,
  fitBox,
  fitScale,
  homeCamera,
  panBy,
  resizeCamera,
  toMap,
  toScreen,
  visibleBox,
  zoomAbout,
  zoomOf,
} from "../src/map/camera.ts";
import { MAP_HEIGHT, MAP_WIDTH } from "../src/map/projection.ts";

const size = { width: 500, height: 265 };

describe("fitting", () => {
  it("fits the whole map into the canvas, whichever side is the tighter one", () => {
    expect(fitScale(size)).toBeCloseTo(0.5);
    expect(fitScale({ width: 2000, height: 265 })).toBeCloseTo(0.5);
    expect(fitScale({ width: 500, height: 1000 })).toBeCloseTo(0.5);
  });

  it("starts on the whole country, centred, at zoom 1", () => {
    const home = homeCamera(size);
    expect(home).toEqual({ x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2, k: 0.5 });
    expect(zoomOf(home, size)).toBe(1);
    expect(visibleBox(home, size)).toEqual([0, 0, MAP_WIDTH, MAP_HEIGHT]);
  });

  it("fits a box with padding, centred on it", () => {
    const camera = fitBox([100, 100, 200, 150], size, 20);
    expect(camera.x).toBe(150);
    expect(camera.y).toBe(125);
    // 100 units across 460 px, 50 units across 225 px: the height is tighter.
    expect(camera.k).toBeCloseTo(4.5);
  });

  it("does not zoom past the limit for a tiny box", () => {
    const camera = fitBox([500, 250, 500.5, 250.5], size, 10);
    expect(zoomOf(camera, size)).toBeCloseTo(MAX_ZOOM);
  });
});

describe("pixels and map units", () => {
  const camera = { x: 300, y: 200, k: 4 };

  it("puts the camera's point at the centre of the canvas", () => {
    expect(toScreen(camera, size, 300, 200)).toEqual([250, 132.5]);
  });

  it("converts there and back", () => {
    const [px, py] = toScreen(camera, size, 321.5, 187.25);
    const [x, y] = toMap(camera, size, px, py);
    expect(x).toBeCloseTo(321.5);
    expect(y).toBeCloseTo(187.25);
  });
});

describe("zooming", () => {
  it("keeps the point under the pointer under the pointer", () => {
    let camera = { x: 400, y: 250, k: 2 };
    const pointer: [number, number] = [120, 60];
    const before = toMap(camera, size, ...pointer);
    for (const factor of [1.6, 1.6, 0.7, 3]) {
      camera = zoomAbout(camera, size, ...pointer, factor);
      const after = toMap(camera, size, ...pointer);
      expect(after[0]).toBeCloseTo(before[0], 6);
      expect(after[1]).toBeCloseTo(before[1], 6);
    }
    expect(camera.k).toBeCloseTo(2 * 1.6 * 1.6 * 0.7 * 3);
  });

  it("stops at the whole country on the way out and at 40x on the way in", () => {
    const out = zoomAbout({ x: 400, y: 250, k: 2 }, size, 250, 132, 0.01);
    expect(out).toEqual(homeCamera(size));
    const far = zoomAbout({ x: 400, y: 250, k: 2 }, size, 250, 132, 1000);
    expect(zoomOf(far, size)).toBeCloseTo(MAX_ZOOM);
  });
});

describe("panning", () => {
  it("moves the map with the drag", () => {
    const camera = panBy({ x: 500, y: 265, k: 5 }, size, 50, -25);
    expect(camera.x).toBe(490);
    expect(camera.y).toBe(270);
  });

  it("cannot move the map at all while the whole country is in view", () => {
    expect(panBy(homeCamera(size), size, 300, 300)).toEqual(homeCamera(size));
  });

  it("stops at the map's edge", () => {
    const camera = panBy({ x: 100, y: 60, k: 5 }, size, 100_000, 100_000);
    expect(visibleBox(camera, size)[0]).toBeCloseTo(0);
    expect(visibleBox(camera, size)[1]).toBeCloseTo(0);
    const other = panBy({ x: 100, y: 60, k: 5 }, size, -100_000, -100_000);
    expect(visibleBox(other, size)[2]).toBeCloseTo(MAP_WIDTH);
    expect(visibleBox(other, size)[3]).toBeCloseTo(MAP_HEIGHT);
  });

  it("centres the map along an axis where it is smaller than the canvas", () => {
    const tall = { width: 500, height: 800 };
    const camera = clampCamera({ x: 100, y: 0, k: fitScale(tall) }, tall);
    expect(camera.y).toBe(MAP_HEIGHT / 2);
  });
});

describe("resizing", () => {
  it("keeps the centre and the zoom when the card changes size", () => {
    const before = { x: 620, y: 300, k: fitScale(size) * 8 };
    const wide = { width: 1000, height: 530 };
    const after = resizeCamera(before, size, wide);
    expect(after.x).toBe(620);
    expect(after.y).toBe(300);
    expect(zoomOf(after, wide)).toBeCloseTo(8);
    expect(after.k).toBeCloseTo(before.k * 2);
  });

  it("survives a canvas with no size", () => {
    const camera = clampCamera({ x: 500, y: 265, k: 1 }, { width: 0, height: 0 });
    expect(Number.isFinite(camera.k)).toBe(true);
    expect(Number.isFinite(camera.x)).toBe(true);
  });
});

describe("boxes", () => {
  it("touch when they overlap or share an edge", () => {
    expect(boxesTouch([0, 0, 10, 10], [10, 10, 20, 20])).toBe(true);
    expect(boxesTouch([0, 0, 10, 10], [5, 5, 6, 6])).toBe(true);
    expect(boxesTouch([0, 0, 10, 10], [11, 0, 20, 10])).toBe(false);
    expect(boxesTouch([0, 0, 10, 10], [0, 10.5, 10, 20])).toBe(false);
  });
});
