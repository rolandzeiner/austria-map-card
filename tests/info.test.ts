/**
 * What the info panel says about a tapped feature, from the committed
 * chunks: name, kind, the units it lies in, and its facts. Areas, towns
 * and summits are also described from a store that lacks a chunk they
 * need, and a
 * tap on the water finds the named river nearest to it.
 */
import { describe, expect, it } from "vite-plus/test";

import { describeFeature, type FeatureInfo } from "../src/layers/info.ts";
import { riverNear } from "../src/layers/rivers.ts";
import type { Feature } from "../src/map/labels.ts";
import { project } from "../src/map/projection.ts";
import { storeWith } from "./chunks.ts";

const all = storeWith();
// Without the borders chunk: no districts and no municipalities.
const overview = storeWith("base", "places", "peaks");
const places = all.places!;

const about = (feature: Feature, store = all): FeatureInfo | null =>
  describeFeature(store, feature);
const town = (name: string): Feature => ({ kind: "city", row: places.names.indexOf(name) });

describe("areas", () => {
  it("names a province with its population and no parents", () => {
    expect(about({ kind: "province", row: 0 })).toMatchObject({
      name: "Burgenland",
      kind: "kinds.province",
      parents: [],
      facts: [{ label: "facts.population", value: 301695, format: "integer" }],
    });
  });

  it("places a district in its province", () => {
    expect(about({ kind: "district", row: 0 })).toMatchObject({
      name: "Eisenstadt(Stadt)",
      kind: "kinds.district",
      parents: ["Burgenland"],
    });
  });

  it("places a municipality in its district and province", () => {
    expect(about({ kind: "municipality", row: 0 })).toMatchObject({
      name: "Eisenstadt",
      kind: "kinds.municipality",
      parents: ["Eisenstadt(Stadt)", "Burgenland"],
    });
  });

  it("describes no district or municipality before the borders arrive", () => {
    expect(about({ kind: "district", row: 0 }, overview)).toBeNull();
    expect(about({ kind: "municipality", row: 0 }, overview)).toBeNull();
    expect(about({ kind: "province", row: 0 }, storeWith("places"))).toBeNull();
  });
});

describe("towns", () => {
  it("places a town in its municipality, district and province", () => {
    expect(about(town("Graz"))).toMatchObject({
      name: "Graz",
      kind: "kinds.town_0",
      parents: ["Graz", "Graz(Stadt)", "Steiermark"],
      facts: [{ label: "facts.municipality_population", value: 306971 }],
    });
    expect(about(town("Hallstatt"))).toMatchObject({
      kind: "kinds.town_1",
      parents: ["Hallstatt", "Gmunden", "Oberösterreich"],
    });
  });

  it("describes a town without parents until the borders arrive", () => {
    expect(about(town("Graz"), overview)?.parents).toEqual([]);
  });

  it("describes no town without the places chunk", () => {
    expect(about({ kind: "city", row: 0 }, storeWith("base"))).toBeNull();
  });
});

describe("summits", () => {
  it("places a summit in the municipality it stands in", () => {
    expect(about({ kind: "peak", row: 0 })).toMatchObject({
      name: "Großglockner",
      kind: "kinds.peak",
      parents: ["Heiligenblut am Großglockner", "Spittal an der Drau", "Kärnten"],
      facts: [{ label: "facts.height", value: 3798, format: "metres" }],
    });
  });

  it("falls back to the province from the overview without the borders", () => {
    // The summit is on the Carinthian-Tyrolean border; the coarse outline
    // puts it on the Tyrolean side.
    expect(about({ kind: "peak", row: 0 }, overview)?.parents).toEqual(["Tirol"]);
  });

  it("describes no summit without the peaks chunk", () => {
    expect(about({ kind: "peak", row: 0 }, storeWith("base"))).toBeNull();
  });
});

describe("roads", () => {
  it("names a route by number and name, with its provinces and length", () => {
    expect(about({ kind: "road", ref: "A1" })).toMatchObject({
      name: "A1 · West Autobahn",
      kind: "kinds.motorway",
      parents: ["Niederösterreich", "Oberösterreich", "Salzburg", "Wien"],
      facts: [{ label: "facts.length", value: 2925, format: "kilometres" }],
    });
    expect(about({ kind: "road", ref: "B1" })).toMatchObject({
      name: "B1 · Wiener Straße",
      kind: "kinds.main_road",
    });
  });

  it("describes no route the data does not have", () => {
    expect(about({ kind: "road", ref: "A99" })).toBeNull();
  });
});

describe("rivers", () => {
  it("gives a river its provinces, its length and its stream order", () => {
    expect(about({ kind: "river", name: "Mur", order: 7 })).toMatchObject({
      name: "Mur",
      kind: "kinds.river",
      parents: ["Salzburg", "Steiermark"],
      facts: [
        { label: "facts.length_in_austria", value: 3616, format: "kilometres" },
        { label: "facts.stream_order", value: 7, format: "integer" },
      ],
    });
  });

  it("calls a small water a stream and knows only its order when unnamed in the data", () => {
    const info = about({ kind: "river", name: "Nirgendbach", order: 2 });
    expect(info).toMatchObject({ kind: "kinds.stream", parents: [] });
    expect(info?.facts.map((fact) => fact.label)).toEqual(["facts.stream_order"]);
  });
});

describe("the river under a tap", () => {
  const near = (lat: number, lon: number, reach: number, store = all) => {
    const [x, y] = project(lat, lon);
    return riverNear(store, 3, x, y, reach);
  };

  it("finds the named river at the point, from either river set", () => {
    // Reichsbrücke, Vienna.
    expect(near(48.2275, 16.4117, 3)).toEqual({ name: "Donau", order: 9 });
    expect(near(48.2275, 16.4117, 3, storeWith("base"))).toEqual({ name: "Donau", order: 9 });
    expect(near(47.0707, 15.4339, 0.5)).toEqual({ name: "Mur", order: 7 });
  });

  it("finds nothing beyond its reach, and the nearest river within it", () => {
    expect(near(47.5, 14.0, 0.5)).toBeUndefined();
    expect(near(47.5, 14.0, 3)).toEqual({ name: "Enns", order: 6 });
  });
});
