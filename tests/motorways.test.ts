/**
 * The motorways: what the data holds, how they are drawn and lettered, and
 * what a tap on one says.
 */
import { describe, expect, it } from "vitest";

import { describeFeature } from "../src/layers/info.ts";
import { motorwayBox, motorwayNear } from "../src/layers/motorways.ts";
import { fitScale, homeCamera, toScreen, type Camera } from "../src/map/camera.ts";
import { LIGHT_THEME, derivePalette } from "../src/map/palette.ts";
import { project } from "../src/map/projection.ts";
import { reliefLines } from "../src/map/relief-lines.ts";
import { MapRenderer, type RenderState } from "../src/map/renderer.ts";
import type { LayerId } from "../src/types.ts";
import { storeWith } from "./chunks.ts";
import { fakeCanvas, fakeContext, fakePath } from "./fake-canvas.ts";

const store = storeWith();
const motorways = store.motorways!;
const palette = derivePalette(LIGHT_THEME);
const size = { width: 760, height: 403 };

function draw(camera: Camera, layers: LayerId[] = ["motorways"]): ReturnType<typeof fakeContext> & { renderer: MapRenderer; state: RenderState } {
  const fake = fakeContext();
  const renderer = new MapRenderer(fakeCanvas(fake), store, fakePath);
  renderer.resize(size.width, size.height, 1);
  renderer.setPalette(palette);
  const state: RenderState = { camera, layers: new Set(layers), showLabels: true, selection: null, here: null };
  renderer.draw(state);
  return { ...fake, renderer, state };
}

describe("the motorway data", () => {
  it("holds the network by route, with the routes' own names", () => {
    expect(motorways.refs).toContain("A1");
    expect(motorways.refs).toContain("S6");
    expect(motorways.names[motorways.refs.indexOf("A1")]).toBe("West Autobahn");
    expect(motorways.names[motorways.refs.indexOf("A23")]).toBe("Autobahn Südosttangente Wien");
    expect(motorways.refs.length).toBeGreaterThan(25);
  });

  it("runs the A1 from Salzburg to the edge of Vienna", () => {
    const box = motorwayBox(store, "A1")!;
    const [salzburg] = project(47.8, 13.04);
    // It ends at Wien-Auhof, on the city's western edge.
    const [wien] = project(48.2, 16.22);
    expect(box[0]).toBeLessThan(salzburg + 5);
    expect(box[2]).toBeGreaterThan(wien - 10);
  });
});

describe("drawing motorways", () => {
  it("strokes the casing, then the amber line", () => {
    const fake = draw(homeCamera(size));
    const strokes = fake.named("stroke").map((call) => call.strokeStyle);
    const casing = strokes.indexOf(palette.motorwayCasing);
    expect(casing).toBeGreaterThanOrEqual(0);
    expect(strokes.indexOf(palette.motorway)).toBeGreaterThan(casing);
  });

  it("letters route shields, a long route twice at most on the whole country", () => {
    const shields = draw(homeCamera(size)).texts().filter((text) => /^[AS]\d+$/.test(text));
    expect(shields).toContain("A1");
    expect(shields.length).toBeLessThanOrEqual(16);
    for (const ref of new Set(shields)) expect(shields.filter((shield) => shield === ref).length).toBeLessThanOrEqual(2);
  });

  it("draws no shields with names off", () => {
    const fake = fakeContext();
    const renderer = new MapRenderer(fakeCanvas(fake), store, fakePath);
    renderer.resize(size.width, size.height, 1);
    renderer.setPalette(palette);
    renderer.draw({ camera: homeCamera(size), layers: new Set(["motorways"]), showLabels: false, selection: null, here: null });
    expect(fake.texts()).toEqual([]);
  });
});

describe("a tapped motorway", () => {
  it("is found near its line and named with its number", () => {
    // On the A1 near Melk.
    const near = store.motorways!.lines;
    const line = motorways.route.indexOf(motorways.refs.indexOf("A1"));
    const x = near.xy[(near.start[line]! + 40) * 2]!;
    const y = near.xy[(near.start[line]! + 40) * 2 + 1]!;
    expect(motorwayNear(store, x + 0.1, y, 1)).toBe("A1");
    const camera = { x, y, k: fitScale(size) * 6 };
    const { renderer, state } = draw(camera, ["motorways"]);
    const [px, py] = toScreen(camera, size, x, y);
    const hit = renderer.hit(state, px, py + 2)!;
    expect(hit).toEqual({ kind: "motorway", ref: "A1" });
    expect(describeFeature(store, hit)).toMatchObject({ name: "A1 · West Autobahn", kind: "kinds.motorway" });
    expect(describeFeature(store, { kind: "motorway", ref: "S6" })?.kind).toBe("kinds.expressway");
  });
});

describe("motorways on the tilted map", () => {
  it("are drawn as lines, casing then amber, under the national border", () => {
    const keys = reliefLines(store, new Set(["provinces", "motorways"]), 1, null, palette);
    const at = keys.findIndex((set) => set.key === "motorways");
    expect(keys[at]!.colour).not.toEqual(keys[at + 1]!.colour);
    expect(keys[at + 1]!.key).toBe("motorways");
    expect(keys.at(-1)!.key).toBe("borders:coarse:0");
  });
});
