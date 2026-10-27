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
  CHUNK_IDS,
  DATA_FORMAT,
  concatLines,
  decodeInts,
  decodeLines,
  lineBoxes,
  type ArcSet,
  type Chunk,
  type ChunkId,
  type FactColumn,
  type GlacierSet,
  type LakeSet,
  type Lines,
  type RoadSet,
  type PeakTable,
  type PlaceTable,
  type ReliefGrid,
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
  /** Per name: its length in Austria, among others. */
  readonly facts: readonly Fact[];
  /** Per name: the provinces it runs through, bit n for province row n; 0 where not known. */
  readonly provinces: Int32Array;
  readonly lines: Lines;
  readonly name: Int32Array;
  readonly order: Int32Array;
  readonly boxes: Float32Array;
  readonly labels: Lines;
  readonly labelName: Int32Array;
  readonly labelOrder: Int32Array;
  readonly labelLevel: Int32Array;
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

/** One class of roads: strokes, and the route each belongs to. */
export interface Roads {
  readonly refs: readonly string[];
  readonly names: readonly string[];
  /** Per route: its length, among others. */
  readonly facts: readonly Fact[];
  /** Per route: the provinces it runs through, bit n for province row n. */
  readonly provinces: Int32Array;
  readonly lines: Lines;
  /** Per line: index into `refs`. */
  readonly route: Int32Array;
  /** Per line: left, top, right, bottom. */
  readonly boxes: Float32Array;
}

function readRoads(set: RoadSet): Roads {
  const lines = decodeLines(set.lines);
  return {
    refs: set.refs,
    names: set.names,
    facts: readFacts(set.facts),
    provinces: decodeInts(set.provinces),
    lines,
    route: decodeInts(set.route),
    boxes: lineBoxes(lines),
  };
}

/** Summits, most prominent first. */
export interface Peaks {
  readonly count: number;
  readonly names: readonly string[];
  readonly at: Float32Array;
  /** Tenths of a map unit to the nearest higher summit. */
  readonly isolation: Int32Array;
  readonly major: Int32Array;
  readonly height: Int32Array;
  readonly facts: readonly Fact[];
}

function readPeaks(table: PeakTable): Peaks {
  const facts = readFacts(table.facts);
  return {
    count: table.names.length,
    names: table.names,
    at: decodeLines(table.at).xy,
    isolation: decodeInts(table.isolation),
    major: decodeInts(table.major),
    height:
      facts.find((fact) => fact.key === "height")?.values ?? new Int32Array(table.names.length),
    facts,
  };
}

/** Lakes and reservoirs: rings, and the lake each belongs to. */
export interface Lakes {
  /** One per lake. */
  readonly names: readonly string[];
  /** Where each lake's name goes: x0, y0, x1, y1, ... */
  readonly at: Float32Array;
  readonly rings: Lines;
  /** Per ring: its lake's row in `names`. */
  readonly lake: Int32Array;
  /** Per ring: left, top, right, bottom. */
  readonly boxes: Float32Array;
}

function readLakes(set: LakeSet): Lakes {
  const rings = decodeLines(set.rings);
  return {
    names: set.names,
    at: decodeLines(set.at).xy,
    rings,
    lake: decodeInts(set.lake),
    boxes: lineBoxes(rings),
  };
}

/** Glaciers: their rings, and the names on them. */
export interface Glaciers {
  readonly rings: Lines;
  /** Per ring: the ice field it belongs to. */
  readonly field: Int32Array;
  readonly boxes: Float32Array;
  readonly names: readonly string[];
  readonly at: Float32Array;
  /** Per name: 0 over 6 km long, 1 from 2 to 6 km, 2 under 2 km. */
  readonly size: Int32Array;
}

function readGlaciers(set: GlacierSet): Glaciers {
  const rings = decodeLines(set.rings);
  return {
    rings,
    field: decodeInts(set.field),
    boxes: lineBoxes(rings),
    names: set.names,
    at: decodeLines(set.at).xy,
    size: decodeInts(set.size),
  };
}

/** Ground height in metres, one value per view-box unit; 0 is no data. */
export interface Relief {
  readonly columns: number;
  readonly rows: number;
  readonly metres: Float32Array;
  /** The highest cell, in metres. */
  readonly peak: number;
}

function readRelief(grid: ReliefGrid): Relief {
  const steps = decodeInts(grid.d);
  if (steps.length !== grid.columns * grid.rows) throw new Error("the relief grid is damaged");
  const metres = new Float32Array(steps.length);
  let peak = 0;
  for (let row = 0; row < grid.rows; row += 1) {
    let value = 0;
    for (let column = 0; column < grid.columns; column += 1) {
      const index = row * grid.columns + column;
      value += steps[index] as number;
      const height = value * grid.step;
      metres[index] = height;
      if (height > peak) peak = height;
    }
  }
  return { columns: grid.columns, rows: grid.rows, metres, peak };
}

/**
 * The ground height at a map point, in metres, interpolated between the
 * four nearest cell centres. Off the grid, the nearest edge.
 */
export function heightAt(relief: Relief, x: number, y: number): number {
  const { columns, rows, metres } = relief;
  const fx = Math.min(Math.max(x - 0.5, 0), columns - 1);
  const fy = Math.min(Math.max(y - 0.5, 0), rows - 1);
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const x1 = Math.min(x0 + 1, columns - 1);
  const y1 = Math.min(y0 + 1, rows - 1);
  const tx = fx - x0;
  const ty = fy - y0;
  const at = (c: number, r: number): number => metres[r * columns + c] as number;
  const top = at(x0, y0) * (1 - tx) + at(x1, y0) * tx;
  const bottom = at(x0, y1) * (1 - tx) + at(x1, y1) * tx;
  return top * (1 - ty) + bottom * ty;
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

const readTerrain = (set: TerrainSet): Terrain => ({
  levels: set.levels,
  bands: set.bands.map(decodeLines),
});

function readRivers(set: RiverSet): Rivers {
  const lines = decodeLines(set.lines);
  const labels = decodeLines(set.labels);
  return {
    names: set.names,
    facts: readFacts(set.facts),
    provinces: decodeInts(set.provinces),
    lines,
    name: decodeInts(set.name),
    order: decodeInts(set.order),
    boxes: lineBoxes(lines),
    labels,
    labelName: decodeInts(set.labelName),
    labelOrder: decodeInts(set.labelOrder),
    labelLevel: decodeInts(set.labelLevel),
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
  public relief: Relief | undefined;
  public peaks: Peaks | undefined;
  public motorways: Roads | undefined;
  public mainRoads: Roads | undefined;
  public lakes: Lakes | undefined;
  public glaciers: Glaciers | undefined;

  private readonly loaded = new Map<ChunkId, readonly SourceInfo[]>();
  private municipal: ArcIndex | undefined;

  public has(id: ChunkId): boolean {
    return this.loaded.has(id);
  }

  /**
   * Everything the loaded chunks are made from, each source once.
   *
   * In the chunks' own fixed order, not the order they arrived in: chunks
   * load in parallel, and the credit line under the map must not read
   * differently from one page load to the next.
   */
  public sources(): SourceInfo[] {
    const seen = new Map<string, SourceInfo>();
    for (const id of CHUNK_IDS) {
      for (const source of this.loaded.get(id) ?? [])
        if (!seen.has(source.id)) seen.set(source.id, source);
    }
    return [...seen.values()];
  }

  public source(id: string): SourceInfo | undefined {
    return this.sources().find((source) => source.id === id);
  }

  public add(chunk: Chunk): void {
    if (chunk.format !== DATA_FORMAT) {
      throw new Error(
        `map data "${chunk.id}" is in format ${chunk.format}, this card reads ${DATA_FORMAT}`,
      );
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
      case "relief":
        this.relief = readRelief(chunk.relief);
        break;
      case "peaks":
        this.peaks = readPeaks(chunk.peaks);
        break;
      case "motorways":
        this.motorways = readRoads(chunk.motorways);
        break;
      case "main-roads":
        this.mainRoads = readRoads(chunk.roads);
        break;
      case "lakes":
        this.lakes = readLakes(chunk.lakes);
        break;
      case "glaciers":
        this.glaciers = readGlaciers(chunk.glaciers);
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
    if (
      this.municipal === undefined &&
      this.detail !== undefined &&
      this.municipalArcs !== undefined
    ) {
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
