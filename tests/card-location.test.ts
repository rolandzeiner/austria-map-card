/**
 * @vitest-environment happy-dom
 *
 * The "you are here" pin on the card: off unless asked for, on the home by
 * default, following an entity as it moves and this device once the
 * browser answers, and the toolbar button that goes to it.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vite-plus/test";

import { toScreen } from "../src/map/camera.ts";
import { project } from "../src/map/projection.ts";
import {
  fake,
  hassDe,
  mount,
  settle,
  setUp,
  tearDown,
  tool,
  type CardInternals,
} from "./card-harness.ts";
import { pinTip } from "./fake-canvas.ts";

const LINZ = { latitude: 48.3069, longitude: 14.2858 };
const GRAZ = { latitude: 47.0707, longitude: 15.4395 };
const SALZBURG = { latitude: 47.8095, longitude: 13.055 };

const hassAt = (
  home: typeof LINZ,
  states: Record<string, unknown> = {},
): Record<string, unknown> => ({
  ...hassDe,
  config: home,
  states,
});
const away = (where: typeof LINZ): Record<string, unknown> => ({
  state: "not_home",
  attributes: { latitude: where.latitude, longitude: where.longitude },
});

/** The pin's tip, should it be drawn now. */
async function drawnPin(card: CardInternals): Promise<[number, number] | undefined> {
  await settle(card);
  fake.reset();
  card._drawNow();
  return pinTip(fake);
}

function expectPinAt(
  card: CardInternals,
  tip: [number, number] | undefined,
  where: typeof LINZ,
): void {
  const [x, y] = toScreen(
    card._camera!,
    { width: 760, height: 403 },
    ...project(where.latitude, where.longitude),
  );
  expect(tip?.[0]).toBeCloseTo(x);
  expect(tip?.[1]).toBeCloseTo(y);
}

beforeAll(setUp);
afterEach(() => {
  tearDown();
  // Back to happy-dom's own getter. Not vi.unstubAllGlobals(): that would
  // take the harness's stubs too.
  delete (navigator as { geolocation?: unknown }).geolocation;
});

describe("the pin", () => {
  it("is off by default, and so is its button", async () => {
    const card = await mount({}, hassAt(LINZ));
    expect(await drawnPin(card)).toBeUndefined();
    expect(tool(card, "Deinen Standort zeigen")).toBeUndefined();
  });

  it("marks the home when switched on", async () => {
    const card = await mount({ show_location: true }, hassAt(LINZ));
    expectPinAt(card, await drawnPin(card), LINZ);
  });

  it("follows an entity as it moves, without anything else changing", async () => {
    const card = await mount(
      { show_location: true, location: "person.anna" },
      hassAt(LINZ, { "person.anna": away(GRAZ) }),
    );
    expectPinAt(card, await drawnPin(card), GRAZ);
    card.hass = hassAt(LINZ, { "person.anna": away(SALZBURG) });
    expectPinAt(card, await drawnPin(card), SALZBURG);
  });

  it("does not redraw for state changes elsewhere in the house", async () => {
    const card = await mount(
      { show_location: true, location: "person.anna" },
      hassAt(LINZ, { "person.anna": away(GRAZ) }),
    );
    await settle(card);
    const renders = vi.spyOn(card as unknown as { render(): unknown }, "render");
    card.hass = hassAt(LINZ, {
      "person.anna": away(GRAZ),
      "light.kitchen": { state: "on", attributes: {} },
    });
    await settle(card);
    expect(renders).not.toHaveBeenCalled();
  });

  it("goes to the pin from its button, and offers no button target without a position", async () => {
    const card = await mount({ show_location: true }, hassAt(LINZ));
    tool(card, "Deinen Standort zeigen").click();
    await settle(card);
    const [x, y] = project(LINZ.latitude, LINZ.longitude);
    expect(card._camera!.x).toBeCloseTo(x);
    expect(card._camera!.y).toBeCloseTo(y);

    const lost = await mount({ show_location: true, location: "person.nobody" }, hassAt(LINZ));
    expect(tool(lost, "Deinen Standort zeigen").disabled).toBe(true);
    expect(await drawnPin(lost)).toBeUndefined();
  });
});

describe("this device", () => {
  function stubGeolocation(): {
    report(where: typeof LINZ): void;
    refuse(): void;
    watchPosition: ReturnType<typeof vi.fn>;
    clearWatch: ReturnType<typeof vi.fn>;
  } {
    let ok: ((fix: { coords: typeof LINZ }) => void) | undefined;
    let fail: ((error: { message: string }) => void) | undefined;
    const watchPosition = vi.fn((success, error) => {
      ok = success;
      fail = error;
      return 7;
    });
    const clearWatch = vi.fn();
    Object.defineProperty(navigator, "geolocation", {
      value: { watchPosition, clearWatch },
      configurable: true,
    });
    return {
      report: (where) => ok?.({ coords: where }),
      refuse: () => fail?.({ message: "denied" }),
      watchPosition,
      clearWatch,
    };
  }

  it("asks the browser only when the pin follows this device", async () => {
    const geo = stubGeolocation();
    await mount({ show_location: true }, hassAt(LINZ));
    await mount({}, hassAt(LINZ));
    expect(geo.watchPosition).not.toHaveBeenCalled();
    await mount({ show_location: true, location: "device" }, hassAt(LINZ));
    expect(geo.watchPosition).toHaveBeenCalledTimes(1);
  });

  it("marks the home until the browser answers, then the device", async () => {
    const geo = stubGeolocation();
    const card = await mount({ show_location: true, location: "device" }, hassAt(LINZ));
    expectPinAt(card, await drawnPin(card), LINZ);
    geo.report(GRAZ);
    expectPinAt(card, await drawnPin(card), GRAZ);
  });

  it("stays on the home when the browser refuses", async () => {
    const geo = stubGeolocation();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const card = await mount({ show_location: true, location: "device" }, hassAt(LINZ));
    geo.refuse();
    expectPinAt(card, await drawnPin(card), LINZ);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("stops following when the card leaves the page or the config changes", async () => {
    const geo = stubGeolocation();
    const card = await mount({ show_location: true, location: "device" }, hassAt(LINZ));
    card.setConfig({ type: "custom:austria-map-card", show_location: true });
    expect(geo.clearWatch).toHaveBeenCalledWith(7);
    card.setConfig({ type: "custom:austria-map-card", show_location: true, location: "device" });
    expect(geo.watchPosition).toHaveBeenCalledTimes(2);
    card.remove();
    expect(geo.clearWatch).toHaveBeenCalledTimes(2);
  });
});
