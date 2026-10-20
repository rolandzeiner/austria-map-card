import { describe, expect, it } from "vitest";

import { toMap, zoomOf, type Camera } from "../src/map/camera.ts";
import {
  DOUBLE_TAP_MS,
  KEY_PAN,
  KEY_TILT,
  KEY_TURN,
  MapGesture,
  TILT_RATE,
  TURN_RATE,
  ZOOM_STEP,
  keyCommand,
  wheelFactor,
  type Pose,
} from "../src/map/gestures.ts";
import { FLAT } from "../src/map/view3d.ts";

const size = { width: 500, height: 265 };
const zoomed: Camera = { x: 500, y: 265, k: 4 };

describe("one pointer", () => {
  it("drags the map with it", () => {
    const gesture = new MapGesture();
    gesture.down(1, 100, 100);
    let camera = gesture.move(1, 110, 100, zoomed, size) as Camera;
    camera = gesture.move(1, 140, 120, camera, size) as Camera;
    // 40 px right and 20 px down at 4 px per unit.
    expect(camera.x).toBeCloseTo(490);
    expect(camera.y).toBeCloseTo(260);
    expect(gesture.up(1, false, 0)).toBe("none");
  });

  it("is a tap when it barely moves", () => {
    const gesture = new MapGesture();
    gesture.down(1, 100, 100);
    expect(gesture.move(1, 102, 101, zoomed, size)).toEqual(zoomed);
    expect(gesture.up(1, false, 1000)).toBe("tap");
  });

  it("is no tap when it was cancelled, so a press can be abandoned", () => {
    const gesture = new MapGesture();
    gesture.down(1, 100, 100);
    expect(gesture.up(1, true, 1000)).toBe("none");
  });

  it("ignores a pointer it never saw go down", () => {
    const gesture = new MapGesture();
    expect(gesture.move(7, 10, 10, zoomed, size)).toBeNull();
    expect(gesture.up(7, false, 0)).toBe("none");
  });
});

describe("double tap", () => {
  const tap = (gesture: MapGesture, x: number, y: number, time: number) => {
    gesture.down(1, x, y);
    return gesture.up(1, false, time);
  };

  it("is two taps close together in time and place", () => {
    const gesture = new MapGesture();
    expect(tap(gesture, 100, 100, 1000)).toBe("tap");
    expect(tap(gesture, 104, 98, 1000 + DOUBLE_TAP_MS - 20)).toBe("double-tap");
  });

  it("is not two taps far apart in time or in place", () => {
    const slow = new MapGesture();
    tap(slow, 100, 100, 1000);
    expect(tap(slow, 100, 100, 1000 + DOUBLE_TAP_MS + 50)).toBe("tap");
    const apart = new MapGesture();
    tap(apart, 100, 100, 1000);
    expect(tap(apart, 300, 100, 1100)).toBe("tap");
  });

  it("does not chain: a third tap starts over", () => {
    const gesture = new MapGesture();
    tap(gesture, 100, 100, 1000);
    tap(gesture, 100, 100, 1100);
    expect(tap(gesture, 100, 100, 1200)).toBe("tap");
  });
});

describe("two pointers", () => {
  it("zoom about the point between the fingers, which stays under them", () => {
    const gesture = new MapGesture();
    gesture.down(1, 200, 100);
    gesture.down(2, 300, 100);
    const under = toMap(zoomed, size, 250, 100);
    let camera = gesture.move(1, 150, 100, zoomed, size) as Camera;
    camera = gesture.move(2, 350, 100, camera, size) as Camera;
    expect(camera.k).toBeCloseTo(8);
    const after = toMap(camera, size, 250, 100);
    expect(after[0]).toBeCloseTo(under[0], 4);
    expect(after[1]).toBeCloseTo(under[1], 4);
  });

  it("drag the map while they pinch", () => {
    const gesture = new MapGesture();
    gesture.down(1, 200, 100);
    gesture.down(2, 300, 100);
    let camera = gesture.move(1, 200, 140, zoomed, size) as Camera;
    camera = gesture.move(2, 300, 140, camera, size) as Camera;
    expect(camera.k).toBeCloseTo(4, 1);
    expect(camera.y).toBeLessThan(zoomed.y - 8);
  });

  it("never end in a tap", () => {
    const gesture = new MapGesture();
    gesture.down(1, 200, 100);
    gesture.down(2, 300, 100);
    expect(gesture.up(2, false, 0)).toBe("none");
    expect(gesture.up(1, false, 0)).toBe("none");
    expect(gesture.active).toBe(false);
  });
});

describe("keyboard", () => {
  it("moves the view with the arrows", () => {
    expect(keyCommand("ArrowLeft")).toEqual({ kind: "pan", dx: KEY_PAN, dy: 0 });
    expect(keyCommand("ArrowDown")).toEqual({ kind: "pan", dx: 0, dy: -KEY_PAN });
  });

  it("zooms with plus and minus, resets with 0, reads out with Enter", () => {
    expect(keyCommand("+")).toEqual({ kind: "zoom", factor: ZOOM_STEP });
    expect(keyCommand("=")).toEqual({ kind: "zoom", factor: ZOOM_STEP });
    expect(keyCommand("-")).toEqual({ kind: "zoom", factor: 1 / ZOOM_STEP });
    expect(keyCommand("0")).toEqual({ kind: "reset" });
    expect(keyCommand("Enter")).toEqual({ kind: "identify" });
  });

  it("leaves every other key to the page, Tab above all", () => {
    for (const key of ["Tab", "Escape", "a", " ", "PageDown"]) expect(keyCommand(key)).toBeNull();
  });
});

describe("the wheel", () => {
  it("zooms in on the way up and out on the way down, by the same factor", () => {
    expect(wheelFactor(-100)).toBeGreaterThan(1);
    expect(wheelFactor(100) * wheelFactor(-100)).toBeCloseTo(1);
  });

  it("caps one event, however large its delta", () => {
    expect(wheelFactor(-5000)).toBe(wheelFactor(-120));
    expect(zoomOf({ x: 0, y: 0, k: wheelFactor(-5000) }, { width: 1000, height: 530 })).toBeLessThan(2);
  });
});

describe("tilting and turning", () => {
  const size = { width: 760, height: 403 };
  const camera = { x: 500, y: 265, k: 0.76 * 4 };
  const flat: Pose = { camera, orientation: FLAT };

  it("moves the map with one finger, as the flat gesture does", () => {
    const gesture = new MapGesture();
    gesture.down(1, 100, 100);
    const pose = gesture.movePose(1, 140, 120, flat, size, false)!;
    expect(pose.orientation).toBe(FLAT);
    expect(pose.camera.x).toBeLessThan(camera.x);
  });

  it("tilts by dragging up and turns by dragging sideways, with Shift or the right button", () => {
    const gesture = new MapGesture();
    gesture.down(1, 100, 200);
    const tilted = gesture.movePose(1, 100, 150, flat, size, true)!;
    expect(tilted.orientation.pitch).toBeCloseTo(50 * TILT_RATE);
    expect(tilted.camera).toBe(camera);
    const turned = gesture.movePose(1, 140, 150, tilted, size, true)!;
    expect(turned.orientation.bearing).toBeCloseTo(-40 * TURN_RATE);
  });

  it("tilts when two fingers slide up side by side", () => {
    const gesture = new MapGesture();
    gesture.down(1, 300, 300);
    gesture.down(2, 400, 300);
    let pose = flat;
    for (let step = 1; step <= 6; step += 1) {
      pose = gesture.movePose(1, 300, 300 - step * 5, pose, size, false)!;
      pose = gesture.movePose(2, 400, 300 - step * 5, pose, size, false)!;
    }
    expect(pose.orientation.pitch).toBeGreaterThan(0.1);
    expect(pose.orientation.bearing).toBe(0);
    expect(pose.camera.k).toBe(camera.k);
  });

  it("pinches without turning until the fingers have twisted far enough", () => {
    const gesture = new MapGesture();
    gesture.down(1, 300, 200);
    gesture.down(2, 400, 200);
    // Spread apart with a slight twist: zoom only.
    let pose = gesture.movePose(2, 440, 210, flat, size, false)!;
    pose = gesture.movePose(2, 460, 212, pose, size, false)!;
    expect(pose.orientation).toEqual(FLAT);
    expect(pose.camera.k).toBeGreaterThan(camera.k);
    // A real twist turns the map.
    pose = gesture.movePose(2, 400, 330, pose, size, false)!;
    expect(Math.abs(pose.orientation.bearing)).toBeGreaterThan(0.21);
    expect(pose.orientation.pitch).toBe(0);
  });

  it("offers Shift and the arrows to tilt and turn, but only where the map can tilt", () => {
    expect(keyCommand("ArrowUp", true, true)).toEqual({ kind: "orient", pitch: KEY_TILT, bearing: 0 });
    expect(keyCommand("ArrowRight", true, true)).toEqual({ kind: "orient", pitch: 0, bearing: -KEY_TURN });
    expect(keyCommand("ArrowUp", true, false)).toEqual({ kind: "pan", dx: 0, dy: KEY_PAN });
    // "+" takes Shift on many keyboards and still zooms.
    expect(keyCommand("+", true, true)).toEqual({ kind: "zoom", factor: ZOOM_STEP });
  });
});
