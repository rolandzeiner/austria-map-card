/**
 * The renderer on a recording canvas, with the real map data.
 *
 * Nothing is painted, so these tests are about what is drawn, in which
 * order and how much of it: the draw order, the tiles left out of a
 * zoomed-in frame, the detail that comes in with scale, and the hit test.
 */
import { beforeEach, describe, expect, it } from "vitest";

import type { MapStore } from "../src/layers/store.ts";
import { clampCamera, fitBox, fitScale, homeCamera, toScreen, type Camera } from "../src/map/camera.ts";
import { LIGHT_THEME, derivePalette } from "../src/map/palette.ts";
import { project } from "../src/map/projection.ts";
import { MapRenderer, type RenderState } from "../src/map/renderer.ts";
import { LAYER_IDS, type LayerId } from "../src/types.ts";
import { storeWith } from "./chunks.ts";
import { fakeCanvas, fakeContext, fakePath, pinTip, type FakeContext } from "./fake-canvas.ts";

const palette = derivePalette(LIGHT_THEME);
const size = { width: 760, height: 403 };
const all = storeWith();

let fake: FakeContext;

function rendererFor(store: MapStore): MapRenderer {
  fake = fakeContext();
  const renderer = new MapRenderer(fakeCanvas(fake), store, fakePath);
  renderer.resize(size.width, size.height, 2);
  renderer.setPalette(palette);
  return renderer;
}

const state = (camera: Camera, layers: readonly LayerId[], extra: Partial<RenderState> = {}): RenderState => ({
  camera,
  layers: new Set(layers),
  showLabels: true,
  selection: null,
  here: null,
  ...extra,
});

const standard: LayerId[] = ["terrain", "rivers", "provinces", "cities"];
const home = homeCamera(size);

/** A camera on a municipality's label point, at a zoom factor. */
function cameraAt(code: string, zoom: number): Camera {
  const table = all.detail!.municipalities;
  const row = table.ids.indexOf(code);
  return clampCamera({ x: table.at[row * 2]!, y: table.at[row * 2 + 1]!, k: fitScale(size) * zoom }, size);
}

beforeEach(() => {
  fake = fakeContext();
});

describe("before it can draw", () => {
  it("draws nothing without a palette", () => {
    fake = fakeContext();
    const renderer = new MapRenderer(fakeCanvas(fake), all, fakePath);
    renderer.resize(size.width, size.height, 1);
    renderer.draw(state(home, standard));
    expect(fake.named("fill")).toHaveLength(0);
    expect(renderer.hasPalette).toBe(false);
  });

  it("draws nothing until the base chunk is there", () => {
    const renderer = rendererFor(storeWith("places"));
    renderer.draw(state(home, standard));
    expect(fake.named("fill")).toHaveLength(0);
    expect(fake.named("clearRect")).toHaveLength(1);
  });

  it("refuses a canvas without a 2D context", () => {
    const canvas = { getContext: () => null, width: 0, height: 0 };
    expect(() => new MapRenderer(canvas, all, fakePath)).toThrow(/2D context/);
  });

  it("caps the backing store on a dense or very wide screen", () => {
    fake = fakeContext();
    const canvas = fakeCanvas(fake);
    const renderer = new MapRenderer(canvas, all, fakePath);
    renderer.resize(400, 212, 3);
    expect(canvas.width).toBe(800);
    renderer.resize(2000, 1060, 2);
    expect(canvas.width).toBe(2400);
    expect(renderer.size).toEqual({ width: 2000, height: 1060 });
  });
});

describe("draw order", () => {
  it("is land, terrain inside the country, rivers, borders, the national outline, then names", () => {
    const renderer = rendererFor(storeWith("base", "places"));
    renderer.draw(state(home, standard));
    const order = fake.calls
      .filter((call) => ["fill", "clip", "restore", "stroke", "fillText"].includes(call.name))
      .map((call) => {
        if (call.name === "fill") return call.fillStyle === palette.land ? "land" : "band";
        if (call.name === "stroke") {
          return call.strokeStyle === palette.water ? "river" : call.strokeStyle === palette.outline ? "outline" : "border";
        }
        return call.name;
      });
    // Collapse runs: "band band band" is one step.
    const steps = order.filter((step, index) => step !== order[index - 1]);
    expect(steps.slice(0, 7)).toEqual(["land", "clip", "band", "restore", "river", "border", "outline"]);
    expect(steps.indexOf("fillText")).toBeGreaterThan(steps.indexOf("outline"));
    // The eight bands, all before the clip is lifted.
    expect(order.slice(0, order.indexOf("restore")).filter((step) => step === "band")).toHaveLength(8);
  });

  it("paints the terrain from the lowest band up, each in its own shade", () => {
    const renderer = rendererFor(storeWith("base"));
    renderer.draw(state(home, ["terrain"]));
    const shades = fake.named("fill").slice(1).map((call) => call.fillStyle);
    expect(shades).toEqual(all.overview!.terrain.levels.map((level) => palette.band(level)));
    for (const call of fake.named("fill")) expect(call.args[1]).toBe("evenodd");
  });

  it("draws only the country and its outline with every layer off", () => {
    const renderer = rendererFor(storeWith("base", "places"));
    renderer.draw(state(home, []));
    expect(fake.named("fill")).toHaveLength(1);
    expect(fake.named("stroke").every((call) => call.strokeStyle === palette.outline)).toBe(true);
    expect(fake.named("stroke").length).toBeGreaterThan(0);
    expect(fake.texts()).toEqual([]);
  });

  it("draws each layer only when it is on", () => {
    const renderer = rendererFor(storeWith("base", "places"));
    renderer.draw(state(home, ["rivers"]));
    const colours = new Set(fake.named("stroke").map((call) => call.strokeStyle));
    expect(colours).toEqual(new Set([palette.water, palette.outline]));
  });
});

describe("constant line width", () => {
  it("divides widths by the scale, so a border is as wide on screen at any zoom", () => {
    const renderer = rendererFor(all);
    const widths: number[] = [];
    for (const zoom of [1, 6, 30]) {
      fake.reset();
      // Salzburg: the national border runs through the view at every zoom.
      const camera = cameraAt("50101", zoom);
      renderer.draw(state(camera, ["provinces"]));
      const outline = fake.named("stroke").find((call) => call.strokeStyle === palette.outline)!;
      widths.push((outline.lineWidth as number) * camera.k);
    }
    for (const width of widths) {
      expect(width).toBeGreaterThanOrEqual(1.5);
      expect(width).toBeLessThanOrEqual(1.5 * 1.7 + 1e-9);
    }
  });
});

describe("detail by scale", () => {
  it("switches from 8 terrain bands to 11 when zoomed in, if the detail is loaded", () => {
    const renderer = rendererFor(all);
    renderer.draw(state(home, ["terrain"]));
    expect(fake.named("fill")).toHaveLength(1 + 8);
    fake.reset();
    renderer.draw(state(cameraAt("70101", 8), ["terrain"]));
    expect(fake.named("fill")).toHaveLength(1 + 11);
  });

  it("stays on the overview's terrain while the detail is still loading", () => {
    const renderer = rendererFor(storeWith("base"));
    renderer.draw(state(cameraAt("70101", 8), ["terrain"]));
    expect(fake.named("fill")).toHaveLength(1 + 8);
  });

  it("draws municipal borders only from the scale at which they can be told apart", () => {
    const renderer = rendererFor(all);
    renderer.draw(state(home, ["municipalities"]));
    expect(fake.named("stroke").some((call) => call.strokeStyle === palette.municipality)).toBe(false);
    fake.reset();
    renderer.draw(state(cameraAt("40709", 9), ["municipalities"]));
    expect(fake.named("stroke").some((call) => call.strokeStyle === palette.municipality)).toBe(true);
  });

  it("draws district borders as soon as their chunk is there, at any scale", () => {
    const without = rendererFor(storeWith("base"));
    without.draw(state(home, ["districts"]));
    expect(fake.named("stroke").some((call) => call.strokeStyle === palette.district)).toBe(false);
    const withDetail = rendererFor(storeWith("base", "borders"));
    withDetail.draw(state(home, ["districts"]));
    expect(fake.named("stroke").some((call) => call.strokeStyle === palette.district)).toBe(true);
  });
});

describe("tile culling", () => {
  it("strokes fewer paths the further in the map is", () => {
    const renderer = rendererFor(all);
    const everything = [...LAYER_IDS];
    const strokes = [3, 12, 40].map((zoom) => {
      fake.reset();
      renderer.draw(state(cameraAt("40709", zoom), everything));
      return fake.named("stroke").length;
    });
    expect(strokes[1]!).toBeLessThan(strokes[0]! / 2);
    expect(strokes[2]!).toBeLessThan(strokes[1]!);
    expect(strokes[2]!).toBeGreaterThan(0);
  });

  it("builds each path once: a second frame of the same view builds none", () => {
    fake = fakeContext();
    let built = 0;
    const renderer = new MapRenderer(fakeCanvas(fake), all, () => {
      built += 1;
      return fakePath();
    });
    renderer.resize(size.width, size.height, 1);
    renderer.setPalette(palette);
    renderer.draw(state(home, standard));
    const first = built;
    renderer.draw(state(home, standard));
    expect(first).toBeGreaterThan(8);
    expect(built).toBe(first);
  });
});

describe("names", () => {
  it("names the capitals on the whole country, Klagenfurt by its short name", () => {
    const renderer = rendererFor(storeWith("base", "places"));
    renderer.draw(state(home, standard));
    const texts = fake.texts();
    for (const name of ["Wien", "Graz", "Linz", "Salzburg", "Innsbruck", "Klagenfurt", "Bregenz", "Eisenstadt", "St. Pölten"]) {
      expect(texts, name).toContain(name);
    }
    expect(texts).not.toContain("Klagenfurt am Wörthersee");
    expect(texts).toContain("TIROL");
  });

  it("draws the towns without names when names are off", () => {
    const renderer = rendererFor(storeWith("base", "places"));
    renderer.draw(state(home, standard, { showLabels: false }));
    expect(fake.texts()).toEqual([]);
    expect(fake.named("arc").length).toBeGreaterThan(9 * 2);
  });

  it("names no town when the layer is off", () => {
    const renderer = rendererFor(storeWith("base", "places"));
    renderer.draw(state(home, ["terrain", "provinces"]));
    expect(fake.texts()).not.toContain("Wien");
    expect(fake.named("arc")).toHaveLength(0);
    expect(fake.texts()).toContain("STEIERMARK");
  });

  it("names more towns the further in the map is", () => {
    const renderer = rendererFor(all);
    renderer.draw(state(cameraAt("40709", 1.5), standard));
    const few = fake.texts();
    fake.reset();
    renderer.draw(state(cameraAt("40709", 9), standard));
    const many = fake.texts();
    expect(few).not.toContain("Gosau");
    expect(many).toContain("Gosau");
  });

  it("names a municipality once: not again under the town that carries its name", () => {
    const renderer = rendererFor(all);
    renderer.draw(state(cameraAt("40709", 9), [...LAYER_IDS]));
    const texts = fake.texts();
    expect(texts.filter((text) => text === "Gosau")).toHaveLength(1);
    // Hallstatt's town lies outside this view; the municipality's name stands.
    expect(texts).toContain("Hallstatt");
    expect(texts).toContain("LIEZEN");
  });

  it("letters a river one character at a time, along its course", () => {
    const renderer = rendererFor(storeWith("base"));
    renderer.draw(state(home, ["rivers"]));
    const letters = fake.texts().join("");
    expect(letters).toContain("Donau");
    expect(fake.named("rotate").length).toBeGreaterThan(5);
  });
});

describe("the hit test", () => {
  const everything = [...LAYER_IDS];

  it("finds a town by its dot and by its name", () => {
    const renderer = rendererFor(storeWith("base", "places"));
    const view = state(home, standard);
    renderer.draw(view);
    const places = all.places!;
    const wien = places.names.indexOf("Wien");
    const [x, y] = toScreen(home, size, places.at[wien * 2]!, places.at[wien * 2 + 1]!);
    expect(renderer.hit(view, x, y)).toEqual({ kind: "city", row: wien });
    expect(renderer.hit(view, x + 22, y)).toEqual({ kind: "city", row: wien });
  });

  it("finds the province under an empty spot", () => {
    const renderer = rendererFor(storeWith("base", "places"));
    const view = state(home, ["provinces"]);
    renderer.draw(view);
    const table = all.overview!.provinces;
    const row = table.ids.indexOf("AT-6");
    const [x, y] = toScreen(home, size, table.at[row * 2]!, table.at[row * 2 + 1]!);
    expect(renderer.hit(view, x, y)).toEqual({ kind: "province", row });
  });

  it("finds the smallest area whose layer is on", () => {
    const renderer = rendererFor(all);
    const camera = cameraAt("40709", 9);
    const table = all.detail!.municipalities;
    const row = table.ids.indexOf("40709");
    const [x, y] = toScreen(camera, size, table.at[row * 2]!, table.at[row * 2 + 1]!);
    const hitWith = (layers: LayerId[]) => {
      const view = state(camera, layers);
      renderer.draw(view);
      return renderer.hit(view, x, y);
    };
    expect(hitWith(["provinces", "districts", "municipalities"])).toEqual({ kind: "municipality", row });
    expect(hitWith(["provinces", "districts"])).toEqual({ kind: "district", row: table.parent![row] });
    expect(hitWith(["provinces"])).toEqual({ kind: "province", row: all.detail!.provinceOf[row] });
    expect(hitWith(["terrain"])).toBeNull();
  });

  it("does not offer a municipality while their borders are not drawn", () => {
    const renderer = rendererFor(all);
    const view = state(home, ["municipalities", "provinces"]);
    renderer.draw(view);
    expect(renderer.hit(view, 400, 250)?.kind).toBe("province");
  });

  it("finds a river near its line, when rivers are on", () => {
    const renderer = rendererFor(storeWith("base"));
    const rivers = all.overview!.rivers;
    const line = [...rivers.name].findIndex((row, index) => rivers.names[row] === "Donau" && rivers.order[index] === 9);
    const middle = Math.floor((rivers.lines.start[line]! + rivers.lines.start[line + 1]!) / 2);
    const [x, y] = toScreen(home, size, rivers.lines.xy[middle * 2]!, rivers.lines.xy[middle * 2 + 1]!);
    const on = state(home, ["rivers", "provinces"]);
    renderer.draw(on);
    expect(renderer.hit(on, x + 2, y + 2)).toEqual({ kind: "river", name: "Donau", order: 9 });
    const off = state(home, ["provinces"]);
    renderer.draw(off);
    expect(renderer.hit(off, x + 2, y + 2)?.kind).toBe("province");
  });

  it("finds nothing abroad", () => {
    const renderer = rendererFor(all);
    const view = state(home, everything);
    renderer.draw(view);
    expect(renderer.hit(view, 30, 30)).toBeNull();
  });
});

describe("the selection", () => {
  it("fills and outlines a selected area in the accent colour", () => {
    const renderer = rendererFor(storeWith("base"));
    renderer.draw(state(home, ["provinces"], { selection: { kind: "province", row: 5 } }));
    expect(fake.named("fill").some((call) => call.fillStyle === palette.accentFill)).toBe(true);
    expect(fake.named("stroke").some((call) => call.strokeStyle === palette.accent)).toBe(true);
  });

  it("strokes a selected river in the accent colour", () => {
    const renderer = rendererFor(storeWith("base"));
    renderer.draw(state(home, ["rivers"], { selection: { kind: "river", name: "Donau", order: 9 } }));
    expect(fake.named("stroke").some((call) => call.strokeStyle === palette.accent)).toBe(true);
  });

  it("shows and rings a selected town even where it would be too small for the scale", () => {
    const renderer = rendererFor(storeWith("base", "places"));
    const row = all.places!.names.indexOf("Gosau");
    renderer.draw(state(home, standard, { selection: { kind: "city", row } }));
    expect(fake.texts()).toContain("Gosau");
    expect(fake.named("stroke").some((call) => call.strokeStyle === palette.accent)).toBe(true);
  });

  it("ignores a selection whose data is not loaded", () => {
    const renderer = rendererFor(storeWith("base"));
    expect(() => renderer.draw(state(home, ["provinces"], { selection: { kind: "municipality", row: 3 } }))).not.toThrow();
    expect(fake.named("fill").some((call) => call.fillStyle === palette.accentFill)).toBe(false);
  });
});

describe("zoom here", () => {
  it("frames an area by its outline", () => {
    const renderer = rendererFor(all);
    const box = renderer.boxOf({ kind: "province", row: all.overview!.provinces.ids.indexOf("AT-9") })!;
    // Vienna is about 30 km across: some 50 units.
    expect(box[2] - box[0]).toBeGreaterThan(30);
    expect(box[2] - box[0]).toBeLessThan(80);
    const camera = fitBox(box, size, 16);
    expect(camera.k).toBeGreaterThan(fitScale(size) * 5);
    expect(renderer.boxOf({ kind: "district", row: 0 })).toBeDefined();
    expect(renderer.boxOf({ kind: "municipality", row: 0 })).toBeDefined();
  });

  it("frames a town with its surroundings and a river from end to end", () => {
    const renderer = rendererFor(all);
    const town = renderer.boxOf({ kind: "city", row: 0 })!;
    expect(town[2] - town[0]).toBe(28);
    const danube = renderer.boxOf({ kind: "river", name: "Donau", order: 9 })!;
    expect(danube[2] - danube[0]).toBeGreaterThan(400);
    expect(renderer.boxOf({ kind: "river", name: "Nil", order: 9 })).toBeUndefined();
  });

  it("has no frame for what is not loaded", () => {
    const renderer = rendererFor(storeWith("base"));
    expect(renderer.boxOf({ kind: "municipality", row: 0 })).toBeUndefined();
    expect(renderer.boxOf({ kind: "city", row: 0 })).toBeUndefined();
    expect(renderer.boxOf({ kind: "province", row: 0 })).toBeDefined();
  });
});

describe("the pin", () => {
  const linz = project(48.3069, 14.2858);

  it("is not drawn without a position", () => {
    const renderer = rendererFor(all);
    renderer.draw(state(home, standard));
    expect(pinTip(fake)).toBeUndefined();
  });

  it("puts its tip on the position, on top of everything, in the accent colour", () => {
    const renderer = rendererFor(all);
    renderer.draw(state(home, standard, { here: linz }));
    const [x, y] = toScreen(home, size, ...linz);
    const tip = pinTip(fake)!;
    expect(tip[0]).toBeCloseTo(x);
    expect(tip[1]).toBeCloseTo(y);
    const fills = fake.named("fill");
    // The head, then the hole: the last two fills of the frame.
    expect(fills.at(-2)?.fillStyle).toBe(palette.accent);
    expect(fills.at(-1)?.fillStyle).toBe(palette.land);
    expect(fake.calls.findIndex((call) => call.name === "fillText")).toBeLessThan(fake.calls.indexOf(fills.at(-2)!));
  });

  it("is drawn with every layer off and names off", () => {
    const renderer = rendererFor(all);
    renderer.draw({ ...state(home, []), showLabels: false, here: linz });
    expect(pinTip(fake)).toBeDefined();
  });

  it("stays the same size at any zoom", () => {
    const renderer = rendererFor(all);
    renderer.draw(state(home, standard, { here: linz }));
    const near = clampCamera({ x: linz[0], y: linz[1], k: fitScale(size) * 20 }, size);
    const first = fake.named("scale").at(-1)?.args;
    fake.reset();
    renderer.draw(state(near, standard, { here: linz }));
    expect(fake.named("scale").at(-1)?.args).toEqual(first);
    const tip = pinTip(fake)!;
    expect(tip[0]).toBeCloseTo(size.width / 2);
    expect(tip[1]).toBeCloseTo(size.height / 2);
  });
});
