import { describe, expect, it } from "vitest";

import { toMap, zoomOf, type Camera } from "../src/map/camera.ts";
import { DOUBLE_TAP_MS, KEY_PAN, MapGesture, ZOOM_STEP, keyCommand, wheelFactor } from "../src/map/gestures.ts";

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
