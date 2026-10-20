#!/usr/bin/env node
// Builds the card's map data: the files dist/austria-map-data-*.js.
//
//   node scripts/build-data.mjs                 from the committed inputs
//   node scripts/build-data.mjs --check         fail if dist/ is not current
//   node scripts/build-data.mjs --measure       print the size tables the settings below were picked from
//   node scripts/build-data.mjs --refresh       rebuild every committed input from its download
//   node scripts/build-data.mjs --refresh-borders | --refresh-terrain | --refresh-rivers
//                               | --refresh-places | --refresh-peaks | --refresh-motorways
//                               | --refresh-population
//                               add --download to fetch a file again that is already in .cache/
//
// Two stages. The downloads are large (a 59 MB river network, 58 MB of place
// names, an 18 MB population table), so a refresh step cuts each down to what
// the map can use and commits that as scripts/data/*.gz. The build proper
// reads only those, which is why CI can check dist/ without a download.
//
// Sources, all CC BY 4.0, each pinned to one release:
//   Borders     BEV, Verwaltungsgrenzen (VGD) 1:250 000
//   Terrain     BEV, Digitales Geländehöhenmodell, Höhenraster 500 m
//   Rivers      BMLUK, Flussordnungszahlen NGP 2021 (Gesamtgewässernetz)
//   Places      BEV, Digitales Landschaftsmodell, Namen
//   Motorways   BEV, Digitales Landschaftsmodell, Verkehr
//   Population  Statistik Austria, Bevölkerung zu Jahresbeginn
//
// Everything is drawn in the view-box units of src/map/projection.ts, from
// degrees on Austria's MGI datum without a shift to WGS84. All five sources
// are MGI (or, for the population, not geometry at all), so they agree with
// each other to the metre; against true WGS84 the whole map sits about a
// hundred metres off, which nothing here is measured against.
//
// Needs Node 24 or newer: it imports the card's TypeScript directly, so the
// build and the card share one projection, one data format and one hit test.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { gunzipSync, gzipSync, inflateRawSync } from "node:zlib";

import { ArcIndex, groupSides } from "../src/data/arcs.ts";
import { CHUNK_IDS, DATA_FORMAT, chunkFile, concatLines, decodeInts, decodeLines } from "../src/data/format.ts";
import { MAP_HEIGHT, MAP_WIDTH, project } from "../src/map/projection.ts";
import { gaussKruegerToGeographic } from "./lib/datum.ts";
import { encodeInts, encodeLines, encodePoints } from "./lib/encode.ts";
import { labelStretches } from "./lib/label-lines.ts";
import { PLACE_KINDS, classFloor, nameKey, rankPlaces } from "./lib/places.ts";
import { parseGeoPackageLine, runsInside, simplifyRiver } from "./lib/rivers.ts";
import { joinPieces, lengthOf as roadLength, parseGeoPackageLines, simplifyRoad } from "./lib/roads.ts";
import { parseDbf, parseShapefilePolygons } from "./lib/shapefile.ts";
import {
  GridAccumulator,
  generaliseRings,
  growOutwards,
  isoRings,
  lambertToGeographic,
  parseAsciiGrid,
  smooth,
} from "./lib/terrain.ts";
import {
  borderEdges,
  chain,
  insideTest,
  labelPoint,
  lengthOf,
  nearTest,
  regroup,
  simplifyArc,
  sortArcs,
} from "./lib/topology.ts";

// ---------------------------------------------------------------------------
// Sources. A newer release is a new URL and a new date here, never a silent
// change under the same name.
// ---------------------------------------------------------------------------

const LICENCE = "CC BY 4.0";

const BORDERS = {
  id: "bev-vgd",
  holder: "BEV",
  name: "Verwaltungsgrenzen (VGD) 1:250 000",
  licence: LICENCE,
  stand: "01.04.2026",
  url: "https://www.data.gv.at/datasets/d960f393-0a19-43f7-b2f1-2a79d9fc6fdd",
};
const BORDERS_URL =
  "https://data.bev.gv.at/download/Verwaltungsgrenzen/shp/20260401/VGD_Oesterreich_gen_250_20260402.zip";
const BORDERS_LAYER = "VGD_250_generalisiert";

const TERRAIN = {
  id: "bev-dgm",
  holder: "BEV",
  name: "Digitales Geländehöhenmodell, Höhenraster 500 m",
  licence: LICENCE,
  stand: "15.04.2021",
  url: "https://www.data.gv.at/datasets/e629ae18-8f69-40ab-838a-1c0c60ebe727",
};
const TERRAIN_URL = "https://data.bev.gv.at/download/DGM/DGM_Rasterweite_500m.zip";

const RIVERS = {
  id: "bmluk-ggn",
  holder: "BMLUK",
  name: "Flussordnungszahlen NGP 2021 (Gesamtgewässernetz)",
  licence: LICENCE,
  stand: "2021",
  url: "https://www.data.gv.at/datasets/e73a9425-a833-4579-9e6e-3ca76a1ea943",
};
const RIVERS_URL = "https://docs.umweltbundesamt.at/s/LyrL83Rnzn4M4Cn/download";
const RIVERS_TABLE = "FlussordnungszahlenNGP21";

const PLACES = {
  id: "bev-dlm-namen",
  holder: "BEV",
  name: "Digitales Landschaftsmodell, Namen",
  licence: LICENCE,
  stand: "23.03.2026",
  url: "https://data.bev.gv.at/download/DLM/DLM_20260323/",
};
const PLACES_URL = "https://data.bev.gv.at/download/DLM/DLM_20260323/DLM_7000_NAMEN_20260323.gpkg";
const PLACES_TABLE = "NAM_7100_SIEDLUNG_P";
/** Summits come from the same names file: its landforms, class Berggipfel. */
const PEAKS_TABLE = "NAM_7300_GELAENDEFORM_P";
const PEAK_CODE = 7302;

const ROADS = {
  id: "bev-dlm-verkehr",
  holder: "BEV",
  name: "Digitales Landschaftsmodell, Verkehr",
  licence: LICENCE,
  stand: "23.03.2026",
  url: "https://data.bev.gv.at/download/DLM/DLM_20260323/",
};
const ROADS_URL = "https://data.bev.gv.at/download/DLM/DLM_20260323/DLM_1000_VERKEHR_20260323.gpkg";
const ROADS_TABLE = "VER_1100_STRASSE_L";
/** Bundesstraße A and S: the motorways and expressways, ASFINAG's network. */
const MOTORWAY_CODES = [1101, 1102];

const POPULATION = {
  id: "statistik-bev",
  holder: "Statistik Austria",
  name: "Bevölkerung zu Jahresbeginn 2026",
  licence: LICENCE,
  stand: "01.01.2026",
  url: "https://data.statistik.gv.at/web/meta.jsp?dataset=OGD_bevstandjbab2002_BevStand_2026",
};
const POPULATION_URL = "https://data.statistik.gv.at/data/OGD_bevstandjbab2002_BevStand_2026.csv";

const root = new URL("../", import.meta.url);
const input = (name) => new URL(`scripts/data/${name}`, root);
const cache = (name) => new URL(`.cache/${name}`, root);
const MESH_FILE = input("bev_vgd_mesh.txt.gz");
const GRID_FILE = input("bev_dgm_grid.txt.gz");
const RIVERS_FILE = input("ggn_rivers.txt.gz");
const PLACES_FILE = input("bev_places.txt.gz");
const PEAKS_FILE = input("bev_peaks.txt.gz");
const MOTORWAYS_FILE = input("bev_motorways.txt.gz");
const POPULATION_FILE = input("statistik_population.txt.gz");
const BORDERS_CACHE = cache("borders/VGD_Oesterreich_gen_250.zip");
const TERRAIN_CACHE = cache("terrain/DGM_Rasterweite_500m.zip");
const RIVERS_CACHE = cache("rivers/FlussordnungszahlenNGP21.gpkg");
const PLACES_CACHE = cache("places/DLM_7000_NAMEN_20260323.gpkg");
const ROADS_CACHE = cache("roads/DLM_1000_VERKEHR_20260323.gpkg");
const POPULATION_CACHE = cache("population/OGD_bevstandjbab2002_BevStand_2026.csv");
const DIST = new URL("dist/", root);

// ---------------------------------------------------------------------------
// Settings. Every size below was measured by `--measure` on 2026-10-13; the
// figures are the chunk file as written, and in brackets what a browser
// downloads (gzip, which Home Assistant serves).
// ---------------------------------------------------------------------------

/** One view-box unit is about 585 m on the ground. */
const METRES_PER_UNIT = 585;

// The committed mesh keeps every vertex of the BEV's 1:250 000 borders, on a
// grid of 0.01 units (6 m): 120 000 vertices, the source's own resolution.
const MESH_Q = 0.01;

// Borders for the zoomed-in map: how far a drawn border may stray from the
// BEV's, in units, and the grid its vertices are rounded to.
//
//   tolerance  grid   borders chunk        gemeinden chunk
//   0.03       0.02   160.4 KB ( 95.8)     234.6 KB (166.3)
//   0.03       0.05   145.7 KB ( 82.9)     198.7 KB (131.3)
//   0.06       0.05   142.3 KB ( 80.9)     188.9 KB (125.7)   this one
//   0.10       0.05   135.7 KB ( 76.6)     171.1 KB (115.8)
//   0.10       0.10   132.0 KB ( 70.9)     163.1 KB (100.2)
//   0.20       0.10   113.9 KB ( 61.2)     114.0 KB ( 74.1)
//
// The source is already generalised to 1:250 000, so there is little left to
// take out: halving the tolerance from 0.06 costs 5 % and doubling it saves
// 10 %. At 0.06 (35 m) a border is off by one pixel at the deepest zoom, and
// the 0.05 grid (29 m) is finer than the borders are true. Most of the
// borders chunk is not geometry at all but its two tables: 2092 names,
// codes, label points and populations.
const FINE = { tolerance: 0.06, q: 0.05 };

// Borders for the whole-country view: 250 m, which is under a fifth of a
// pixel on a phone showing the whole country. These are drawn until the
// fine borders load, at SCALES.fineBorders pixels per unit.
const COARSE = { tolerance: 0.25 / (METRES_PER_UNIT / 1000), q: 0.1 };

// Terrain. "Above this height" is one set of rings per level, drawn stacked.
// The overview has cells of 2 units, lightly smoothed, and 8 levels: the
// main valleys and ridges. The detail keeps the grid's own 1-unit cells
// (585 m; the source has a point every 500 m, so there is nothing finer to
// show).
const TERRAIN_OVERVIEW = {
  cell: 2,
  smoothing: 1,
  levels: [400, 700, 1000, 1300, 1600, 1900, 2200, 2500],
  reach: 6,
  tolerance: 0.45,
  minArea: 5,
  q: 0.1,
};
//
//   tolerance  smallest ring  grid   terrain-detail chunk
//   0.08       0.6            0.05   133.2 KB (84.6)
//   0.14       1.2            0.05   116.4 KB (74.6)   this one
//   0.20       2.0            0.05   104.6 KB (67.2)
//   0.20       2.0            0.10    87.8 KB (56.6)
//   0.30       3.0            0.10    75.8 KB (49.8)
//
// The outlines are traced on smoothed 585 m cells, so nothing in them is
// smaller than a unit; 0.14 keeps their curves round at the deepest zoom.
const TERRAIN_DETAIL = {
  cell: 1,
  smoothing: 1.2,
  levels: [400, 610, 820, 1030, 1240, 1450, 1660, 1870, 2080, 2290, 2500],
  reach: 12,
  tolerance: 0.14,
  minArea: 1.2,
  q: 0.05,
};

// The relief for the tilted map: the grid as it is, one cell per unit, in
// steps of 16 m (the highest cell, 3637 m, is step 227), carried three
// cells past the border so the ground does not drop to sea level along it.
//
//   step   reach   relief chunk
//   8 m    3       552 KB (200)
//   16 m   0       523 KB (157)
//   16 m   3       523 KB (162)   this one
//   16 m   8       523 KB (167)
const RELIEF = { step: 16, reach: 3 };

// Summits, by isolation: the distance to the nearest higher summit. A name
// is drawn once its isolation spans about 40 px (src/map/labels.ts), so on
// a card of ordinary size a summit less isolated than 2 units (1.2 km)
// would never be named, even at the deepest zoom.
//
//   isolation at least     summits   peaks chunk
//   0.6 units (351 m)      13 550    458 KB (176)
//   1.0 (585 m)            12 389    417 KB (161)
//   1.5 (878 m)            10 091    338 KB (132)
//   2.0 (1170 m)            7 789    260 KB (102)   this one
const PEAKS = { minIsolation: 2 };

// Motorways: see refreshMotorways.
const MOTORWAY_KEEP = { tolerance: 0.05, minLength: 1 };
const MOTORWAY_Q = 0.05;
/** Isolation of the highest summit, which has none: as good as infinite. */
const UNRIVALLED = 9999;

// Rivers, by stream order (Flussordnungszahl). 9 is the Danube; 7 and 8 the
// Inn, Salzach, Mur, Drau, March, Thaya and Rhine; 6 the Enns, Traun, Mürz
// and their like; 5 the larger side valleys; 4 and 3 are streams.
//
//   lowest order  tolerance  grid   rivers-detail chunk
//   4             0.08       0.05    89.5 KB ( 58.6)
//   4             0.12       0.05    74.0 KB ( 49.3)
//   4             0.20       0.10    54.7 KB ( 35.0)
//   3             0.08       0.05   219.6 KB (139.7)   this one
//   3             0.12       0.05   185.3 KB (119.8)
//   3             0.20       0.10   144.2 KB ( 89.3)
//
// Order 3 more than doubles the chunk, and stays in: the limit set for it
// was 350 KB, and without it a zoomed-in valley has a river and no streams.
// The committed stretches are kept at 0.06, so the drawn tolerance can go
// down to there without a new download.
const RIVER_KEEP = { minOrder: 3, tolerance: 0.06, reach: 1 };
const RIVERS_OVERVIEW = { minOrder: 5, tolerance: 0.5, q: 0.1 };
const RIVERS_DETAIL = { minOrder: 3, tolerance: 0.08, q: 0.05 };
// A name is set along a smoothed stretch of its river, and how much
// smoothing is right depends on the scale: zoomed in, the letters should
// follow the river closely; on the whole country a name is 80 km long, and
// what it follows has to be the river's sweep, not its meanders. So the
// rivers of the overview get stretches at three levels, finest first, and
// the card picks the level by scale (LABEL_SCALES in src/map/labels.ts).
// Streams are only named zoomed in and need one.
const RIVER_LABELS = [
  { step: 0.5, smoothing: 2.5, maxTurn: 50, turnSpan: 3, minLength: 12, tolerance: 0.15 },
  { step: 1, smoothing: 6, maxTurn: 55, turnSpan: 7, minLength: 24, tolerance: 0.3 },
  { step: 1, smoothing: 14, maxTurn: 60, turnSpan: 14, minLength: 50, tolerance: 0.5 },
];
const STREAM_LABELS = [{ step: 0.5, smoothing: 1.5, maxTurn: 55, turnSpan: 2, minLength: 7, tolerance: 0.12 }];
const LABEL_Q = 0.1;

// Label points and places sit on the same grid as the fine borders.
const POINT_Q = FINE.q;
/**
 * A coordinate as the card will read it back: on the grid, and in the single
 * precision the card keeps its geometry in. Every "which unit is this point
 * in?" below is asked of exactly that number, so the build and the card
 * cannot answer differently for a point that sits on a border.
 */
const onGrid = (value) => Math.fround(Math.round(value / POINT_Q) * POINT_Q);
const LABEL_PRECISION = 0.02;

/** Tile size used only to put lines in an order that packs well. */
const SORT_TILE = 40;

/** The capitals, by municipality code: Vienna, and the eight provincial capitals. */
const CAPITALS = new Map([
  ["90001", 2],
  ["10101", 1],
  ["20101", 1],
  ["30201", 1],
  ["40101", 1],
  ["50101", 1],
  ["60101", 1],
  ["70101", 1],
  ["80207", 1],
]);

const args = new Set(process.argv.slice(2));

/**
 * Plain string order, by UTF-16 code unit. Never `localeCompare`: its order
 * comes from the ICU data of the Node that runs it, and CI checks dist/
 * byte for byte on a different Node than the one that wrote it.
 */
const byCodeUnit = (p, q) => (p < q ? -1 : p > q ? 1 : 0);

// ---------------------------------------------------------------------------
// Files
// ---------------------------------------------------------------------------

async function download(url, target, who) {
  if (existsSync(target) && !args.has("--download")) return;
  console.log(`Downloading ${url}`);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${who} answered HTTP ${response.status}`);
  mkdirSync(new URL("./", target), { recursive: true });
  writeFileSync(target, Buffer.from(await response.arrayBuffer()));
}

/** The files of a zip archive, by name. Stored and deflated entries only. */
function unzip(buffer) {
  const files = new Map();
  let end = buffer.length - 22;
  while (end >= 0 && buffer.readUInt32LE(end) !== 0x06054b50) end -= 1;
  if (end < 0) throw new Error("not a zip archive");
  const count = buffer.readUInt16LE(end + 10);
  let at = buffer.readUInt32LE(end + 16);
  for (let entry = 0; entry < count; entry += 1) {
    const method = buffer.readUInt16LE(at + 10);
    const packed = buffer.readUInt32LE(at + 20);
    const nameLength = buffer.readUInt16LE(at + 28);
    const extraLength = buffer.readUInt16LE(at + 30);
    const commentLength = buffer.readUInt16LE(at + 32);
    const local = buffer.readUInt32LE(at + 42);
    const name = buffer.toString("latin1", at + 46, at + 46 + nameLength);
    const start = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
    const data = buffer.subarray(start, start + packed);
    files.set(name, method === 0 ? data : inflateRawSync(data));
    at += 46 + nameLength + extraLength + commentLength;
  }
  return files;
}

/** Write a committed input: text, gzipped, with nothing in it that changes from run to run. */
function writeInput(url, lines) {
  mkdirSync(new URL("./", url), { recursive: true });
  writeFileSync(url, gzipSync(`${lines.join("\n")}\n`, { level: 9 }));
  console.log(`  wrote ${fileURLToPath(url).replace(fileURLToPath(root), "")}`);
}

/** The data lines of a committed input, without its comments. */
function readInput(url) {
  return gunzipSync(readFileSync(url))
    .toString("utf8")
    .split("\n")
    .filter((line) => line !== "" && !line.startsWith("#"));
}

const header = (source, what, built) => [
  ...what.map((line) => `# ${line}`),
  `# Source: ${source.holder}, ${source.name}, Stand ${source.stand}, ${source.licence}.`,
  `# ${source.url}`,
  `# Built by scripts/build-data.mjs ${built}. Do not edit.`,
];

/** Austria Lambert metres to view-box units. */
const fromLambert = ([easting, northing]) => {
  const [latitude, longitude] = lambertToGeographic(easting, northing);
  return project(latitude, longitude);
};

// ---------------------------------------------------------------------------
// Refresh: borders
// ---------------------------------------------------------------------------

/** Cut the BEV's cadastral polygons down to the mesh of municipality borders. */
async function refreshBorders() {
  await download(BORDERS_URL, BORDERS_CACHE, "BEV");
  const files = unzip(readFileSync(BORDERS_CACHE));
  const shapes = parseShapefilePolygons(files.get(`${BORDERS_LAYER}.shp`));
  const records = parseDbf(files.get(`${BORDERS_LAYER}.dbf`));
  if (shapes.length !== records.length) throw new Error("shapes and records differ in number");

  // Everything is keyed by the municipality code. Names are not unique: the
  // release has 2092 codes and only 2089 distinct names.
  const byCode = new Map();
  for (const record of records) {
    const known = byCode.get(record.GKZ);
    const unit = {
      code: record.GKZ,
      name: record.PG,
      district: record.BKZ,
      districtName: record.PB,
      province: record.BL_KZ,
      provinceName: record.BL,
    };
    if (known !== undefined && JSON.stringify(known) !== JSON.stringify(unit)) {
      throw new Error(`municipality ${record.GKZ} is described in two ways`);
    }
    byCode.set(record.GKZ, unit);
  }
  const units = [...byCode.values()].sort((p, q) => byCodeUnit(p.code, q.code));
  const row = new Map(units.map((unit, index) => [unit.code, index]));

  const { edges, strays } = borderEdges(
    shapes.map((rings, index) => ({ unit: row.get(records[index].GKZ), rings })),
  );
  if (strays > 0) throw new Error(`${strays} border edges are claimed more than twice or run the same way twice`);
  const metres = chain(edges);
  const arcs = sortArcs(
    metres.map((arc) => ({ a: arc.a, b: arc.b, points: arc.points.map(fromLambert) })),
    SORT_TILE,
  );

  const grid = (value) => Math.round(value / MESH_Q);
  const lines = header(
    BORDERS,
    [
      `The borders between Austria's ${units.length} municipalities, as arcs between junctions.`,
      `unit: municipality code and name, district code and name, province code and name.`,
      `arc:  the rows of the two units it separates (-1 is abroad), its first point, then steps;`,
      `      all in ${MESH_Q} view-box units of src/map/projection.ts.`,
    ],
    "--refresh-borders",
  );
  for (const unit of units) {
    lines.push(["unit", unit.code, unit.name, unit.district, unit.districtName, unit.province, unit.provinceName].join("\t"));
  }
  let vertices = 0;
  for (const arc of arcs) {
    let x = 0;
    let y = 0;
    const steps = [];
    for (const point of arc.points) {
      const gx = grid(point[0]);
      const gy = grid(point[1]);
      steps.push(`${gx - x},${gy - y}`);
      x = gx;
      y = gy;
    }
    vertices += steps.length;
    lines.push(["arc", arc.a, arc.b, steps.join(" ")].join("\t"));
  }
  writeInput(MESH_FILE, lines);
  const km = (arcs.reduce((sum, arc) => sum + lengthOf(arc.points), 0) * METRES_PER_UNIT) / 1000;
  console.log(
    `  ${shapes.length} cadastral polygons, ${units.length} municipalities, ` +
      `${arcs.length} arcs, ${vertices} vertices, ${Math.round(km)} km of border`,
  );
}

/** The committed mesh: units, and arcs in view-box units. */
function readMesh() {
  const units = [];
  const arcs = [];
  for (const line of readInput(MESH_FILE)) {
    const fields = line.split("\t");
    if (fields[0] === "unit") {
      const [, code, name, district, districtName, province, provinceName] = fields;
      units.push({ code, name, district, districtName, province, provinceName });
    } else if (fields[0] === "arc") {
      let x = 0;
      let y = 0;
      const points = fields[3].split(" ").map((step) => {
        const [dx, dy] = step.split(",").map(Number);
        x += dx;
        y += dy;
        return [x * MESH_Q, y * MESH_Q];
      });
      arcs.push({ a: Number(fields[1]), b: Number(fields[2]), points });
    }
  }
  return { units, arcs };
}

/** Districts and provinces as tables of their own, and each unit's row in them. */
function levels(units) {
  const districtCodes = [...new Set(units.map((unit) => unit.district))].sort();
  const provinceCodes = [...new Set(units.map((unit) => unit.province))].sort();
  const districts = districtCodes.map((code) => {
    const member = units.find((unit) => unit.district === code);
    return { code, name: member.districtName, province: provinceCodes.indexOf(member.province) };
  });
  const provinces = provinceCodes.map((code) => ({
    code: `AT-${code}`,
    name: units.find((unit) => unit.province === code).provinceName,
  }));
  const districtOf = Int32Array.from(units, (unit) => districtCodes.indexOf(unit.district));
  const provinceOfDistrict = Int32Array.from(districts, (district) => district.province);
  const provinceOf = Int32Array.from(districtOf, (district) => provinceOfDistrict[district]);
  return { districts, provinces, districtOf, provinceOfDistrict, provinceOf };
}

// ---------------------------------------------------------------------------
// Refresh: terrain
// ---------------------------------------------------------------------------

/** Average the BEV's tiles into one grid in the map's own coordinates. */
async function refreshTerrain() {
  await download(TERRAIN_URL, TERRAIN_CACHE, "BEV");
  const cell = TERRAIN_DETAIL.cell;
  const columns = Math.ceil(MAP_WIDTH / cell);
  const rows = Math.ceil(MAP_HEIGHT / cell);
  const accumulator = new GridAccumulator(columns, rows, cell);
  let samples = 0;
  for (const [name, data] of unzip(readFileSync(TERRAIN_CACHE))) {
    if (!name.endsWith(".asc")) continue;
    const tile = parseAsciiGrid(data.toString("latin1"));
    for (let row = 0; row < tile.rows; row += 1) {
      for (let column = 0; column < tile.columns; column += 1) {
        const elevation = tile.values[row * tile.columns + column];
        if (elevation === tile.noData) continue;
        const [x, y] = fromLambert([
          tile.left + (column + 0.5) * tile.cellSize,
          tile.bottom + (tile.rows - row - 0.5) * tile.cellSize,
        ]);
        accumulator.add(x, y, elevation);
        samples += 1;
      }
    }
  }
  if (samples < 300000) throw new Error(`only ${samples} elevation samples; expected about 362 000`);
  const grid = accumulator.toGrid();
  const lines = header(
    TERRAIN,
    [
      `Mean ground elevation in metres per ${cell} x ${cell} view-box units of src/map/projection.ts.`,
      `0 means no data (outside Austria). Rows run north to south.`,
    ],
    "--refresh-terrain",
  );
  lines.push(`columns ${columns} rows ${rows} cell ${cell}`);
  for (let row = 0; row < rows; row += 1) {
    const cells = [];
    for (let column = 0; column < columns; column += 1) {
      const value = grid.values[row * columns + column];
      cells.push(Number.isNaN(value) ? 0 : Math.max(1, Math.round(value)));
    }
    lines.push(cells.join(" "));
  }
  writeInput(GRID_FILE, lines);
  console.log(`  averaged ${samples} elevation samples into ${columns} x ${rows} cells`);
}

function readGrid() {
  const lines = readInput(GRID_FILE);
  const head = /^columns (\d+) rows (\d+) cell (\d+)$/.exec(lines[0]);
  if (head === null) throw new Error("unexpected terrain grid header");
  const columns = Number(head[1]);
  const rows = Number(head[2]);
  const values = new Float64Array(columns * rows);
  lines.slice(1).forEach((line, row) => {
    line.split(" ").forEach((token, column) => {
      values[row * columns + column] = token === "0" ? Number.NaN : Number(token);
    });
  });
  return { columns, rows, cell: Number(head[3]), values };
}

/** The grid at a coarser cell: the mean of the cells that have data. */
function coarsen(grid, factor) {
  if (factor === 1) return grid;
  const columns = Math.ceil(grid.columns / factor);
  const rows = Math.ceil(grid.rows / factor);
  const values = new Float64Array(columns * rows).fill(Number.NaN);
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      let sum = 0;
      let count = 0;
      for (let dy = 0; dy < factor; dy += 1) {
        for (let dx = 0; dx < factor; dx += 1) {
          const c = column * factor + dx;
          const r = row * factor + dy;
          if (c >= grid.columns || r >= grid.rows) continue;
          const value = grid.values[r * grid.columns + c];
          if (Number.isNaN(value)) continue;
          sum += value;
          count += 1;
        }
      }
      if (count > 0) values[row * columns + column] = sum / count;
    }
  }
  return { columns, rows, cell: grid.cell * factor, values };
}

/** One set of rings per level. */
function terrainRings(grid, settings) {
  const source = coarsen(grid, settings.cell / grid.cell);
  const terrain = smooth(growOutwards(source, settings.reach), settings.smoothing);
  return settings.levels.map((level) =>
    generaliseRings(isoRings(terrain, level, settings.cell), settings.tolerance, settings.minArea),
  );
}

function packRelief(grid, settings) {
  const grown = growOutwards(grid, settings.reach);
  const steps = [];
  for (let row = 0; row < grid.rows; row += 1) {
    let previous = 0;
    for (let column = 0; column < grid.columns; column += 1) {
      const metres = grown.values[row * grid.columns + column];
      const value = Number.isNaN(metres) ? 0 : Math.max(1, Math.round(metres / settings.step));
      steps.push(value - previous);
      previous = value;
    }
  }
  return { columns: grid.columns, rows: grid.rows, step: settings.step, d: encodeInts(steps) };
}

/**
 * The summits worth naming, most prominent first. A major summit (the
 * BEV's own judgement) counts as twice as isolated, so the Dachstein is
 * named before a lone hill of the same isolation in the Waldviertel.
 */
function packPeaks(peaks, settings) {
  // Highest first, so every higher summit comes before.
  const isolation = peaks.map((peak, index) => {
    let nearest = Infinity;
    for (let other = 0; other < index; other += 1) {
      const distance = Math.hypot(peaks[other].x - peak.x, peaks[other].y - peak.y);
      if (distance < nearest) nearest = distance;
    }
    return Math.min(UNRIVALLED, Math.round(nearest * 10));
  });
  const rank = (index) => isolation[index] * (peaks[index].major ? 2 : 1);
  const kept = peaks
    .map((_, index) => index)
    .filter((index) => isolation[index] >= settings.minIsolation * 10 || peaks[index].major)
    .sort((p, q) => rank(q) - rank(p) || peaks[q].height - peaks[p].height || p - q);
  return {
    names: kept.map((index) => peaks[index].name),
    at: encodePoints(kept.map((index) => [onGrid(peaks[index].x), onGrid(peaks[index].y)]), POINT_Q),
    isolation: encodeInts(kept.map((index) => isolation[index])),
    major: encodeInts(kept.map((index) => peaks[index].major)),
    facts: [
      {
        key: "height",
        label: "facts.height",
        format: "metres",
        source: PLACES.id,
        values: encodeInts(kept.map((index) => peaks[index].height)),
      },
    ],
  };
}

/** Motorway strokes and the route each belongs to, A before S, by number. */
function packMotorways(strokes) {
  const refs = [...new Set(strokes.map((stroke) => stroke.ref))];
  const names = refs.map((ref) => strokes.find((stroke) => stroke.ref === ref && stroke.name !== "")?.name ?? "");
  return {
    refs,
    names,
    lines: encodeLines(strokes.map((stroke) => stroke.points), MOTORWAY_Q, { closed: false }),
    route: encodeInts(strokes.map((stroke) => refs.indexOf(stroke.ref))),
  };
}

const packTerrain = (grid, settings) => ({
  levels: settings.levels,
  bands: terrainRings(grid, settings).map((rings) => encodeLines(sortArcs(rings.map((points) => ({ points })), SORT_TILE).map((ring) => ring.points), settings.q, { closed: true })),
});

// ---------------------------------------------------------------------------
// Refresh: rivers
// ---------------------------------------------------------------------------

/** The national border as rings, from the committed mesh. */
function countryRings(mesh) {
  return regroup(mesh.arcs, () => 0).map((arc) => arc.points);
}

/**
 * Cut the river network down to the stretches in Austria or on its border.
 *
 * "On the border" matters: the Inn below Braunau, the Salzach below
 * Salzburg, the March, the Thaya and the Alpine Rhine ARE the border, and a
 * strict "inside" would keep none of them, because their centre line runs a
 * few metres to one side or the other. So a point within RIVER_KEEP.reach of
 * the border counts as well. A river that merely crosses the border runs on
 * for that distance and stops.
 */
async function refreshRivers() {
  await download(RIVERS_URL, RIVERS_CACHE, "Umweltbundesamt");
  // Loaded here and not at the top: only the refresh steps need SQLite.
  const { DatabaseSync } = await import("node:sqlite");
  const database = new DatabaseSync(fileURLToPath(RIVERS_CACHE), { readOnly: true });
  const rows = database
    .prepare(`select FLOZ as "order", GEW_NAME as name, geom from "${RIVERS_TABLE}" where FLOZ >= ? order by fid`)
    .all(RIVER_KEEP.minOrder);
  database.close();

  const border = countryRings(readMesh());
  const insideCountry = insideTest(border);
  const nearBorder = nearTest(border, RIVER_KEEP.reach);
  const lines = header(
    RIVERS,
    [
      `Rivers of stream order ${RIVER_KEEP.minOrder} and higher in Austria or within ${RIVER_KEEP.reach} units of its border,`,
      `in the view-box units of src/map/projection.ts.`,
      `One stretch per line: order, name, points. Simplified to ${RIVER_KEEP.tolerance} units.`,
    ],
    "--refresh-rivers",
  );
  let stretches = 0;
  for (const row of rows) {
    const projected = parseGeoPackageLine(row.geom).map(fromLambert);
    for (const run of runsInside(projected, ([x, y]) => insideCountry(x, y) || nearBorder(x, y))) {
      const points = simplifyRiver(run, RIVER_KEEP.tolerance);
      lines.push(
        [row.order, (row.name ?? "").trim(), points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ")].join("\t"),
      );
      stretches += 1;
    }
  }
  if (stretches < 1000) throw new Error(`only ${stretches} river stretches; expected thousands`);
  writeInput(RIVERS_FILE, lines);
  console.log(`  kept ${stretches} stretches of ${rows.length} river segments of order ${RIVER_KEEP.minOrder} and up`);
}

function readRivers() {
  return readInput(RIVERS_FILE).map((line) => {
    const [order, name, points] = line.split("\t");
    return { order: Number(order), name, points: points.split(" ").map((pair) => pair.split(",").map(Number)) };
  });
}

/**
 * One river set: the stretches of `minOrder` and up, joined into long lines
 * per river and order, simplified, with the lines to set names along.
 * `labelLevels` are the smoothing levels to make those lines at, finest
 * first. `labelBelow` limits them to rivers below that order, for the detail
 * chunk, whose larger rivers are already named by the base chunk.
 */
function packRivers(stretches, settings, labelLevels, labelBelow = Infinity) {
  const wanted = stretches.filter((stretch) => stretch.order >= settings.minOrder);
  const names = [...new Set(wanted.map((stretch) => stretch.name))].sort(byCodeUnit);
  const nameRow = new Map(names.map((name, index) => [name, index]));

  // Join per river and order, so a line has one name and one width. Within
  // one river a confluence is not a junction: the main stem runs through.
  const groups = new Map();
  for (const stretch of wanted) {
    const key = `${stretch.name}\t${stretch.order}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(stretch);
  }
  const lines = [];
  for (const members of groups.values()) {
    const { name, order } = members[0];
    for (const arc of chain(members.map((stretch) => ({ a: 0, b: 1, points: stretch.points })))) {
      lines.push({ name: nameRow.get(name), order, points: simplifyRiver(arc.points, settings.tolerance) });
    }
  }
  const sorted = sortArcs(lines, SORT_TILE);

  // Names along the river: all orders of one name together, so a river
  // whose order changes on the way is still one line to letter.
  const labels = [];
  for (const name of names) {
    if (name === "") continue;
    const members = wanted.filter((stretch) => stretch.name === name);
    const order = Math.max(...members.map((stretch) => stretch.order));
    if (order >= labelBelow) continue;
    labelLevels.forEach((labelSettings, level) => {
      for (const points of labelStretches(members.map((stretch) => stretch.points), labelSettings)) {
        labels.push({ name: nameRow.get(name), order, level, points });
      }
    });
  }
  const sortedLabels = sortArcs(labels, SORT_TILE);

  return {
    names,
    lines: encodeLines(sorted.map((line) => line.points), settings.q, { closed: false, keepShort: true }),
    name: encodeInts(sorted.map((line) => line.name)),
    order: encodeInts(sorted.map((line) => line.order)),
    labels: encodeLines(sortedLabels.map((label) => label.points), LABEL_Q, { closed: false, keepShort: true }),
    labelName: encodeInts(sortedLabels.map((label) => label.name)),
    labelOrder: encodeInts(sortedLabels.map((label) => label.order)),
    labelLevel: encodeInts(sortedLabels.map((label) => label.level)),
  };
}

// ---------------------------------------------------------------------------
// Refresh: population
// ---------------------------------------------------------------------------

/** Sum the population table per municipality. */
async function refreshPopulation() {
  await download(POPULATION_URL, POPULATION_CACHE, "Statistik Austria");
  const rows = readFileSync(POPULATION_CACHE, "utf8").split(/\r?\n/);
  const columns = rows[0].split(";");
  const codeAt = columns.indexOf("C-GRGEMAKT-0");
  const countAt = columns.indexOf("F-ISIS-1");
  if (codeAt < 0 || countAt < 0) throw new Error(`unexpected population header: ${rows[0]}`);
  const sums = new Map();
  for (const row of rows.slice(1)) {
    if (row === "") continue;
    const fields = row.split(";");
    let code = fields[codeAt].replace("GRGEMAKT-", "");
    // Vienna is one municipality (90001) that the table splits into its 23
    // districts (90101 to 92301).
    if (code.startsWith("9")) code = "90001";
    sums.set(code, (sums.get(code) ?? 0) + Number(fields[countAt]));
  }
  const total = [...sums.values()].reduce((sum, value) => sum + value, 0);
  const lines = header(
    POPULATION,
    [`Residents per municipality: code, number. Vienna's 23 districts are summed into 90001.`],
    "--refresh-population",
  );
  lines.push(`total\t${total}`);
  for (const code of [...sums.keys()].sort()) lines.push(`${code}\t${sums.get(code)}`);
  writeInput(POPULATION_FILE, lines);
  console.log(`  ${sums.size} municipalities, ${total} residents`);
}

function readPopulation() {
  const byCode = new Map();
  let total = 0;
  for (const line of readInput(POPULATION_FILE)) {
    const [code, value] = line.split("\t");
    if (code === "total") total = Number(value);
    else byCode.set(code, Number(value));
  }
  return { byCode, total };
}

// ---------------------------------------------------------------------------
// Refresh: places
// ---------------------------------------------------------------------------

/** An index over the municipalities on the committed mesh, at full resolution. */
function meshIndex(mesh) {
  const lines = decodeLines(
    encodeLines(mesh.arcs.map((arc) => arc.points), MESH_Q, { closed: false, keepShort: true }),
  );
  return new ArcIndex(
    lines,
    Int32Array.from(mesh.arcs, (arc) => arc.a),
    Int32Array.from(mesh.arcs, (arc) => arc.b),
    mesh.units.length,
  );
}

/**
 * Pick the settlements worth a dot out of the BEV's 58 000 names: every
 * Stadt and Markt, every Dorf of 2000 residents or more, and the place each
 * municipality is named after, whatever its class.
 */
async function refreshPlaces() {
  await download(PLACES_URL, PLACES_CACHE, "BEV");
  const { DatabaseSync } = await import("node:sqlite");
  const database = new DatabaseSync(fileURLToPath(PLACES_CACHE), { readOnly: true });
  const [{ srs }] = database
    .prepare(`select srs_id as srs from gpkg_geometry_columns where table_name = ?`)
    .all(PLACES_TABLE);
  if (srs !== 31255) throw new Error(`place names are in EPSG:${srs}, not MGI / Austria GK Central (31255)`);
  const rows = database
    .prepare(
      `select NAME as name, F_CODE as code, EINWOHNER_KLASSE as size, geom from "${PLACES_TABLE}" ` +
        `where F_CODE in (${Object.keys(PLACE_KINDS).join(",")}) order by OBJECTID`,
    )
    .all();
  database.close();

  const mesh = readMesh();
  const index = meshIndex(mesh);
  const kept = [];
  let outside = 0;
  for (const row of rows) {
    const [x, y] = project(...gpkgPoint(row.geom));
    const municipality = index.locate(x, y);
    if (municipality < 0) {
      outside += 1;
      continue;
    }
    const kind = PLACE_KINDS[row.code];
    const named = nameKey(row.name) === nameKey(mesh.units[municipality].name);
    if (kind === 2 && !named && classFloor(row.size) < 2000) continue;
    kept.push({ kind, name: row.name.trim(), size: row.size, x: x.toFixed(2), y: y.toFixed(2) });
  }
  kept.sort((p, q) => byCodeUnit(p.name, q.name) || Number(p.x) - Number(q.x) || Number(p.y) - Number(q.y));
  const lines = header(
    PLACES,
    [
      `Settlements: every Stadt (0) and Markt (1), every Dorf (2) of 2000 residents or more, and the`,
      `place each municipality is named after. Class, name, the BEV's size class, x, y in the`,
      `view-box units of src/map/projection.ts.`,
    ],
    "--refresh-places",
  );
  for (const place of kept) lines.push([place.kind, place.name, place.size, place.x, place.y].join("\t"));
  writeInput(PLACES_FILE, lines);
  console.log(`  kept ${kept.length} of ${rows.length} settlements (${outside} lie outside every municipality)`);
}

/** A GeoPackage point in MGI / Austria GK Central as latitude and longitude: the header, then byte order, type, x, y. */
function gpkgPoint(blob) {
  const envelope = [0, 32, 48, 48, 64][(blob[3] >> 1) & 7];
  const view = new DataView(blob.buffer, blob.byteOffset + 8 + envelope);
  const little = view.getUint8(0) === 1;
  return gaussKruegerToGeographic(view.getFloat64(5, little), view.getFloat64(13, little));
}

/**
 * Every named summit with a height, from the BEV's landforms: 14 000 of
 * them, 102 marked as major. Kept where the relief grid has ground, so the
 * peaks on the border (Weißkugel, Similaun) stay in.
 */
async function refreshPeaks() {
  await download(PLACES_URL, PLACES_CACHE, "BEV");
  const { DatabaseSync } = await import("node:sqlite");
  const database = new DatabaseSync(fileURLToPath(PLACES_CACHE), { readOnly: true });
  const [{ srs }] = database
    .prepare(`select srs_id as srs from gpkg_geometry_columns where table_name = ?`)
    .all(PEAKS_TABLE);
  if (srs !== 31255) throw new Error(`landforms are in EPSG:${srs}, not MGI / Austria GK Central (31255)`);
  const rows = database
    .prepare(
      `select NAME as name, HOEHE_BODEN as height, BEDEUTUNG as weight, geom from "${PEAKS_TABLE}" ` +
        `where F_CODE = ? and HOEHE_BODEN > 0 and NAME is not null order by OBJECTID`,
    )
    .all(PEAK_CODE);
  database.close();

  const grid = readGrid();
  const kept = [];
  for (const row of rows) {
    const [x, y] = project(...gpkgPoint(row.geom));
    const column = Math.floor(x);
    const line = Math.floor(y);
    if (column < 0 || line < 0 || column >= grid.columns || line >= grid.rows) continue;
    if (Number.isNaN(grid.values[line * grid.columns + column])) continue;
    const major = row.weight === "Bedeutend" ? 1 : 0;
    kept.push({ name: row.name.trim(), height: Math.round(row.height), major, x: x.toFixed(2), y: y.toFixed(2) });
  }
  kept.sort((p, q) => q.height - p.height || byCodeUnit(p.name, q.name) || Number(p.x) - Number(q.x));
  const lines = header(
    PLACES,
    [
      `Summits (Berggipfel) with a height: name, metres, 1 if the BEV marks it as major, x, y in the`,
      `view-box units of src/map/projection.ts. Highest first.`,
    ],
    "--refresh-peaks",
  );
  for (const peak of kept) lines.push([peak.name, peak.height, peak.major, peak.x, peak.y].join("\t"));
  writeInput(PEAKS_FILE, lines);
  console.log(`  kept ${kept.length} of ${rows.length} summits`);
}

/**
 * Motorways and expressways. The BEV draws each carriageway, slip road and
 * junction loop as pieces of a few hundred metres; per route they are
 * joined into long strokes, simplified to a twentieth of a unit (30 m), and
 * what is still shorter than a unit (585 m) is dropped: the slip roads and
 * loops, which are a blot at any scale the map shows. The two carriageways
 * of a route, 20 to 40 m apart, stay two strokes that draw as one.
 */
async function refreshMotorways() {
  await download(ROADS_URL, ROADS_CACHE, "BEV");
  const { DatabaseSync } = await import("node:sqlite");
  const database = new DatabaseSync(fileURLToPath(ROADS_CACHE), { readOnly: true });
  const [{ srs }] = database
    .prepare(`select srs_id as srs from gpkg_geometry_columns where table_name = ?`)
    .all(ROADS_TABLE);
  if (srs !== 31255) throw new Error(`roads are in EPSG:${srs}, not MGI / Austria GK Central (31255)`);
  const rows = database
    .prepare(
      `select KURZBEZ_NAT as ref, NAME as name, geom from "${ROADS_TABLE}" ` +
        `where F_CODE in (${MOTORWAY_CODES.join(",")}) and KURZBEZ_NAT is not null order by OBJECTID`,
    )
    .all();
  database.close();

  const byRef = new Map();
  for (const row of rows) {
    const ref = row.ref.replace(/\s+/g, "");
    if (!/^[AS]\d+$/.test(ref)) continue;
    let route = byRef.get(ref);
    if (route === undefined) byRef.set(ref, (route = { pieces: [], names: new Map() }));
    for (const line of parseGeoPackageLines(row.geom)) {
      if (line.length > 1) route.pieces.push(line.map(([e, n]) => project(...gaussKruegerToGeographic(e, n))));
    }
    const name = (row.name ?? "").trim();
    // The route's own name is the one most of its pieces carry; slip roads carry place names.
    if (/Autobahn|Schnellstraße|[Tt]angente/.test(name)) route.names.set(name, (route.names.get(name) ?? 0) + 1);
  }
  const lines = header(
    ROADS,
    [
      `Motorways (A) and expressways (S): route, name, points in the view-box units of`,
      `src/map/projection.ts. Pieces joined per route, simplified to ${MOTORWAY_KEEP.tolerance} units,`,
      `strokes shorter than ${MOTORWAY_KEEP.minLength} units dropped.`,
    ],
    "--refresh-motorways",
  );
  let strokes = 0;
  for (const ref of [...byRef.keys()].sort((p, q) => byCodeUnit(p[0], q[0]) || Number(p.slice(1)) - Number(q.slice(1)))) {
    const route = byRef.get(ref);
    const name = [...route.names].sort((p, q) => q[1] - p[1])[0]?.[0] ?? "";
    for (const line of joinPieces(route.pieces)) {
      if (roadLength(line) < MOTORWAY_KEEP.minLength) continue;
      const points = simplifyRoad(line, MOTORWAY_KEEP.tolerance);
      lines.push([ref, name, points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ")].join("\t"));
      strokes += 1;
    }
  }
  if (byRef.size < 20) throw new Error(`only ${byRef.size} motorway routes; expected about 30`);
  writeInput(MOTORWAYS_FILE, lines);
  console.log(`  kept ${strokes} strokes on ${byRef.size} routes from ${rows.length} road pieces`);
}

function readMotorways() {
  return readInput(MOTORWAYS_FILE).map((line) => {
    const [ref, name, points] = line.split("\t");
    return { ref, name, points: points.split(" ").map((pair) => pair.split(",").map(Number)) };
  });
}

function readPeaks() {
  return readInput(PEAKS_FILE).map((line) => {
    const [name, height, major, x, y] = line.split("\t");
    return { name, height: Number(height), major: Number(major), x: Number(x), y: Number(y) };
  });
}

function readPlaces() {
  return readInput(PLACES_FILE).map((line) => {
    const [kind, name, sizeClass, x, y] = line.split("\t");
    return { kind: Number(kind), name, sizeClass, x: Number(x), y: Number(y) };
  });
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

const packArcs = (arcs, q) => ({
  lines: encodeLines(arcs.map((arc) => arc.points), q, { closed: false, keepShort: true }),
  a: encodeInts(arcs.map((arc) => arc.a)),
  b: encodeInts(arcs.map((arc) => arc.b)),
});

const populationFact = (values) => ({
  key: "population",
  label: "facts.population",
  format: "integer",
  source: POPULATION.id,
  values: encodeInts(values),
});

/** The label point of every group of an index, checked against the index itself. */
function labelPoints(index, names) {
  return names.map((name, group) => {
    const rings = index.rings(group);
    if (rings.length === 0) throw new Error(`${name} has no outline`);
    const [x, y] = labelPoint(rings, LABEL_PRECISION);
    const rounded = [onGrid(x), onGrid(y)];
    if (index.locate(rounded[0], rounded[1]) !== group) {
      throw new Error(`the label point of ${name} does not lie in ${name}`);
    }
    return rounded;
  });
}

/** The fine borders, split by level, and the index the card will build from them. */
function fineBorders(mesh, level, settings) {
  const simplified = mesh.arcs.map((arc) => ({ ...arc, points: simplifyArc(arc.points, settings.tolerance) }));
  const upper = sortArcs(simplified.filter((arc) => level(arc) < 3), SORT_TILE);
  const lower = sortArcs(simplified.filter((arc) => level(arc) === 3), SORT_TILE);
  return { upper: packArcs(upper, settings.q), lower: packArcs(lower, settings.q) };
}

function build(settings = {}) {
  const fine = settings.fine ?? FINE;
  const terrainDetail = settings.terrainDetail ?? TERRAIN_DETAIL;
  const riversDetail = settings.riversDetail ?? RIVERS_DETAIL;

  const mesh = readMesh();
  const { districts, provinces, districtOf, provinceOfDistrict, provinceOf } = levels(mesh.units);
  if (provinces.length !== 9) throw new Error(`${provinces.length} provinces, not 9`);

  // Population, one to one with the borders or not at all.
  const population = readPopulation();
  const missing = mesh.units.filter((unit) => !population.byCode.has(unit.code)).map((unit) => unit.code);
  const extra = [...population.byCode.keys()].filter((code) => !mesh.units.some((unit) => unit.code === code));
  if (missing.length > 0 || extra.length > 0) {
    throw new Error(
      `borders and population disagree about the municipalities: ` +
        `no population for ${missing.join(", ") || "none"}; no border for ${extra.join(", ") || "none"}`,
    );
  }
  const residents = mesh.units.map((unit) => population.byCode.get(unit.code));
  const sumBy = (groupOf, count) => {
    const sums = new Array(count).fill(0);
    residents.forEach((value, unit) => {
      sums[groupOf[unit]] += value;
    });
    return sums;
  };
  if (residents.reduce((sum, value) => sum + value, 0) !== population.total) {
    throw new Error("the municipalities do not add up to the national population");
  }

  // --- Fine borders, as the card will read them back ---
  const level = (arc) =>
    arc.a < 0 ? 0 : provinceOf[arc.a] !== provinceOf[arc.b] ? 1 : districtOf[arc.a] !== districtOf[arc.b] ? 2 : 3;
  const { upper, lower } = fineBorders(mesh, level, fine);
  const upperLines = decodeLines(upper.lines);
  const lowerLines = decodeLines(lower.lines);
  const upperA = decodeInts(upper.a);
  const upperB = decodeInts(upper.b);
  const municipalityIndex = new ArcIndex(
    concatLines(upperLines, lowerLines),
    Int32Array.from([...upperA, ...decodeInts(lower.a)]),
    Int32Array.from([...upperB, ...decodeInts(lower.b)]),
    mesh.units.length,
  );
  const districtIndex = new ArcIndex(
    upperLines,
    groupSides(upperA, districtOf),
    groupSides(upperB, districtOf),
    districts.length,
  );

  // --- Coarse borders for the whole-country view ---
  const coarse = sortArcs(
    regroup(mesh.arcs, (unit) => provinceOf[unit]).map((arc) => ({
      ...arc,
      points: simplifyArc(arc.points, COARSE.tolerance),
    })),
    SORT_TILE,
  );
  const coarsePacked = packArcs(coarse, COARSE.q);
  const provinceIndex = new ArcIndex(
    decodeLines(coarsePacked.lines),
    decodeInts(coarsePacked.a),
    decodeInts(coarsePacked.b),
    provinces.length,
  );
  const [left, top, right, bottom] = coarse.reduce(
    (box, arc) =>
      arc.points.reduce(
        (inner, [x, y]) => [Math.min(inner[0], x), Math.min(inner[1], y), Math.max(inner[2], x), Math.max(inner[3], y)],
        box,
      ),
    [Infinity, Infinity, -Infinity, -Infinity],
  );
  if (left < 10 || top < 10 || right > MAP_WIDTH - 10 || bottom > MAP_HEIGHT - 10) {
    throw new Error(`the outline leaves the ${MAP_WIDTH}x${MAP_HEIGHT} view box margin; refit src/map/projection.ts`);
  }

  // --- Tables ---
  const provinceTable = {
    ids: provinces.map((province) => province.code),
    names: provinces.map((province) => province.name),
    at: encodePoints(labelPoints(provinceIndex, provinces.map((province) => province.name)), POINT_Q),
    facts: [populationFact(sumBy(provinceOf, provinces.length))],
  };
  const districtTable = {
    ids: districts.map((district) => district.code),
    names: districts.map((district) => district.name),
    parent: encodeInts(provinceOfDistrict),
    at: encodePoints(labelPoints(districtIndex, districts.map((district) => district.name)), POINT_Q),
    facts: [populationFact(sumBy(districtOf, districts.length))],
  };
  const municipalityTable = {
    ids: mesh.units.map((unit) => unit.code),
    names: mesh.units.map((unit) => unit.name),
    parent: encodeInts(districtOf),
    at: encodePoints(labelPoints(municipalityIndex, mesh.units.map((unit) => `${unit.name} (${unit.code})`)), POINT_Q),
    facts: [populationFact(residents)],
  };

  // --- Places ---
  const located = [];
  let adrift = 0;
  for (const place of readPlaces()) {
    const x = onGrid(place.x);
    const y = onGrid(place.y);
    const municipality = municipalityIndex.locate(x, y);
    // A place on the very border can fall outside once the border is simplified.
    if (municipality < 0) adrift += 1;
    else located.push({ ...place, x, y, municipality });
  }
  if (adrift > located.length / 100) throw new Error(`${adrift} places lie outside every municipality`);
  const places = rankPlaces(located, municipalityTable.names, residents);
  const seated = new Set(places.filter((place) => place.seat).map((place) => place.municipality));
  if (seated.size < mesh.units.length * 0.8) {
    throw new Error(`only ${seated.size} of ${mesh.units.length} municipalities have a place of their name in them`);
  }
  const capitalOf = (place) => (place.seat ? (CAPITALS.get(mesh.units[place.municipality].code) ?? 0) : 0);
  if (places.filter((place) => capitalOf(place) > 0).length !== CAPITALS.size) {
    throw new Error("not every capital was found among the places");
  }
  const placeTable = {
    names: places.map((place) => place.name),
    at: encodePoints(places.map((place) => [place.x, place.y]), POINT_Q),
    kind: encodeInts(places.map((place) => place.kind)),
    capital: encodeInts(places.map(capitalOf)),
    municipality: encodeInts(places.map((place) => place.municipality)),
    rank: encodeInts(places.map((place) => place.rank)),
    facts: [
      {
        key: "municipality_population",
        label: "facts.municipality_population",
        format: "integer",
        source: POPULATION.id,
        values: encodeInts(places.map((place) => (place.seat ? residents[place.municipality] : 0))),
      },
    ],
  };

  // --- Terrain and rivers ---
  const grid = readGrid();
  const stretches = readRivers();

  const head = (id, sources) => ({ format: DATA_FORMAT, id, sources });
  const chunks = {
    base: {
      ...head("base", [BORDERS, TERRAIN, RIVERS, POPULATION]),
      provinces: provinceTable,
      arcs: coarsePacked,
      terrain: packTerrain(grid, TERRAIN_OVERVIEW),
      rivers: packRivers(stretches, RIVERS_OVERVIEW, RIVER_LABELS),
    },
    borders: {
      ...head("borders", [BORDERS, POPULATION]),
      districts: districtTable,
      municipalities: municipalityTable,
      arcs: upper,
    },
    gemeinden: { ...head("gemeinden", [BORDERS]), arcs: lower },
    "terrain-detail": { ...head("terrain-detail", [TERRAIN]), terrain: packTerrain(grid, terrainDetail) },
    "rivers-detail": {
      ...head("rivers-detail", [RIVERS]),
      rivers: packRivers(stretches, riversDetail, STREAM_LABELS, RIVERS_OVERVIEW.minOrder),
    },
    places: { ...head("places", [PLACES, POPULATION]), places: placeTable },
    relief: { ...head("relief", [TERRAIN]), relief: packRelief(grid, RELIEF) },
    peaks: { ...head("peaks", [PLACES]), peaks: packPeaks(readPeaks(), PEAKS) },
    motorways: { ...head("motorways", [ROADS]), motorways: packMotorways(readMotorways()) },
  };

  const files = new Map();
  for (const id of CHUNK_IDS) {
    const chunk = chunks[id];
    const credit = chunk.sources.map((source) => `${source.holder}, ${source.name} (${source.stand})`).join("; ");
    files.set(
      id,
      `/*! Austria Map Card, map data "${id}". ${credit}. ${LICENCE}. ` +
        `Generated by scripts/build-data.mjs: do not edit. */\n` +
        `export default ${JSON.stringify(chunk)};\n`,
    );
  }
  return {
    files,
    counts: {
      municipalities: mesh.units.length,
      districts: districts.length,
      provinces: provinces.length,
      places: places.length,
      seats: seated.size,
      adrift,
      residents: population.total,
    },
  };
}

const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;
const sizes = (text) => `${kb(Buffer.byteLength(text))} (${kb(gzipSync(text, { level: 9 }).length)})`;

/** The tables behind the settings at the top of this file. */
function measure() {
  const size = (settings, id) => sizes(build(settings).files.get(id));
  console.log("Fine borders: tolerance, grid -> borders chunk, gemeinden chunk");
  for (const [tolerance, q] of [[0.03, 0.02], [0.03, 0.05], [0.06, 0.05], [0.1, 0.05], [0.1, 0.1], [0.2, 0.1]]) {
    const { files } = build({ fine: { tolerance, q } });
    console.log(`  ${tolerance}  ${q}  ${sizes(files.get("borders"))}  ${sizes(files.get("gemeinden"))}`);
  }
  console.log("Terrain detail: tolerance, smallest ring, grid -> chunk");
  for (const [tolerance, minArea, q] of [[0.08, 0.6, 0.05], [0.14, 1.2, 0.05], [0.2, 2, 0.05], [0.2, 2, 0.1], [0.3, 3, 0.1]]) {
    console.log(`  ${tolerance}  ${minArea}  ${q}  ${size({ terrainDetail: { ...TERRAIN_DETAIL, tolerance, minArea, q } }, "terrain-detail")}`);
  }
  console.log("Rivers detail: lowest order, tolerance, grid -> chunk");
  for (const [minOrder, tolerance, q] of [[4, 0.08, 0.05], [4, 0.12, 0.05], [4, 0.2, 0.1], [3, 0.08, 0.05], [3, 0.12, 0.05], [3, 0.2, 0.1]]) {
    console.log(`  ${minOrder}  ${tolerance}  ${q}  ${size({ riversDetail: { minOrder, tolerance, q } }, "rivers-detail")}`);
  }
}

// ---------------------------------------------------------------------------

const everything = args.has("--refresh");
if (everything || args.has("--refresh-borders")) await refreshBorders();
if (everything || args.has("--refresh-terrain")) await refreshTerrain();
if (everything || args.has("--refresh-population")) await refreshPopulation();
// These two read the committed mesh, so they come after the borders.
if (everything || args.has("--refresh-rivers")) await refreshRivers();
if (everything || args.has("--refresh-places")) await refreshPlaces();
// Reads the committed terrain grid, so after the terrain.
if (everything || args.has("--refresh-peaks")) await refreshPeaks();
if (everything || args.has("--refresh-motorways")) await refreshMotorways();

if (args.has("--measure")) {
  measure();
} else {
  const { files, counts } = build();
  if (args.has("--check")) {
    const stale = CHUNK_IDS.filter((id) => {
      const url = new URL(chunkFile(id), DIST);
      return !existsSync(url) || readFileSync(url, "utf8") !== files.get(id);
    });
    if (stale.length > 0) {
      for (const id of stale) console.error(`stale: dist/${chunkFile(id)}`);
      console.error("Run `npm run build:data` and commit the result.");
      process.exit(1);
    }
    console.log("Map data is current.");
  } else {
    mkdirSync(DIST, { recursive: true });
    for (const id of CHUNK_IDS) writeFileSync(new URL(chunkFile(id), DIST), files.get(id));
    console.log(
      `${counts.provinces} provinces, ${counts.districts} districts, ${counts.municipalities} municipalities, ` +
        `${counts.residents} residents; ${counts.places} places, ${counts.seats} municipalities with a place ` +
        `of their name, ${counts.adrift} places dropped at a border.`,
    );
    console.log("File, size as written (gzip):");
    for (const id of CHUNK_IDS) console.log(`  dist/${chunkFile(id)}  ${sizes(files.get(id))}`);
  }
}
