/**
 * @vitest-environment happy-dom
 *
 * The tilted map on the card. happy-dom has no WebGL, so a stand-in for the
 * WebGL renderer is put in its place: what is tested is the card around it,
 * the names and the pin drawn over it, and the hit test through it.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { project } from "../src/map/projection.ts";
import { FLAT, TILT_PITCH, View3D, type Orientation } from "../src/map/view3d.ts";
import { $, fake, hassDe, key, mount, pageLoader, settle, setUp, tap, tearDown, tool, type CardInternals } from "./card-harness.ts";
import { pinTip } from "./fake-canvas.ts";

interface TiltInternals extends CardInternals {
  _orientation: Orientation;
  _canTilt: boolean;
  _gl: unknown;
  _setPose(pose: { camera: unknown; orientation: Orientation }): void;
}

/** What the card asks of the WebGL renderer, recorded. */
function stubGL(): { draws: View3D[]; drapes: string[]; lost: boolean } & Record<string, unknown> {
  const stub = {
    draws: [] as View3D[],
    drapes: [] as string[],
    lost: false,
    hasRelief: true,
    resize: () => undefined,
    setRelief: () => undefined,
    setDrape: (_image: unknown, key: string) => stub.drapes.push(key),
    draw: (view: View3D) => stub.draws.push(view),
  };
  return stub;
}

class FakeWebGL2 {}

beforeAll(setUp);
afterEach(() => {
  tearDown();
  // @ts-expect-error -- a stand-in only some tests put up
  delete globalThis.WebGL2RenderingContext;
});

async function mountTilting(config: Record<string, unknown> = {}): Promise<{ card: TiltInternals; gl: ReturnType<typeof stubGL> }> {
  vi.stubGlobal("WebGL2RenderingContext", FakeWebGL2);
  const card = (await mount(config, { ...hassDe, config: { latitude: 47.2692, longitude: 11.4041 } })) as TiltInternals;
  card._canTilt = true;
  const gl = stubGL();
  card._gl = gl;
  await settle(card);
  return { card, gl };
}

describe("without WebGL 2", () => {
  it("offers no 3D view and stays flat", async () => {
    const card = (await mount()) as TiltInternals;
    expect(tool(card, "3D-Ansicht")).toBeUndefined();
    expect($(card, "canvas.relief")).toBeNull();
    expect(card._orientation).toEqual(FLAT);
  });

  it("goes back to flat when the browser has the API but no context", async () => {
    vi.stubGlobal("WebGL2RenderingContext", FakeWebGL2);
    const card = (await mount()) as TiltInternals;
    expect(tool(card, "3D-Ansicht")).toBeDefined();
    card._setPose({ camera: card._camera, orientation: { pitch: 0.5, bearing: 0 } });
    card._drawNow();
    await settle(card);
    expect(card._canTilt).toBe(false);
    expect(card._orientation).toEqual(FLAT);
    expect(tool(card, "3D-Ansicht")).toBeUndefined();
  });
});

describe("the tilted map", () => {
  it("tilts from its button, and says it is pressed", async () => {
    const { card } = await mountTilting();
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    tool(card, "3D-Ansicht").click();
    await settle(card);
    expect(card._orientation.pitch).toBeCloseTo(TILT_PITCH);
    expect(tool(card, "3D-Ansicht").getAttribute("aria-pressed")).toBe("true");
    tool(card, "3D-Ansicht").click();
    await settle(card);
    expect(card._orientation).toEqual(FLAT);
  });

  it("draws the relief with WebGL, loads it, and lays the map over it without the towns", async () => {
    const { card, gl } = await mountTilting();
    card._setPose({ camera: card._camera, orientation: { pitch: 0.8, bearing: 0.3 } });
    card._drawNow();
    await settle(card);
    expect(gl.draws.length).toBeGreaterThan(0);
    expect(pageLoader().state("relief")).not.toBe("idle");
    expect(gl.drapes.at(-1)).toContain("terrain,rivers,provinces");
    expect(gl.drapes.at(-1)).not.toContain("cities");
    expect($(card, "canvas.relief")?.hidden).toBe(false);
  });

  it("draws the names upright over it, where their ground is seen", async () => {
    const { card, gl } = await mountTilting();
    card._setPose({ camera: card._camera, orientation: { pitch: 0.8, bearing: 0.3 } });
    fake.reset();
    card._drawNow();
    expect(fake.texts()).toContain("Wien");
    // Nothing of the flat map: no filled land on this canvas.
    expect(fake.named("fill").every((call) => call.fillStyle !== "rgb(0, 0, 0)")).toBe(true);
    const view = gl.draws.at(-1)!;
    expect(view.scale).toBe(card._camera!.k);
  });

  it("keeps the pin on its ground point", async () => {
    const { card, gl } = await mountTilting({ show_location: true });
    card._setPose({ camera: card._camera, orientation: { pitch: 0.9, bearing: -0.4 } });
    fake.reset();
    card._drawNow();
    const view = gl.draws.at(-1)!;
    const [x, y] = project(47.2692, 11.4041);
    const expected = view.projectGround(pageLoader().store.relief, x, y)!;
    const tip = pinTip(fake)!;
    expect(tip[0]).toBeCloseTo(expected[0]);
    expect(tip[1]).toBeCloseTo(expected[1]);
  });

  it("selects what is tapped through the tilt", async () => {
    const { card, gl } = await mountTilting({ layers: ["terrain", "provinces"] });
    card._setPose({ camera: card._camera, orientation: { pitch: 0.7, bearing: 0 } });
    card._drawNow();
    await settle(card);
    const view = gl.draws.at(-1)!;
    // Somewhere in Upper Austria, away from any town.
    const [x, y] = project(48.05, 13.75);
    const pixel = view.projectGround(pageLoader().store.relief, x, y)!;
    await tap(card, pixel[0], pixel[1]);
    expect(card._selection).toEqual({ kind: "province", row: 3 });
  });

  it("turns with Shift and the arrows, and faces north again from the compass", async () => {
    const { card } = await mountTilting();
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    await key(card, "ArrowLeft", { shiftKey: true });
    expect(card._orientation.bearing).toBeGreaterThan(0);
    tool(card, "Nach Norden ausrichten").click();
    await settle(card);
    expect(card._orientation).toEqual(FLAT);
    expect(tool(card, "Nach Norden ausrichten")).toBeUndefined();
  });

  it("goes flat again on reset", async () => {
    const { card } = await mountTilting();
    card._setPose({ camera: card._camera, orientation: { pitch: 0.7, bearing: 1 } });
    await key(card, "0");
    expect(card._orientation).toEqual(FLAT);
    expect($(card, "canvas.relief")?.hidden).toBe(true);
  });
});
