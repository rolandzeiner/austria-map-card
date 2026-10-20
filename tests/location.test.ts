/**
 * Where the pin goes, from each source, and what happens when a source has
 * nothing to say.
 */
import { describe, expect, it } from "vitest";

import { locate, locationKey } from "../src/location.ts";
import type { HomeAssistant } from "../src/types.ts";

const LINZ = { latitude: 48.3069, longitude: 14.2858 };
const GRAZ = { latitude: 47.0707, longitude: 15.4395 };

const hass: HomeAssistant = {
  config: LINZ,
  states: {
    "person.anna": { state: "not_home", attributes: { latitude: GRAZ.latitude, longitude: GRAZ.longitude } },
    "person.ben": { state: "home", attributes: {} },
    "person.cleo": { state: "not_home", attributes: {} },
  },
};

describe("locate", () => {
  it("puts the pin on the home's position", () => {
    expect(locate(hass, "home", null)).toEqual(LINZ);
  });

  it("has no home when Home Assistant has no position, or the 0/0 of an unset one", () => {
    expect(locate({}, "home", null)).toBeNull();
    expect(locate({ config: { latitude: 0, longitude: 0 } }, "home", null)).toBeNull();
  });

  it("follows the device once it answers, and marks the home until then", () => {
    expect(locate(hass, "device", GRAZ)).toEqual(GRAZ);
    expect(locate(hass, "device", null)).toEqual(LINZ);
  });

  it("follows an entity's coordinates", () => {
    expect(locate(hass, "person.anna", null)).toEqual(GRAZ);
  });

  it("places an entity at home without coordinates of its own at the home", () => {
    expect(locate(hass, "person.ben", null)).toEqual(LINZ);
  });

  it("shows nothing for an entity away without coordinates, or one that does not exist", () => {
    expect(locate(hass, "person.cleo", null)).toBeNull();
    expect(locate(hass, "person.nobody", null)).toBeNull();
  });

  it("ignores coordinates that are not numbers", () => {
    const odd: HomeAssistant = { states: { "person.x": { state: "x", attributes: { latitude: "48", longitude: 14 } } } };
    expect(locate(odd, "person.x", null)).toBeNull();
  });
});

describe("locationKey", () => {
  it("changes when the entity moves, and only then", () => {
    const moved: HomeAssistant = {
      ...hass,
      states: { ...hass.states, "person.anna": { state: "not_home", attributes: { latitude: 47.8, longitude: 13.04 } } },
    };
    expect(locationKey(hass, "person.anna", null)).toBe(locationKey({ ...hass }, "person.anna", null));
    expect(locationKey(moved, "person.anna", null)).not.toBe(locationKey(hass, "person.anna", null));
    expect(locationKey(hass, "person.nobody", null)).toBe("");
  });
});
