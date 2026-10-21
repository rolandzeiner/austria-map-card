/**
 * The tilted map's arithmetic: that it agrees with the flat map when not
 * tilted, that the WebGL matrix and the names drawn over it agree, and that
 * a tap finds the ground point it was over.
 */
import { describe, expect, it } from "vite-plus/test";

import { fitScale, panBy, toScreen, type Camera } from "../src/map/camera.ts";
import { project } from "../src/map/projection.ts";
import {
  FLAT,
  MAX_PITCH,
  View3D,
  clampTilted,
  exaggeration,
  groundZ,
  isFlat,
  normalBearing,
  orient,
  panTilted,
} from "../src/map/view3d.ts";
import { storeWith } from "./chunks.ts";

const size = { width: 760, height: 403 };
const relief = storeWith("relief").relief!;
const camera: Camera = { x: 330, y: 330, k: fitScale(size) * 3 };
const tilted = { pitch: 1.0, bearing: 0.7 };

describe("orientation", () => {
  it("is flat only with no tilt and north up", () => {
    expect(isFlat(FLAT)).toBe(true);
    expect(isFlat({ pitch: 0, bearing: 2 * Math.PI })).toBe(true);
    expect(isFlat({ pitch: 0.1, bearing: 0 })).toBe(false);
    expect(isFlat({ pitch: 0, bearing: 0.1 })).toBe(false);
  });

  it("keeps the tilt in range and the bearing within a turn", () => {
    expect(orient(FLAT, -1, 0).pitch).toBe(0);
    expect(orient(FLAT, 5, 0).pitch).toBe(MAX_PITCH);
    expect(normalBearing(3 * Math.PI)).toBeCloseTo(Math.PI);
    expect(normalBearing(-1.5 * Math.PI)).toBeCloseTo(0.5 * Math.PI);
  });

  it("stretches the heights less the further in the map is", () => {
    expect(exaggeration(1)).toBe(3);
    expect(exaggeration(3)).toBeLessThan(3);
    expect(exaggeration(40)).toBe(1.6);
  });
});

describe("the 3D view", () => {
  it("shows ground at sea level where the flat map does, when not tilted", () => {
    const view = new View3D(camera, FLAT, size, undefined);
    for (const [x, y] of [
      [330, 330],
      [300, 310],
      [360, 345],
    ] as const) {
      const [px, py] = view.project(x, y, 0)!;
      const [fx, fy] = toScreen(camera, size, x, y);
      expect(px).toBeCloseTo(fx, 3);
      expect(py).toBeCloseTo(fy, 3);
    }
  });

  it("puts the north at the top and turns it away with the bearing", () => {
    const north = new View3D(camera, FLAT, size, relief);
    expect(north.projectGround(relief, camera.x, camera.y - 5)![1]).toBeLessThan(size.height / 2);
    const east = new View3D(camera, { pitch: 0, bearing: Math.PI / 2 }, size, relief);
    // Heading east, the east is at the top and the north on the left.
    expect(east.projectGround(relief, camera.x + 5, camera.y)![1]).toBeLessThan(size.height / 2);
    expect(east.projectGround(relief, camera.x, camera.y - 5)![0]).toBeLessThan(size.width / 2);
  });

  it("keeps the centre of the flat camera in the middle of the canvas", () => {
    const view = new View3D(camera, tilted, size, relief);
    const [px, py] = view.projectGround(relief, camera.x, camera.y)!;
    expect(px).toBeCloseTo(size.width / 2, 3);
    expect(py).toBeCloseTo(size.height / 2, 3);
  });

  it("gives WebGL the same projection the names are placed with", () => {
    const view = new View3D(camera, tilted, size, relief);
    const m = view.matrix();
    const point = [345, 322, 4];
    const clip = [0, 1, 2, 3].map(
      (row) =>
        m[row]! * point[0]! + m[4 + row]! * point[1]! + m[8 + row]! * point[2]! + m[12 + row]!,
    );
    const ndc = clip.map((value) => value / clip[3]!);
    const [px, py] = view.project(point[0]!, point[1]!, point[2]!)!;
    expect(((ndc[0]! + 1) / 2) * size.width).toBeCloseTo(px, 2);
    expect(((1 - ndc[1]!) / 2) * size.height).toBeCloseTo(py, 2);
    expect(Math.abs(ndc[2]!)).toBeLessThan(1);
  });

  it("finds the ground seen at a pixel, over the mountains too", () => {
    const view = new View3D(camera, tilted, size, relief);
    for (const [px, py] of [
      [380, 200],
      [120, 330],
      [600, 90],
      [700, 380],
    ] as const) {
      // A ridge in front hides what is behind it, so the point found is
      // the first ground the ray meets: it is seen at the same pixel.
      const picked = view.pick(px, py, relief)!;
      const back = view.projectGround(relief, picked[0], picked[1])!;
      expect(back[0]).toBeCloseTo(px, 0);
      expect(back[1]).toBeCloseTo(py, 0);
    }
  });

  it("finds a flat map's point where the flat map shows it", () => {
    const view = new View3D(camera, FLAT, size, undefined);
    const picked = view.pick(100, 50, undefined)!;
    expect(toScreen(camera, size, ...picked)[0]).toBeCloseTo(100, 1);
    expect(toScreen(camera, size, ...picked)[1]).toBeCloseTo(50, 1);
  });

  it("finds nothing above the horizon", () => {
    const view = new View3D(camera, { pitch: MAX_PITCH, bearing: 0 }, size, relief);
    expect(view.pick(size.width / 2, 0, relief)).toBeNull();
  });

  it("never puts the camera inside a mountain", () => {
    const deep = { x: camera.x, y: camera.y, k: fitScale(size) * 40 };
    // Low over the Inn valley, looking south into the Stubai Alps.
    const [x, y] = project(47.2692, 11.4041);
    const view = new View3D(
      { ...deep, x, y },
      { pitch: MAX_PITCH, bearing: Math.PI },
      size,
      relief,
    );
    expect(view.eye[2]).toBeGreaterThan(groundZ(relief, view.eye[0], view.eye[1], view.stretch));
  });
});

describe("moving a tilted map", () => {
  it("moves like the flat map when not tilted", () => {
    expect(panTilted(camera, FLAT, size, 30, -20)).toEqual(panBy(camera, size, 30, -20));
  });

  it("moves along the heading when turned", () => {
    const east = { pitch: 0, bearing: Math.PI / 2 };
    // Dragging down pulls the ground ahead (east) towards the viewer.
    const moved = panTilted(camera, east, size, 0, 50);
    expect(moved.x).toBeGreaterThan(camera.x);
    expect(moved.y).toBeCloseTo(camera.y);
  });

  it("keeps the centre on the map and the zoom in range", () => {
    expect(clampTilted({ x: -50, y: 900, k: 1e-9 }, size)).toEqual({
      x: 0,
      y: 530,
      k: fitScale(size),
    });
  });
});
