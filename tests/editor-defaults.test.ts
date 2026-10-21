/**
 * The editor shows the card's real defaults and saves only what changed.
 *
 * ha-form draws a missing boolean as off, a missing dropdown as blank and a
 * missing multi-select as empty, so an editor fed the raw config lies about
 * every default. These tests pin the fix in config.ts: the display side
 * fills every default in, the save side takes them back out.
 */
import { describe, expect, it } from "vite-plus/test";

import { DEFAULTS, normaliseConfig, tidyConfig } from "../src/config.ts";

const TYPE = "custom:austria-map-card";

describe("editor defaults", () => {
  it("shows every default, so a default-on toggle is drawn on", () => {
    const shown = normaliseConfig({ type: TYPE }) as Record<string, unknown>;
    for (const [key, value] of Object.entries(DEFAULTS)) {
      expect(shown[key], key).toEqual(value);
    }
    expect(shown.title).toBe("");
  });

  it("keeps what the user set over the defaults", () => {
    const set = { show_labels: false, show_layer_control: false, view: "AT-7", layers: ["rivers"] };
    expect(normaliseConfig({ type: TYPE, ...set })).toMatchObject(set);
  });

  it("treats cleared values as unset rather than blanking the default", () => {
    const cleared = Object.fromEntries(Object.keys(DEFAULTS).map((key) => [key, ""]));
    expect(normaliseConfig({ type: TYPE, ...cleared })).toMatchObject(DEFAULTS);
  });

  it("keeps an empty layer list: a map with every layer off is a choice", () => {
    expect(normaliseConfig({ type: TYPE, layers: [] }).layers).toEqual([]);
    expect(tidyConfig({ type: TYPE, layers: [] })).toEqual({ type: TYPE, layers: [] });
  });

  it("saves only what differs from the defaults, with type first", () => {
    const saved = tidyConfig({ ...normaliseConfig({ type: TYPE }), show_labels: false });
    expect(saved).toEqual({ type: TYPE, show_labels: false });
    expect(Object.keys(saved)[0]).toBe("type");
  });

  it("does not save the default layers, in whatever order ha-form hands them back", () => {
    const shuffled = [...DEFAULTS.layers].reverse();
    expect(tidyConfig({ type: TYPE, layers: shuffled })).toEqual({ type: TYPE });
  });

  it("saves a changed layer list in drawing order", () => {
    expect(tidyConfig({ type: TYPE, layers: ["cities", "districts", "terrain"] })).toEqual({
      type: TYPE,
      layers: ["terrain", "districts", "cities"],
    });
  });

  it("takes an entity id as the pin's source", () => {
    expect(normaliseConfig({ type: TYPE, location: "person.anna" }).location).toBe("person.anna");
    expect(normaliseConfig({ type: TYPE, location: "device_tracker.pixel_8" }).location).toBe(
      "device_tracker.pixel_8",
    );
  });

  it("round-trips an untouched config unchanged", () => {
    const config = { type: TYPE, view: "AT-5", layers: ["terrain", "districts"] };
    expect(tidyConfig(normaliseConfig(config))).toEqual(config);
  });
});

describe("config validation", () => {
  it.each([
    [
      { layers: ["roads"] },
      /"layers" must be a list of: terrain, rivers, municipalities, districts, provinces, main_roads, motorways, peaks, cities/,
    ],
    [{ layers: "terrain" }, /"layers" must be a list of/],
    [{ view: "AT-10" }, /"view" must be one of: austria, AT-1/],
    [{ show_labels: "yes" }, /"show_labels" must be true or false/],
    [{ show_layer_control: 1 }, /"show_layer_control" must be true or false/],
    [{ title: 42 }, /"title" must be text/],
    [{ show_location: "yes" }, /"show_location" must be true or false/],
    [{ location: "gps" }, /"location" must be home, device or an entity id/],
    [{ location: "Person.Anna" }, /"location" must be home, device or an entity id/],
  ])("rejects %j with a message naming the key", (raw, message) => {
    expect(() => normaliseConfig({ type: TYPE, ...raw })).toThrow(message);
  });

  it("rejects a config that is not a mapping", () => {
    expect(() => normaliseConfig(null)).toThrow(/mapping/);
    expect(() => normaliseConfig([])).toThrow(/mapping/);
  });

  it("trims the title", () => {
    expect(normaliseConfig({ type: TYPE, title: "  Österreich  " }).title).toBe("Österreich");
  });
});
