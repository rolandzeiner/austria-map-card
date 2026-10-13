/**
 * The map data the card has loaded so far, unpacked and ready to draw.
 *
 * Chunks arrive one at a time, in any order. Each is unpacked once, here,
 * and everything derived from it (which arcs bound which unit, the national
 * outline) is worked out on first use and kept.
 *
 * No DOM in here: the preview script and the tests build a store too.
 */
import { ArcIndex, groupSides, joinArcs } from "../data/arcs.ts";
import {
  DATA_FORMAT,
  concatLines,
  decodeInts,
  decodeLines,
  lineBoxes,
  type ArcSet,
  type Chunk,
  type ChunkId,
  type FactColumn,
  type Lines,
  type PlaceTable,
  type RiverSet,
  type SourceInfo,
  type TerrainSet,
  type UnitTable,
} from "../data/format.ts";

export interface Fact {
  readonly key: string;
  readonly label: string;
  readonly format: FactColumn["format"];
  readonly source: string;
  readonly values: Int32Array;
}

/** Provinces, districts or municipalities, one row each. */
export interface Table {
  readonly count: number;
  readonly ids: readonly string[];
  readonly names: readonly string[];
  /** Row in the table one level up; null for provinces. */
  readonly parent: Int32Array | null;
  /** Label point of each row: x0, y0, x1, y1, ... */
  readonly at: Float32Array;
  readonly facts: readonly Fact[];
}

export interface Borders {
  readonly lines: Lines;
  readonly a: Int32Array;
  readonly b: Int32Array;
}

export interface Terrain {
  readonly levels: readonly number[];
  readonly bands: readonly Lines[];
}

export interface Rivers {
  readonly names: readonly string[];
  readonly lines: Lines;
  readonly name: Int32Array;
  readonly order: Int32Array;
  readonly boxes: Float32Array;
  readonly labels: Lines;
  readonly labelName: Int32Array;
  readonly labelOrder: Int32Array;
  readonly labelBoxes: Float32Array;
}

export interface Places {
  readonly count: number;
  readonly names: readonly string[];
  readonly at: Float32Array;
  readonly kind: Int32Array;
  readonly capital: Int32Array;
  readonly municipality: Int32Array;
  readonly rank: Int32Array;
  readonly facts: readonly Fact[];
}

const readFacts = (facts: readonly FactColumn[]): Fact[] =>
  facts.map((fact) => ({ ...fact, values: decodeInts(fact.values) }));

function readTable(table: UnitTable): Table {
  return {
    count: table.ids.length,
    ids: table.ids,
    names: table.names,
    parent: table.parent === undefined ? null : decodeInts(table.parent),
    at: decodeLines(table.at).xy,
    facts: readFacts(table.facts),
  };
}

const readArcs = (set: ArcSet): Borders => ({
  lines: decodeLines(set.lines),
  a: decodeInts(set.a),
  b: decodeInts(set.b),
});

const readTerrain = (set: TerrainSet): Terrain => ({ levels: set.levels, bands: set.bands.map(decodeLines) });

function readRivers(set: RiverSet): Rivers {
  const lines = decodeLines(set.lines);
  const labels = decodeLines(set.labels);
  return {
    names: set.names,
    lines,
    name: decodeInts(set.name),
    order: decodeInts(set.order),
    boxes: lineBoxes(lines),
    labels,
    labelName: decodeInts(set.labelName),
    labelOrder: decodeInts(set.labelOrder),
    labelBoxes: lineBoxes(labels),
  };
}

function readPlaces(table: PlaceTable): Places {
  return {
    count: table.names.length,
    names: table.names,
    at: decodeLines(table.at).xy,
    kind: decodeInts(table.kind),
    capital: decodeInts(table.capital),
    municipality: decodeInts(table.municipality),
    rank: decodeInts(table.rank),
    facts: readFacts(table.facts),
  };
}

/** The arcs of a set that lie on the national border, joined into rings. */
const countryRings = (borders: Borders): Float32Array[] => {
  const arcs: number[] = [];
  for (let arc = 0; arc < borders.lines.count; arc += 1) {
    if ((borders.a[arc] as number) < 0) arcs.push(arc);
  }
  return joinArcs(borders.lines, arcs);
};

/** The whole-country view: provinces and their generalised borders. */
export interface Overview {
  readonly provinces: Table;
  readonly arcs: Borders;
  /** Which province a point is in, on the generalised borders. */
  readonly index: ArcIndex;
  readonly country: Float32Array[];
  readonly terrain: Terrain;
  readonly rivers: Rivers;
}

/** The zoomed-in borders down to districts, and the two finer tables. */
export interface Detail {
  readonly districts: Table;
  readonly municipalities: Table;
  readonly arcs: Borders;
  /** 0 country, 1 province, 2 district: per arc. */
  readonly level: Uint8Array;
  /** Row of each municipality's province. */
  readonly provinceOf: Int32Array;
  readonly districtIndex: ArcIndex;
  readonly provinceIndex: ArcIndex;
  readonly country: Float32Array[];
}

export class MapStore {
  /** Goes up whenever a chunk is added; caches built on the data key on it. */
  public revision = 0;
  public overview: Overview | undefined;
  public detail: Detail | undefined;
  /** The borders between municipalities of one district. */
  public municipalArcs: Borders | undefined;
  public terrainDetail: Terrain | undefined;
  public riversDetail: Rivers | undefined;
  public places: Places | undefined;

  private readonly loaded = new Map<ChunkId, readonly SourceInfo[]>();
  private municipal: ArcIndex | undefined;

  public has(id: ChunkId): boolean {
    return this.loaded.has(id);
  }

  /** Everything the loaded chunks are made from, each source once, in load order. */
  public sources(): SourceInfo[] {
    const seen = new Map<string, SourceInfo>();
    for (const list of this.loaded.values()) {
      for (const source of list) if (!seen.has(source.id)) seen.set(source.id, source);
    }
    return [...seen.values()];
  }

  public source(id: string): SourceInfo | undefined {
    return this.sources().find((source) => source.id === id);
  }

  public add(chunk: Chunk): void {
    if (chunk.format !== DATA_FORMAT) {
      throw new Error(`map data "${chunk.id}" is in format ${chunk.format}, this card reads ${DATA_FORMAT}`);
    }
    if (this.loaded.has(chunk.id)) return;
    switch (chunk.id) {
      case "base": {
        const provinces = readTable(chunk.provinces);
        const arcs = readArcs(chunk.arcs);
        this.overview = {
          provinces,
          arcs,
          index: new ArcIndex(arcs.lines, arcs.a, arcs.b, provinces.count),
          country: countryRings(arcs),
          terrain: readTerrain(chunk.terrain),
          rivers: readRivers(chunk.rivers),
        };
        break;
      }
      case "borders": {
        const districts = readTable(chunk.districts);
        const municipalities = readTable(chunk.municipalities);
        const arcs = readArcs(chunk.arcs);
        const districtOf = municipalities.parent as Int32Array;
        const provinceOf = groupSides(districtOf, districts.parent as Int32Array);
        const provinces = provinceOf.reduce((most, row) => Math.max(most, row), -1) + 1;
        const level = new Uint8Array(arcs.lines.count);
        for (let arc = 0; arc < level.length; arc += 1) {
          const a = arcs.a[arc] as number;
          const b = arcs.b[arc] as number;
          level[arc] = a < 0 ? 0 : provinceOf[a] !== provinceOf[b] ? 1 : 2;
        }
        this.detail = {
          districts,
          municipalities,
          arcs,
          level,
          provinceOf,
          districtIndex: new ArcIndex(
            arcs.lines,
            groupSides(arcs.a, districtOf),
            groupSides(arcs.b, districtOf),
            districts.count,
          ),
          provinceIndex: new ArcIndex(
            arcs.lines,
            groupSides(arcs.a, provinceOf),
            groupSides(arcs.b, provinceOf),
            provinces,
          ),
          country: countryRings(arcs),
        };
        this.municipal = undefined;
        break;
      }
      case "gemeinden":
        this.municipalArcs = readArcs(chunk.arcs);
        this.municipal = undefined;
        break;
      case "terrain-detail":
        this.terrainDetail = readTerrain(chunk.terrain);
        break;
      case "rivers-detail":
        this.riversDetail = readRivers(chunk.rivers);
        break;
      case "places":
        this.places = readPlaces(chunk.places);
        break;
    }
    this.loaded.set(chunk.id, chunk.sources);
    this.revision += 1;
  }

  /**
   * Which municipality a point is in. Needs both border chunks: a
   * municipality is bounded by arcs of every level.
   */
  public get municipalityIndex(): ArcIndex | undefined {
    if (this.municipal === undefined && this.detail !== undefined && this.municipalArcs !== undefined) {
      const upper = this.detail.arcs;
      const lower = this.municipalArcs;
      this.municipal = new ArcIndex(
        concatLines(upper.lines, lower.lines),
        Int32Array.from([...upper.a, ...lower.a]),
        Int32Array.from([...upper.b, ...lower.b]),
        this.detail.municipalities.count,
      );
    }
    return this.municipal;
  }
}
