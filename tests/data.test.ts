/**
 * The generated map data, checked through the card's own reader.
 *
 * These tests run on the chunk files as committed in dist/. They are what
 * says the build, the packing and the card's hit test agree: a label point
 * is found by the build on the geometry it wrote, and here the card's index
 * has to find the same unit again from the bytes a browser would get.
 */
import { describe, expect, it } from "vitest";

import { CHUNK_IDS, DATA_FORMAT, chunkFile, decodeInts, type ChunkId } from "../src/data/format.ts";
import { heightAt, type Rivers, type Table } from "../src/layers/store.ts";
import { MAP_HEIGHT, MAP_WIDTH, project } from "../src/map/projection.ts";
import { CHUNK_TEXT, chunk, storeWith } from "./chunks.ts";

const store = storeWith();
const overview = store.overview!;
const detail = store.detail!;
const municipalityIndex = store.municipalityIndex!;
const places = store.places!;

/** Residents of Austria on 1 January 2026: the total of Statistik Austria's table. */
const RESIDENTS = 9_215_956;

const population = (table: Table): Int32Array => table.facts.find((fact) => fact.key === "population")!.values;
const sum = (values: Iterable<number>): number => [...values].reduce((total, value) => total + value, 0);

describe("the chunk files", () => {
  it.each(CHUNK_IDS.map((id) => [id]))("%s is an ES module with one default export in the current format", (id) => {
    const text = CHUNK_TEXT[id as ChunkId];
    expect(text.startsWith(`/*! Austria Map Card, map data "${id}".`)).toBe(true);
    expect(text.match(/export default /g)).toHaveLength(1);
    const data = chunk(id as ChunkId);
    expect(data.id).toBe(id);
    expect(data.format).toBe(DATA_FORMAT);
    expect(chunkFile(id as ChunkId)).toBe(`austria-map-data-${id}.js`);
  });

  it.each(CHUNK_IDS.map((id) => [id]))("%s names its sources, all CC BY 4.0, each with a date and a link", (id) => {
    const { sources } = chunk(id as ChunkId);
    expect(sources.length).toBeGreaterThan(0);
    for (const source of sources) {
      expect(source.licence).toBe("CC BY 4.0");
      expect(source.holder).toMatch(/^(BEV|BMLUK|Statistik Austria)$/);
      expect(source.stand).toMatch(/\d{4}/);
      expect(source.url).toMatch(/^https:\/\//);
      expect(text(id as ChunkId)).toContain(source.name);
    }
  });

  it("credits every fact to a source its chunk carries", () => {
    for (const [id, tables] of [
      ["base", [chunk("base").provinces]],
      ["borders", [chunk("borders").districts, chunk("borders").municipalities]],
      ["places", [chunk("places").places]],
    ] as const) {
      const known = chunk(id).sources.map((source) => source.id);
      for (const table of tables) {
        for (const fact of table.facts) expect(known, `${id}: ${fact.key}`).toContain(fact.source);
      }
    }
  });

  it("stay small enough to load on a phone", () => {
    const bytes = Object.fromEntries(CHUNK_IDS.map((id) => [id, CHUNK_TEXT[id].length]));
    // The base chunk loads with every map; the others only when asked for.
    expect(bytes.base).toBeLessThan(100_000);
    // The relief is the full 585 m grid and loads only for the tilted map:
    // 523 KB as written, 162 KB as served gzipped.
    for (const id of CHUNK_IDS) expect(bytes[id], id).toBeLessThan(id === "relief" ? 600_000 : 350_000);
  });
});

describe("the relief", () => {
  const relief = storeWith("relief").relief!;

  it("is the grid of the projection, one cell per unit", () => {
    expect([relief.columns, relief.rows]).toEqual([1000, 530]);
    expect(relief.metres).toHaveLength(1000 * 530);
  });

  it("rises to the Glockner group and stays low by the Neusiedler See", () => {
    expect(relief.peak).toBeGreaterThan(3400);
    expect(relief.peak).toBeLessThan(3800);
    const [gx, gy] = project(47.0742, 12.6947);
    const [nx, ny] = project(47.83, 16.76);
    expect(heightAt(relief, gx, gy)).toBeGreaterThan(2500);
    expect(heightAt(relief, nx, ny)).toBeLessThan(250);
  });

  it("holds no data far outside the country", () => {
    expect(heightAt(relief, 2, 2)).toBe(0);
  });
});

const text = (id: ChunkId): string => CHUNK_TEXT[id];

describe("the administrative units", () => {
  it("are 9 provinces, 94 districts and 2092 municipalities", () => {
    expect(overview.provinces.count).toBe(9);
    expect(detail.districts.count).toBe(94);
    expect(detail.municipalities.count).toBe(2092);
    expect([...overview.provinces.ids]).toEqual(["AT-1", "AT-2", "AT-3", "AT-4", "AT-5", "AT-6", "AT-7", "AT-8", "AT-9"]);
  });

  it("have unique official codes, and names that are not unique", () => {
    expect(new Set(detail.municipalities.ids).size).toBe(2092);
    expect(new Set(detail.districts.ids).size).toBe(94);
    for (const id of detail.municipalities.ids) expect(id).toMatch(/^\d{5}$/);
    for (const id of detail.districts.ids) expect(id).toMatch(/^\d{3}$/);
    // Why everything is keyed by code: a few municipalities share a name.
    expect(new Set(detail.municipalities.names).size).toBeLessThan(2092);
  });

  it("nest: a municipality's code starts with its district's, a district's with its province's", () => {
    const { municipalities, districts } = detail;
    municipalities.ids.forEach((id, row) => {
      expect(id.startsWith(districts.ids[municipalities.parent![row]!]!), id).toBe(true);
    });
    districts.ids.forEach((id, row) => {
      expect(`AT-${id[0]}`, id).toBe(overview.provinces.ids[districts.parent![row]!]);
    });
  });

  it("know Vienna as one municipality, one district and one province", () => {
    const row = detail.municipalities.ids.indexOf("90001");
    expect(detail.municipalities.names[row]).toBe("Wien");
    expect(detail.districts.names[detail.municipalities.parent![row]!]).toMatch(/^Wien/);
    expect(overview.provinces.names[detail.provinceOf[row]!]).toBe("Wien");
  });
});

describe("the population", () => {
  it("is positive in every municipality", () => {
    for (const value of population(detail.municipalities)) expect(value).toBeGreaterThan(0);
  });

  it("adds up to the national figure at every level", () => {
    expect(sum(population(detail.municipalities))).toBe(RESIDENTS);
    expect(sum(population(detail.districts))).toBe(RESIDENTS);
    expect(sum(population(overview.provinces))).toBe(RESIDENTS);
  });

  it("adds up district by district", () => {
    const sums = new Array<number>(detail.districts.count).fill(0);
    population(detail.municipalities).forEach((value, row) => {
      sums[detail.municipalities.parent![row]!]! += value;
    });
    expect(sums).toEqual([...population(detail.districts)]);
  });

  it("puts two million people in Vienna", () => {
    const vienna = population(overview.provinces)[overview.provinces.ids.indexOf("AT-9")]!;
    expect(vienna).toBeGreaterThan(1_900_000);
    expect(vienna).toBeLessThan(2_200_000);
  });
});

describe("the borders", () => {
  it("separate two different units on every arc, the smaller row first", () => {
    for (const borders of [overview.arcs, detail.arcs, store.municipalArcs!]) {
      expect(borders.a).toHaveLength(borders.lines.count);
      for (let arc = 0; arc < borders.lines.count; arc += 1) {
        expect(borders.a[arc]!).toBeLessThan(borders.b[arc]!);
        expect(borders.a[arc]!).toBeGreaterThanOrEqual(-1);
        expect(borders.b[arc]!).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("give every arc a level, and split the levels between the two chunks", () => {
    const { municipalities } = detail;
    const districtOf = municipalities.parent!;
    const levelOf = (a: number, b: number): number =>
      a < 0 ? 0 : detail.provinceOf[a] !== detail.provinceOf[b] ? 1 : districtOf[a] !== districtOf[b] ? 2 : 3;
    const upper = Array.from(detail.arcs.a, (a, arc) => levelOf(a, detail.arcs.b[arc]!));
    const lower = Array.from(store.municipalArcs!.a, (a, arc) => levelOf(a, store.municipalArcs!.b[arc]!));
    expect(new Set(upper)).toEqual(new Set([0, 1, 2]));
    expect(new Set(lower)).toEqual(new Set([3]));
    expect(upper).toEqual([...detail.level]);
  });

  it("stay inside the view box", () => {
    for (const lines of [overview.arcs.lines, detail.arcs.lines, store.municipalArcs!.lines]) {
      for (let index = 0; index < lines.xy.length; index += 2) {
        expect(lines.xy[index]!).toBeGreaterThan(5);
        expect(lines.xy[index]!).toBeLessThan(MAP_WIDTH - 5);
        expect(lines.xy[index + 1]!).toBeGreaterThan(5);
        expect(lines.xy[index + 1]!).toBeLessThan(MAP_HEIGHT - 5);
      }
    }
  });

  it("close into one national outline, on the generalised and on the fine borders", () => {
    // The mainland, plus nothing else: Austria has no exclave that is not
    // joined to it (Jungholz hangs on by a single point).
    for (const rings of [overview.country, detail.country]) {
      expect(rings.length).toBeGreaterThanOrEqual(1);
      expect(rings.length).toBeLessThanOrEqual(3);
      for (const ring of rings) {
        expect([ring[0], ring[1]]).toEqual([ring[ring.length - 2], ring[ring.length - 1]]);
      }
    }
  });

  it("give every unit an outline that closes", () => {
    for (let row = 0; row < 9; row += 1) expect(overview.index.rings(row).length, `province ${row}`).toBeGreaterThan(0);
    for (let row = 0; row < 94; row += 1) expect(detail.districtIndex.rings(row).length, `district ${row}`).toBeGreaterThan(0);
    for (let row = 0; row < 2092; row += 1) {
      const arcs = municipalityIndex.arcsOf(row).length;
      expect(arcs, detail.municipalities.ids[row]).toBeGreaterThan(0);
      expect(municipalityIndex.rings(row).length, detail.municipalities.ids[row]).toBeGreaterThan(0);
    }
  });
});

describe("label points", () => {
  it("hit-test back to their own municipality, all 2092 of them", () => {
    const { at, ids } = detail.municipalities;
    for (let row = 0; row < 2092; row += 1) {
      expect(municipalityIndex.locate(at[row * 2]!, at[row * 2 + 1]!), ids[row]).toBe(row);
    }
  });

  it("hit-test back to their own district and province, on the fine borders", () => {
    for (let row = 0; row < 94; row += 1) {
      const x = detail.districts.at[row * 2]!;
      const y = detail.districts.at[row * 2 + 1]!;
      expect(detail.districtIndex.locate(x, y), detail.districts.names[row]).toBe(row);
      expect(detail.provinceIndex.locate(x, y)).toBe(detail.districts.parent![row]);
    }
  });

  it("hit-test back to their own province on the generalised and the fine borders alike", () => {
    for (let row = 0; row < 9; row += 1) {
      const x = overview.provinces.at[row * 2]!;
      const y = overview.provinces.at[row * 2 + 1]!;
      expect(overview.index.locate(x, y), overview.provinces.names[row]).toBe(row);
      expect(detail.provinceIndex.locate(x, y), overview.provinces.names[row]).toBe(row);
    }
  });

  it("agree across levels: a municipality's point lies in its district and its province", () => {
    const { at, parent } = detail.municipalities;
    for (let row = 0; row < 2092; row += 1) {
      expect(detail.districtIndex.locate(at[row * 2]!, at[row * 2 + 1]!)).toBe(parent![row]);
      expect(detail.provinceIndex.locate(at[row * 2]!, at[row * 2 + 1]!)).toBe(detail.provinceOf[row]);
    }
  });
});

describe("places", () => {
  it("lie inside the municipality they are filed under", () => {
    for (let row = 0; row < places.count; row += 1) {
      expect(municipalityIndex.locate(places.at[row * 2]!, places.at[row * 2 + 1]!), places.names[row]).toBe(
        places.municipality[row],
      );
    }
  });

  it("come largest first", () => {
    for (let row = 1; row < places.count; row += 1) {
      expect(places.rank[row]!).toBeLessThanOrEqual(places.rank[row - 1]!);
    }
    expect(places.names[0]).toBe("Wien");
  });

  it("mark Vienna and the eight provincial capitals", () => {
    const capitals = [...places.names].filter((_, row) => places.capital[row]! > 0);
    expect(capitals.sort()).toEqual(
      ["Bregenz", "Eisenstadt", "Graz", "Innsbruck", "Klagenfurt am Wörthersee", "Linz", "Salzburg", "St. Pölten", "Wien"].sort(),
    );
    expect(places.capital[places.names.indexOf("Wien")]).toBe(2);
  });

  it("rank the six cities over 100 000 by today's population, Klagenfurt among them", () => {
    const large = [...places.names].filter((_, row) => places.rank[row]! >= 100_000);
    expect(large).toEqual(["Wien", "Graz", "Linz", "Salzburg", "Innsbruck", "Klagenfurt am Wörthersee"]);
  });

  it("give a place its municipality's population only where it is the municipality's namesake", () => {
    const fact = places.facts.find((entry) => entry.key === "municipality_population")!;
    const residents = population(detail.municipalities);
    let seats = 0;
    for (let row = 0; row < places.count; row += 1) {
      if (fact.values[row] === 0) continue;
      seats += 1;
      expect(fact.values[row]).toBe(residents[places.municipality[row]!]);
      expect(places.rank[row]).toBe(fact.values[row]);
    }
    // Most municipalities are named after a place in them.
    expect(seats).toBeGreaterThan(1800);
    expect(new Set([...places.kind])).toEqual(new Set([0, 1, 2]));
  });
});

describe("rivers", () => {
  const sets: Array<[string, Rivers]> = [
    ["base", overview.rivers],
    ["rivers-detail", store.riversDetail!],
  ];

  it.each(sets)("%s: label lines run left to right", (_, rivers) => {
    expect(rivers.labels.count).toBeGreaterThan(10);
    for (let line = 0; line < rivers.labels.count; line += 1) {
      const first = rivers.labels.start[line]!;
      const last = rivers.labels.start[line + 1]! - 1;
      expect(rivers.labels.xy[last * 2]!).toBeGreaterThanOrEqual(rivers.labels.xy[first * 2]!);
    }
  });

  it.each(sets)("%s: every line and every label line has a name row and an order", (_, rivers) => {
    expect(rivers.name).toHaveLength(rivers.lines.count);
    expect(rivers.order).toHaveLength(rivers.lines.count);
    expect(rivers.labelName).toHaveLength(rivers.labels.count);
    for (const row of rivers.name) expect(rivers.names[row]).toBeTypeOf("string");
    for (const row of rivers.labelName) expect(rivers.names[row]).not.toBe("");
  });

  it("the overview has label stretches at three levels of smoothing, the detail at one", () => {
    expect(overview.rivers.labelLevel).toHaveLength(overview.rivers.labels.count);
    expect(new Set(overview.rivers.labelLevel)).toEqual(new Set([0, 1, 2]));
    expect(new Set(store.riversDetail!.labelLevel)).toEqual(new Set([0]));
    // A name on the whole country is some 100 units long; the smoothest level has stretches for that.
    const longest = (level: number): number =>
      Math.max(
        ...Array.from({ length: overview.rivers.labels.count }, (_, line) =>
          overview.rivers.labelLevel[line] === level
            ? overview.rivers.labelBoxes[line * 4 + 2]! - overview.rivers.labelBoxes[line * 4]!
            : 0,
        ),
      );
    expect(longest(2)).toBeGreaterThan(300);
  });

  it("keeps the border rivers: the March and the Thaya are on the map", () => {
    expect(overview.rivers.names).toContain("March (Morava)");
    expect(overview.rivers.names).toContain("Thaya (Dyje)");
  });

  it("the overview holds the rivers of order 5 and up, the Danube as the only 9", () => {
    const rivers = overview.rivers;
    expect(Math.min(...rivers.order)).toBe(5);
    const nines = new Set([...rivers.name].filter((_, line) => rivers.order[line] === 9).map((row) => rivers.names[row]));
    expect([...nines]).toEqual(["Donau"]);
    for (const name of ["Donau", "Inn", "Salzach", "Mur", "Drau", "Enns", "Traun"]) expect(rivers.names).toContain(name);
  });

  it("the detail goes down to streams of order 3 and labels only what the overview does not", () => {
    const rivers = store.riversDetail!;
    expect(Math.min(...rivers.order)).toBe(3);
    expect(Math.max(...rivers.order)).toBe(9);
    expect(Math.max(...rivers.labelOrder)).toBeLessThan(5);
    expect(rivers.lines.xy.length).toBeGreaterThan(overview.rivers.lines.xy.length * 3);
  });

  it("the Danube can be lettered along most of its course", () => {
    const rivers = overview.rivers;
    const row = rivers.names.indexOf("Donau");
    let length = 0;
    for (let line = 0; line < rivers.labels.count; line += 1) {
      // The closest-following stretches only; the smoother levels cover the same river again.
      if (rivers.labelName[line] !== row || rivers.labelLevel[line] !== 0) continue;
      for (let point = rivers.labels.start[line]! + 1; point < rivers.labels.start[line + 1]!; point += 1) {
        length += Math.hypot(
          rivers.labels.xy[point * 2]! - rivers.labels.xy[point * 2 - 2]!,
          rivers.labels.xy[point * 2 + 1]! - rivers.labels.xy[point * 2 - 1]!,
        );
      }
    }
    // The Danube runs about 350 km through Austria: 600 units.
    expect(length).toBeGreaterThan(350);
  });
});

describe("terrain", () => {
  it("has 8 bands in the overview and 11 in the detail, from 400 m to 2500 m", () => {
    expect(overview.terrain.levels).toEqual([400, 700, 1000, 1300, 1600, 1900, 2200, 2500]);
    expect(store.terrainDetail!.levels).toHaveLength(11);
    expect(store.terrainDetail!.levels[0]).toBe(400);
    expect(store.terrainDetail!.levels[10]).toBe(2500);
  });

  it("shrinks with height: less ground lies above each higher level", () => {
    const area = (xy: Float32Array, from: number, to: number): number => {
      let total = 0;
      for (let point = from; point < to; point += 1) {
        const next = point + 1 < to ? point + 1 : from;
        total += xy[point * 2]! * xy[next * 2 + 1]! - xy[next * 2]! * xy[point * 2 + 1]!;
      }
      return Math.abs(total) / 2;
    };
    for (const terrain of [overview.terrain, store.terrainDetail!]) {
      const areas = terrain.bands.map((band) => {
        expect(band.closed).toBe(true);
        let total = 0;
        for (let ring = 0; ring < band.count; ring += 1) total += area(band.xy, band.start[ring]!, band.start[ring + 1]!);
        return total;
      });
      for (let level = 1; level < areas.length; level += 1) expect(areas[level]!).toBeLessThan(areas[level - 1]!);
    }
  });
});

describe("packed columns", () => {
  it("are as long as their tables", () => {
    const borders = chunk("borders");
    expect(decodeInts(borders.municipalities.parent!)).toHaveLength(2092);
    expect(decodeInts(borders.districts.parent!)).toHaveLength(94);
    expect(detail.municipalities.at).toHaveLength(2092 * 2);
    expect(places.at).toHaveLength(places.count * 2);
  });
});
