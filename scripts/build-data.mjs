#!/usr/bin/env node
// Builds the card's map data: the files dist/austria-map-data-*.js.
//
//   node scripts/build-data.mjs                 from the committed inputs
//   node scripts/build-data.mjs --check         fail if dist/ is not current
//   node scripts/build-data.mjs --measure       print the size tables the settings below were picked from
//   node scripts/build-data.mjs --refresh       rebuild every committed input from its download
//   node scripts/build-data.mjs --refresh-borders | --refresh-terrain | --refresh-rivers
//                               | --refresh-places | --refresh-peaks | --refresh-motorways | --refresh-main-roads
//                               | --refresh-population | --refresh-lakes | --refresh-glaciers
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
//   Roads       BEV, Digitales Landschaftsmodell, Verkehr
//   Lakes and glaciers  BEV, Digitales Landschaftsmodell, Bodenbedeckung (names: Namen)
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
import {
  CHUNK_IDS,
  DATA_FORMAT,
  chunkFile,
  concatLines,
  decodeInts,
  decodeLines,
} from "../src/data/format.ts";
import { MAP_HEIGHT, MAP_WIDTH, project } from "../src/map/projection.ts";
import { gaussKruegerToGeographic } from "./lib/datum.ts";
import { encodeInts, encodeLines, encodePoints } from "./lib/encode.ts";
import { ringArea } from "./lib/geometry.ts";
import { parseGeoPackageLines, parseGeoPackagePolygons } from "./lib/geopackage.ts";
import { labelStretches } from "./lib/label-lines.ts";
import { PLACE_KINDS, classFloor, nameKey, rankPlaces } from "./lib/places.ts";
import {
  lengthWhere,
  networks,
  parseGeoPackageLine,
  runsInside,
  simplifyRiver,
} from "./lib/rivers.ts";
import { joinPieces, routeLength, simplifyRoad } from "./lib/roads.ts";
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

const LAND_COVER = {
  id: "bev-dlm-bodenbedeckung",
  holder: "BEV",
  name: "Digitales Landschaftsmodell, Bodenbedeckung",
  licence: LICENCE,
  stand: "23.03.2026",
  url: "https://data.bev.gv.at/download/DLM/DLM_20260323/",
};
const LAND_COVER_URL =
  "https://data.bev.gv.at/download/DLM/DLM_20260323/DLM_5000_BODENBEDECKUNG_20260323.gpkg";
/** Water surfaces, glaciers among them: each class has its own code. */
const WATER_TABLE = "BOD_5300_WASSER_F";
/** "See, Teich": lakes, reservoirs and ponds. */
const LAKE_CODE = 5311;
/** "Gletscher". The outlines carry no names; those come from the names file. */
const GLACIER_CODE = 5331;
const GLACIER_NAMES_TABLE = "NAM_7400_GLETSCHER_P";
/** The names file's glacier classes, longest first: over 6 km, 2 to 6 km, under 2 km. */
const GLACIER_CLASSES = [7401, 7402, 7403];

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
const RIVER_LENGTHS_FILE = input("ggn_river_lengths.txt.gz");
const PLACES_FILE = input("bev_places.txt.gz");
const PEAKS_FILE = input("bev_peaks.txt.gz");
const MOTORWAYS_FILE = input("bev_motorways.txt.gz");
const MAIN_ROADS_FILE = input("bev_main_roads.txt.gz");
const POPULATION_FILE = input("statistik_population.txt.gz");
const LAKES_FILE = input("bev_lakes.txt.gz");
const GLACIERS_FILE = input("bev_glaciers.txt.gz");
const BORDERS_CACHE = cache("borders/VGD_Oesterreich_gen_250.zip");
const TERRAIN_CACHE = cache("terrain/DGM_Rasterweite_500m.zip");
const RIVERS_CACHE = cache("rivers/FlussordnungszahlenNGP21.gpkg");
const PLACES_CACHE = cache("places/DLM_7000_NAMEN_20260323.gpkg");
const ROADS_CACHE = cache("roads/DLM_1000_VERKEHR_20260323.gpkg");
const LAND_COVER_CACHE = cache("land-cover/DLM_5000_BODENBEDECKUNG_20260323.gpkg");
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

// Roads: see refreshRoads.
//
//   main roads: shortest stroke   main-roads chunk (tolerance 0.1, grid 0.05)
//   all                           108.1 KB (63.6)
//   0.1 units (60 m)               76.9 KB (49.2)   this one
//   0.2 units (120 m)              65.3 KB (42.9)
const ROAD_KINDS = {
  motorways: {
    what: "Motorways (A) and expressways (S)",
    // Bundesstraße A and S: ASFINAG's network.
    codes: [1101, 1102],
    ref: /^[AS]\d+$/,
    name: /Autobahn|Schnellstraße|[Tt]angente/,
    tolerance: 0.05,
    minLength: 1,
    q: 0.05,
    minRoutes: 20,
    flag: "--refresh-motorways",
    get file() {
      return MOTORWAYS_FILE;
    },
  },
  "main-roads": {
    what: "Main roads (Landesstraße B, the former Bundesstraßen)",
    codes: [1103],
    ref: /^B\d+[a-z]?$/,
    name: /Straße$/,
    tolerance: 0.1,
    minLength: 0.1,
    q: 0.05,
    minRoutes: 200,
    flag: "--refresh-main-roads",
    get file() {
      return MAIN_ROADS_FILE;
    },
  },
};
/**
 * Two lines of a route closer than this many metres, side by side, are the
 * two carriageways of one road, and its length counts them once. Measured
 * against the published lengths: A1 292.5 km (292), A10 194 (192),
 * S6 107 (105), B3 195 (195). At 40 m the tunnels' two tubes, further
 * apart, would count twice.
 */
const CARRIAGEWAY_PAIR = 80;
/** How far a road or a river runs in a province before it lists it: 1 unit, 585 m. */
const PROVINCE_REACH = 1;

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
/**
 * A river's length in Austria counts the stretches inside the country and
 * those within `reach` units (about 150 m) of the border: the Inn below
 * Braunau and the Salzach run on it, a few metres to one side or the other.
 *
 * Its stretches belong to one river where their ends come within `snap`
 * metres. Side arms and channels (a negative stream order) are left out,
 * and so is a network shorter than `minNetwork` metres: the network has
 * stubs of a river's name at its confluences, and they would make the
 * Ybbs and the Gail look like several rivers. A name on more than one
 * network longer than that is several rivers, like the two Krems, and gets
 * no length.
 */
const RIVER_LENGTH = { reach: 0.25, snap: 10, minNetwork: 1000 };
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
const STREAM_LABELS = [
  { step: 0.5, smoothing: 1.5, maxTurn: 55, turnSpan: 2, minLength: 7, tolerance: 0.12 },
];
const LABEL_Q = 0.1;

// Lakes: the BEV's water surfaces of class "See, Teich", 58 727 polygons,
// nearly all of them ponds. 1223 cover 0.03 km² or more, 715 0.05 km², 332
// 0.1 km². Measured on 2026-10-27:
//
//   smallest lake  tolerance  grid   lakes chunk
//   30 000 m²      0.03       0.02   68.0 KB (45.6)
//   30 000 m²      0.06       0.05   49.5 KB (31.3)   this one
//   50 000 m²      0.03       0.05   49.5 KB (29.6)
//   50 000 m²      0.06       0.05   35.7 KB (23.0)
//   100 000 m²     0.06       0.05   24.2 KB (15.9)
//   100 000 m²     0.10       0.05   18.8 KB (12.7)
//
// About 5 KB of it is the label points: one per lake, 543 of them named.
//
// A 0.03 km² pond is a third of a pixel across at the whole-country view
// and a dozen at the deepest zoom, which is where it is worth having; the
// tolerance is the fine borders', so a shore and a border on it agree.
// Islands smaller than `minIsland` square units (17 000 m²) are left in the
// water. The committed input keeps every lake of `LAKE_KEEP.minArea` and
// up at half the drawn tolerance, so neither needs a new download.
const LAKE_KEEP = { minArea: 30_000, tolerance: 0.03 };
const LAKES_DRAWN = { minArea: 30_000, minIsland: 0.05, tolerance: 0.06, q: 0.05 };

// Glaciers: 1304 outlines of class "Gletscher", 306 km² in all; 590 cover
// 0.03 km² or more. An outline is a whole ice field, often several named
// glaciers that meet, so the names are the names file's points (408 of
// them), each kept where it lies on a drawn glacier or within `reach`
// units of one: 369 are. The other 39 name ice that has melted or is too
// small to draw. Measured on 2026-10-27:
//
//   smallest glacier  tolerance  grid   glaciers chunk
//   30 000 m²         0.03       0.02   59.7 KB (38.4)
//   30 000 m²         0.06       0.05   39.3 KB (23.5)   this one
//   100 000 m²        0.06       0.05   32.0 KB (19.5)
//   100 000 m²        0.10       0.05   23.8 KB (14.9)
//
// The same cut and tolerance as the lakes, for the same reasons.
const GLACIER_KEEP = { minArea: 30_000, tolerance: 0.03 };
const GLACIERS_DRAWN = { minArea: 30_000, minIsland: 0.05, tolerance: 0.06, q: 0.05, reach: 0.5 };

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
  const units = [...byCode.values()].toSorted((p, q) => byCodeUnit(p.code, q.code));
  const row = new Map(units.map((unit, index) => [unit.code, index]));

  const { edges, strays } = borderEdges(
    shapes.map((rings, index) => ({ unit: row.get(records[index].GKZ), rings })),
  );
  if (strays > 0)
    throw new Error(`${strays} border edges are claimed more than twice or run the same way twice`);
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
    lines.push(
      [
        "unit",
        unit.code,
        unit.name,
        unit.district,
        unit.districtName,
        unit.province,
        unit.provinceName,
      ].join("\t"),
    );
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
  const districtCodes = [...new Set(units.map((unit) => unit.district))].toSorted(byCodeUnit);
  const provinceCodes = [...new Set(units.map((unit) => unit.province))].toSorted(byCodeUnit);
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
  if (samples < 300000)
    throw new Error(`only ${samples} elevation samples; expected about 362 000`);
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
    .toSorted((p, q) => rank(q) - rank(p) || peaks[q].height - peaks[p].height || p - q);
  return {
    names: kept.map((index) => peaks[index].name),
    at: encodePoints(
      kept.map((index) => [onGrid(peaks[index].x), onGrid(peaks[index].y)]),
      POINT_Q,
    ),
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

/**
 * Road strokes and the route each belongs to, in route order, with each
 * route's length and the provinces it runs through.
 */
function packRoads(strokes, q, provincesOf) {
  const refs = [...new Set(strokes.map((stroke) => stroke.ref))];
  const names = refs.map(
    (ref) => strokes.find((stroke) => stroke.ref === ref && stroke.name !== "")?.name ?? "",
  );
  const routes = refs.map((ref) => strokes.filter((stroke) => stroke.ref === ref));
  return {
    refs,
    names,
    facts: [
      {
        key: "length",
        label: "facts.length",
        format: "kilometres",
        source: ROADS.id,
        values: encodeInts(routes.map((route) => Math.round(route[0].metres / 100))),
      },
    ],
    provinces: encodeInts(routes.map((route) => provincesOf(route.map((stroke) => stroke.points)))),
    // keepShort: `route` runs parallel to the lines, so none may go missing.
    // A stroke that shrinks to one grid point would otherwise be dropped and
    // every later line would carry the route of the one after it.
    lines: encodeLines(
      strokes.map((stroke) => stroke.points),
      q,
      { closed: false, keepShort: true },
    ),
    route: encodeInts(strokes.map((stroke) => refs.indexOf(stroke.ref))),
  };
}

const packTerrain = (grid, settings) => ({
  levels: settings.levels,
  bands: terrainRings(grid, settings).map((rings) =>
    encodeLines(
      sortArcs(
        rings.map((points) => ({ points })),
        SORT_TILE,
      ).map((ring) => ring.points),
      settings.q,
      { closed: true },
    ),
  ),
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
    .prepare(
      `select FLOZ as "order", GEW_NAME as name, geom from "${RIVERS_TABLE}" where FLOZ >= ? order by fid`,
    )
    .all(RIVER_KEEP.minOrder);
  // Every stretch of a named river, of any order, for its length.
  const named = database
    .prepare(
      `select GEW_NAME as name, geom from "${RIVERS_TABLE}" where FLOZ >= 0 and trim(coalesce(GEW_NAME, '')) <> '' order by fid`,
    )
    .all();
  database.close();

  const border = countryRings(readMesh());
  const insideCountry = insideTest(border);
  const nearBorder = nearTest(border, RIVER_KEEP.reach);
  const onBorder = nearTest(border, RIVER_LENGTH.reach);
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
        [
          row.order,
          (row.name ?? "").trim(),
          points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" "),
        ].join("\t"),
      );
      stretches += 1;
    }
  }
  if (stretches < 1000) throw new Error(`only ${stretches} river stretches; expected thousands`);
  writeInput(RIVERS_FILE, lines);
  console.log(
    `  kept ${stretches} stretches of ${rows.length} river segments of order ${RIVER_KEEP.minOrder} and up`,
  );

  // Lengths in Austria, measured on the network in Lambert metres, before
  // any simplifying: the meanders are the length.
  const byName = new Map();
  for (const row of named) {
    const name = row.name.trim();
    if (!byName.has(name)) byName.set(name, []);
    byName.get(name).push(parseGeoPackageLine(row.geom));
  }
  const keptNames = new Set(readRivers().map((stretch) => stretch.name));
  const inAustria = (point) => {
    const [x, y] = fromLambert(point);
    return insideCountry(x, y) || onBorder(x, y);
  };
  const lengths = header(
    RIVERS,
    [
      `The length of every named river on the map inside Austria, in metres, rounded to 100 m: name, metres.`,
      `Stretches within ${RIVER_LENGTH.reach} units of the border count. 0 where the name belongs to more than`,
      `one river: its stretches form separate networks.`,
    ],
    "--refresh-rivers",
  );
  let shared = 0;
  for (const name of [...byName.keys()].filter((key) => keptNames.has(key)).toSorted(byCodeUnit)) {
    const members = byName.get(name);
    const rivers = networks(members, RIVER_LENGTH.snap)
      .map((network) => network.map((line) => members[line]))
      .filter(
        (network) =>
          network.reduce((sum, points) => sum + lengthOf(points), 0) >= RIVER_LENGTH.minNetwork,
      );
    let metres = 0;
    if (rivers.length > 1) shared += 1;
    else if (rivers.length === 1) {
      metres =
        Math.round(
          rivers[0].reduce((sum, points) => sum + lengthWhere(points, inAustria), 0) / 100,
        ) * 100;
    }
    lengths.push(`${name}\t${metres}`);
  }
  writeInput(RIVER_LENGTHS_FILE, lengths);
  console.log(
    `  measured ${keptNames.size - 1} rivers; ${shared} names are shared by several rivers and get no length`,
  );
}

/** Metres in Austria per river name; 0 where it is not known. */
function readRiverLengths() {
  return new Map(
    readInput(RIVER_LENGTHS_FILE).map((line) => {
      const [name, metres] = line.split("\t");
      return [name, Number(metres)];
    }),
  );
}

function readRivers() {
  return readInput(RIVERS_FILE).map((line) => {
    const [order, name, points] = line.split("\t");
    return {
      order: Number(order),
      name,
      points: points.split(" ").map((pair) => pair.split(",").map(Number)),
    };
  });
}

/**
 * One river set: the stretches of `minOrder` and up, joined into long lines
 * per river and order, simplified, with the lines to set names along.
 * `labelLevels` are the smoothing levels to make those lines at, finest
 * first. `labelBelow` limits them to rivers below that order, for the detail
 * chunk, whose larger rivers are already named by the base chunk.
 */
function packRivers(stretches, settings, labelLevels, about, labelBelow = Infinity) {
  const wanted = stretches.filter((stretch) => stretch.order >= settings.minOrder);
  const names = [...new Set(wanted.map((stretch) => stretch.name))].toSorted(byCodeUnit);
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
      lines.push({
        name: nameRow.get(name),
        order,
        points: simplifyRiver(arc.points, settings.tolerance),
      });
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
      for (const points of labelStretches(
        members.map((stretch) => stretch.points),
        labelSettings,
      )) {
        labels.push({ name: nameRow.get(name), order, level, points });
      }
    });
  }
  const sortedLabels = sortArcs(labels, SORT_TILE);

  return {
    names,
    facts: [
      {
        key: "length",
        label: "facts.length_in_austria",
        format: "kilometres",
        source: RIVERS.id,
        values: encodeInts(names.map((name) => Math.round((about.lengths.get(name) ?? 0) / 100))),
      },
    ],
    provinces: encodeInts(names.map((name) => about.provinces.get(name) ?? 0)),
    lines: encodeLines(
      sorted.map((line) => line.points),
      settings.q,
      { closed: false, keepShort: true },
    ),
    name: encodeInts(sorted.map((line) => line.name)),
    order: encodeInts(sorted.map((line) => line.order)),
    labels: encodeLines(
      sortedLabels.map((label) => label.points),
      LABEL_Q,
      { closed: false, keepShort: true },
    ),
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
  for (const code of [...sums.keys()].toSorted(byCodeUnit))
    lines.push(`${code}\t${sums.get(code)}`);
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
    encodeLines(
      mesh.arcs.map((arc) => arc.points),
      MESH_Q,
      { closed: false, keepShort: true },
    ),
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
  if (srs !== 31255)
    throw new Error(`place names are in EPSG:${String(srs)}, not MGI / Austria GK Central (31255)`);
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
  kept.sort(
    (p, q) => byCodeUnit(p.name, q.name) || Number(p.x) - Number(q.x) || Number(p.y) - Number(q.y),
  );
  const lines = header(
    PLACES,
    [
      `Settlements: every Stadt (0) and Markt (1), every Dorf (2) of 2000 residents or more, and the`,
      `place each municipality is named after. Class, name, the BEV's size class, x, y in the`,
      `view-box units of src/map/projection.ts.`,
    ],
    "--refresh-places",
  );
  for (const place of kept)
    lines.push([place.kind, place.name, place.size, place.x, place.y].join("\t"));
  writeInput(PLACES_FILE, lines);
  console.log(
    `  kept ${kept.length} of ${rows.length} settlements (${outside} lie outside every municipality)`,
  );
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
  if (srs !== 31255)
    throw new Error(`landforms are in EPSG:${String(srs)}, not MGI / Austria GK Central (31255)`);
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
    kept.push({
      name: row.name.trim(),
      height: Math.round(row.height),
      major,
      x: x.toFixed(2),
      y: y.toFixed(2),
    });
  }
  kept.sort(
    (p, q) => q.height - p.height || byCodeUnit(p.name, q.name) || Number(p.x) - Number(q.x),
  );
  const lines = header(
    PLACES,
    [
      `Summits (Berggipfel) with a height: name, metres, 1 if the BEV marks it as major, x, y in the`,
      `view-box units of src/map/projection.ts. Highest first.`,
    ],
    "--refresh-peaks",
  );
  for (const peak of kept)
    lines.push([peak.name, peak.height, peak.major, peak.x, peak.y].join("\t"));
  writeInput(PEAKS_FILE, lines);
  console.log(`  kept ${kept.length} of ${rows.length} summits`);
}

/**
 * Motorways and main roads, one route per stroke set. The BEV draws each
 * carriageway, slip road and junction loop as pieces of a few hundred
 * metres; per route they are joined end to end into long strokes and
 * simplified. Motorway strokes shorter than a unit (585 m) are dropped:
 * slip roads and loops, a blot at any scale the map shows. Main-road
 * strokes are cut short by every junction and roundabout, and dropping
 * those would leave gaps; only the bits under 60 m go, roundabout arcs
 * mostly, a gap of 3 px at the deepest zoom. The two carriageways of a
 * motorway, 20 to 40 m apart, stay two strokes that draw as one.
 */
async function refreshRoads(kind) {
  const settings = ROAD_KINDS[kind];
  await download(ROADS_URL, ROADS_CACHE, "BEV");
  const { DatabaseSync } = await import("node:sqlite");
  const database = new DatabaseSync(fileURLToPath(ROADS_CACHE), { readOnly: true });
  const [{ srs }] = database
    .prepare(`select srs_id as srs from gpkg_geometry_columns where table_name = ?`)
    .all(ROADS_TABLE);
  if (srs !== 31255)
    throw new Error(`roads are in EPSG:${String(srs)}, not MGI / Austria GK Central (31255)`);
  const rows = database
    .prepare(
      `select KURZBEZ_NAT as ref, NAME as name, SHAPE_LEN as length, geom from "${ROADS_TABLE}" ` +
        `where F_CODE in (${settings.codes.join(",")}) and KURZBEZ_NAT is not null order by OBJECTID`,
    )
    .all();
  database.close();

  const byRef = new Map();
  for (const row of rows) {
    const ref = row.ref.replace(/\s+/g, "");
    if (!settings.ref.test(ref)) continue;
    let route = byRef.get(ref);
    if (route === undefined) byRef.set(ref, (route = { pieces: [], metres: [], names: new Map() }));
    for (const line of parseGeoPackageLines(row.geom)) {
      if (line.length < 2) continue;
      route.metres.push(line);
      route.pieces.push(line.map(([e, n]) => project(...gaussKruegerToGeographic(e, n))));
    }
    // The route's own name is the one carried furthest; slip roads and
    // town streets carry others.
    const name = (row.name ?? "").trim();
    if (settings.name.test(name)) route.names.set(name, (route.names.get(name) ?? 0) + row.length);
  }
  const lines = header(
    ROADS,
    [
      `${settings.what}: route, name, the route's length in metres, points in the view-box units of`,
      `src/map/projection.ts. The length is the whole route's, on every stroke of it: measured along the`,
      `road before simplifying, rounded to 100 m, a motorway's two carriageways counted once.`,
      `Pieces joined per route, simplified to ${settings.tolerance} units` +
        (settings.minLength > 0
          ? `, strokes shorter than ${settings.minLength} units dropped.`
          : "."),
    ],
    settings.flag,
  );
  const number = (ref) => Number.parseInt(ref.slice(1), 10);
  let strokes = 0;
  for (const ref of [...byRef.keys()].toSorted(
    (p, q) => byCodeUnit(p[0], q[0]) || number(p) - number(q) || byCodeUnit(p, q),
  )) {
    const route = byRef.get(ref);
    const name = [...route.names].toSorted((p, q) => q[1] - p[1])[0]?.[0] ?? "";
    const metres = Math.round(routeLength(joinPieces(route.metres), CARRIAGEWAY_PAIR) / 100) * 100;
    for (const line of joinPieces(route.pieces)) {
      if (lengthOf(line) < settings.minLength) continue;
      const points = simplifyRoad(line, settings.tolerance);
      lines.push(
        [
          ref,
          name,
          metres,
          points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" "),
        ].join("\t"),
      );
      strokes += 1;
    }
  }
  if (byRef.size < settings.minRoutes)
    throw new Error(`only ${byRef.size} ${kind} routes; expected ${settings.minRoutes} or more`);
  writeInput(settings.file, lines);
  console.log(`  kept ${strokes} strokes on ${byRef.size} routes from ${rows.length} road pieces`);
}

function readRoads(kind) {
  return readInput(ROAD_KINDS[kind].file).map((line) => {
    const [ref, name, metres, points] = line.split("\t");
    return {
      ref,
      name,
      metres: Number(metres),
      points: points.split(" ").map((pair) => pair.split(",").map(Number)),
    };
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
// Refresh: lakes
// ---------------------------------------------------------------------------

/**
 * The water surfaces of one class and `keep.minArea` m² and up, from the
 * BEV's land cover, one polygon per entry: its name, area in m² and rings
 * (the outline first, its islands after it), simplified to `keep.tolerance`.
 * The source is Austria's own survey, so a lake on the border (the
 * Neusiedler See, the Bodensee) is there only up to it.
 */
async function readWaterSurfaces(code, keep) {
  await download(LAND_COVER_URL, LAND_COVER_CACHE, "BEV");
  const { DatabaseSync } = await import("node:sqlite");
  const database = new DatabaseSync(fileURLToPath(LAND_COVER_CACHE), { readOnly: true });
  const [{ srs }] = database
    .prepare(`select srs_id as srs from gpkg_geometry_columns where table_name = ?`)
    .all(WATER_TABLE);
  if (srs !== 31255)
    throw new Error(`land cover is in EPSG:${String(srs)}, not MGI / Austria GK Central (31255)`);
  const rows = database
    .prepare(
      `select NAME as name, SHAPE_AREA as area, geom from "${WATER_TABLE}" ` +
        `where F_CODE = ? and SHAPE_AREA >= ? order by OBJECTID`,
    )
    .all(code, keep.minArea);
  database.close();
  return rows.flatMap((row) =>
    parseGeoPackagePolygons(row.geom).map((polygon) => ({
      name: (row.name ?? "").trim(),
      area: Math.round(row.area),
      rings: polygon.map((ring) =>
        simplifyArc(
          ring.map(([e, n]) => project(...gaussKruegerToGeographic(e, n))),
          keep.tolerance,
        ),
      ),
    })),
  );
}

/** One polygon as a line of a committed input: name, area, then its rings separated by "|". */
const surfaceLine = (surface) =>
  [
    surface.name,
    surface.area,
    surface.rings
      .map((ring) => ring.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" "))
      .join("|"),
  ].join("\t");

const readSurface = ([name, area, rings]) => ({
  name,
  area: Number(area),
  rings: rings.split("|").map((ring) => ring.split(" ").map((pair) => pair.split(",").map(Number))),
});

/** The lakes of LAKE_KEEP.minArea and up. */
async function refreshLakes() {
  const lakes = await readWaterSurfaces(LAKE_CODE, LAKE_KEEP);
  if (lakes.length < 500)
    throw new Error(`only ${lakes.length} lakes; expected a thousand or more`);
  writeInput(LAKES_FILE, [
    ...header(
      LAND_COVER,
      [
        `Lakes, reservoirs and ponds of ${LAKE_KEEP.minArea} m² and up: name, area in m², then the rings of`,
        `one polygon, the shore first and its islands after it, separated by "|", in the view-box units of`,
        `src/map/projection.ts. Simplified to ${LAKE_KEEP.tolerance} units.`,
      ],
      "--refresh-lakes",
    ),
    ...lakes.map(surfaceLine),
  ]);
  console.log(`  kept ${lakes.length} lakes of ${LAKE_KEEP.minArea} m² and up`);
}

/** The glaciers of GLACIER_KEEP.minArea and up, and every named glacier of the names file. */
async function refreshGlaciers() {
  const glaciers = await readWaterSurfaces(GLACIER_CODE, GLACIER_KEEP);
  if (glaciers.length < 300)
    throw new Error(`only ${glaciers.length} glaciers; expected several hundred`);
  await download(PLACES_URL, PLACES_CACHE, "BEV");
  const { DatabaseSync } = await import("node:sqlite");
  const database = new DatabaseSync(fileURLToPath(PLACES_CACHE), { readOnly: true });
  const [{ srs }] = database
    .prepare(`select srs_id as srs from gpkg_geometry_columns where table_name = ?`)
    .all(GLACIER_NAMES_TABLE);
  if (srs !== 31255)
    throw new Error(
      `glacier names are in EPSG:${String(srs)}, not MGI / Austria GK Central (31255)`,
    );
  const rows = database
    .prepare(
      `select NAME as name, F_CODE as code, geom from "${GLACIER_NAMES_TABLE}" ` +
        `where NAME is not null and trim(NAME) <> '' order by OBJECTID`,
    )
    .all();
  database.close();
  const names = rows
    .filter((row) => GLACIER_CLASSES.includes(row.code))
    .map((row) => {
      const [x, y] = project(...gpkgPoint(row.geom));
      return { name: row.name.trim(), size: GLACIER_CLASSES.indexOf(row.code), x, y };
    });
  if (names.length < 300) throw new Error(`only ${names.length} glacier names`);
  writeInput(GLACIERS_FILE, [
    ...header(
      LAND_COVER,
      [
        `Glaciers of ${GLACIER_KEEP.minArea} m² and up, as "ice": name (none in the source), area in m², then`,
        `the rings of one polygon separated by "|", simplified to ${GLACIER_KEEP.tolerance} units. And the`,
        `named glaciers of BEV, Digitales Landschaftsmodell, Namen (same release), as "name": its class`,
        `(0 over 6 km long, 1 from 2 to 6 km, 2 under 2 km), name, x, y. All in the view-box units of`,
        `src/map/projection.ts.`,
      ],
      "--refresh-glaciers",
    ),
    ...glaciers.map((glacier) => `ice\t${surfaceLine(glacier)}`),
    ...names.map((entry) =>
      ["name", entry.size, entry.name, entry.x.toFixed(2), entry.y.toFixed(2)].join("\t"),
    ),
  ]);
  console.log(`  kept ${glaciers.length} glaciers and ${names.length} glacier names`);
}

function readGlaciers() {
  const outlines = [];
  const names = [];
  for (const line of readInput(GLACIERS_FILE)) {
    const [kind, ...fields] = line.split("\t");
    if (kind === "ice") outlines.push(readSurface(fields));
    else {
      const [size, name, x, y] = fields;
      names.push({ size: Number(size), name, x: Number(x), y: Number(y) });
    }
  }
  return { outlines, names };
}

function readLakes() {
  return readInput(LAKES_FILE).map((line) => readSurface(line.split("\t")));
}

/**
 * Polygons of `minArea` m² and up, largest first, each simplified, with
 * the islands that still cover `minIsland` square units: the rings, sorted
 * to pack well, and per ring the row of its polygon.
 */
function packSurfaces(surfaces, settings) {
  const kept = surfaces
    .filter((surface) => surface.area >= settings.minArea)
    .toSorted((p, q) => q.area - p.area || byCodeUnit(p.name, q.name));
  const rings = [];
  kept.forEach((surface, row) => {
    surface.rings.forEach((ring, index) => {
      const points = simplifyArc(ring, settings.tolerance);
      if (index > 0 && ringArea(points) < settings.minIsland) return;
      rings.push({ row, points });
    });
  });
  const sortedRings = sortArcs(rings, SORT_TILE);
  return {
    kept,
    // keepShort: the row column runs parallel to the rings, so none may drop out.
    rings: encodeLines(
      sortedRings.map((ring) => ring.points),
      settings.q,
      { closed: true, keepShort: true },
    ),
    row: encodeInts(sortedRings.map((ring) => ring.row)),
  };
}

/** The rings of each row, as the card will read them back: flat and on the grid. */
function ringsByRow(packed, count) {
  const lines = decodeLines(packed.rings);
  const rows = decodeInts(packed.row);
  const out = Array.from({ length: count }, () => []);
  for (let ring = 0; ring < lines.count; ring += 1) {
    out[rows[ring]].push(lines.xy.slice(lines.start[ring] * 2, lines.start[ring + 1] * 2));
  }
  return out;
}

/** Lakes, and where each named one gets its name: the point farthest from its shore. */
function packLakes(lakes, settings) {
  const { kept, rings, row } = packSurfaces(lakes, settings);
  const byRow = ringsByRow({ rings, row }, kept.length);
  return {
    names: kept.map((lake) => lake.name),
    at: encodePoints(
      kept.map((lake, index) => {
        if (lake.name === "") return [0, 0];
        const [x, y] = labelPoint(byRow[index], LABEL_PRECISION);
        return [onGrid(x), onGrid(y)];
      }),
      POINT_Q,
    ),
    rings,
    lake: row,
  };
}

/**
 * Glaciers, and the names that lie on them. A name further than `reach`
 * from every drawn glacier belongs to ice that is gone or too small to
 * draw, and would name bare rock.
 */
function packGlaciers({ outlines, names }, settings) {
  const { kept, rings, row } = packSurfaces(outlines, settings);
  const all = ringsByRow({ rings, row }, kept.length).flat();
  const asPoints = all.map((ring) => {
    const points = [];
    for (let index = 0; index < ring.length; index += 2)
      points.push([ring[index], ring[index + 1]]);
    points.push(points[0]);
    return points;
  });
  const inside = insideTest(asPoints);
  const near = nearTest(asPoints, settings.reach);
  const named = names
    .filter((entry) => inside(entry.x, entry.y) || near(entry.x, entry.y))
    .toSorted((p, q) => p.size - q.size || byCodeUnit(p.name, q.name) || p.x - q.x);
  return {
    rings,
    field: row,
    names: named.map((entry) => entry.name),
    at: encodePoints(
      named.map((entry) => [onGrid(entry.x), onGrid(entry.y)]),
      POINT_Q,
    ),
    size: encodeInts(named.map((entry) => entry.size)),
  };
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

const packArcs = (arcs, q) => ({
  lines: encodeLines(
    arcs.map((arc) => arc.points),
    q,
    { closed: false, keepShort: true },
  ),
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
  const simplified = mesh.arcs.map((arc) => ({
    ...arc,
    points: simplifyArc(arc.points, settings.tolerance),
  }));
  const upper = sortArcs(
    simplified.filter((arc) => level(arc) < 3),
    SORT_TILE,
  );
  const lower = sortArcs(
    simplified.filter((arc) => level(arc) === 3),
    SORT_TILE,
  );
  return { upper: packArcs(upper, settings.q), lower: packArcs(lower, settings.q) };
}

function build(settings = {}) {
  const fine = settings.fine ?? FINE;
  const terrainDetail = settings.terrainDetail ?? TERRAIN_DETAIL;
  const riversDetail = settings.riversDetail ?? RIVERS_DETAIL;
  const lakesDrawn = settings.lakes ?? LAKES_DRAWN;
  const glaciersDrawn = settings.glaciers ?? GLACIERS_DRAWN;

  const mesh = readMesh();
  const { districts, provinces, districtOf, provinceOfDistrict, provinceOf } = levels(mesh.units);
  if (provinces.length !== 9) throw new Error(`${provinces.length} provinces, not 9`);

  // Population, one to one with the borders or not at all.
  const population = readPopulation();
  const missing = mesh.units
    .filter((unit) => !population.byCode.has(unit.code))
    .map((unit) => unit.code);
  const extra = [...population.byCode.keys()].filter(
    (code) => !mesh.units.some((unit) => unit.code === code),
  );
  if (missing.length > 0 || extra.length > 0) {
    throw new Error(
      `borders and population disagree about the municipalities: ` +
        `no population for ${missing.join(", ") || "none"}; no border for ${extra.join(", ") || "none"}`,
    );
  }
  const residents = mesh.units.map((unit) => population.byCode.get(unit.code));
  const sumBy = (groupOf, count) => {
    const sums = Array.from({ length: count }, () => 0);
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
    arc.a < 0
      ? 0
      : provinceOf[arc.a] !== provinceOf[arc.b]
        ? 1
        : districtOf[arc.a] !== districtOf[arc.b]
          ? 2
          : 3;
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
        (inner, [x, y]) => [
          Math.min(inner[0], x),
          Math.min(inner[1], y),
          Math.max(inner[2], x),
          Math.max(inner[3], y),
        ],
        box,
      ),
    [Infinity, Infinity, -Infinity, -Infinity],
  );
  if (left < 10 || top < 10 || right > MAP_WIDTH - 10 || bottom > MAP_HEIGHT - 10) {
    throw new Error(
      `the outline leaves the ${MAP_WIDTH}x${MAP_HEIGHT} view box margin; refit src/map/projection.ts`,
    );
  }

  // --- Tables ---
  const provinceTable = {
    ids: provinces.map((province) => province.code),
    names: provinces.map((province) => province.name),
    at: encodePoints(
      labelPoints(
        provinceIndex,
        provinces.map((province) => province.name),
      ),
      POINT_Q,
    ),
    facts: [populationFact(sumBy(provinceOf, provinces.length))],
  };
  const districtTable = {
    ids: districts.map((district) => district.code),
    names: districts.map((district) => district.name),
    parent: encodeInts(provinceOfDistrict),
    at: encodePoints(
      labelPoints(
        districtIndex,
        districts.map((district) => district.name),
      ),
      POINT_Q,
    ),
    facts: [populationFact(sumBy(districtOf, districts.length))],
  };
  const municipalityTable = {
    ids: mesh.units.map((unit) => unit.code),
    names: mesh.units.map((unit) => unit.name),
    parent: encodeInts(districtOf),
    at: encodePoints(
      labelPoints(
        municipalityIndex,
        mesh.units.map((unit) => `${unit.name} (${unit.code})`),
      ),
      POINT_Q,
    ),
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
  if (adrift > located.length / 100)
    throw new Error(`${adrift} places lie outside every municipality`);
  const places = rankPlaces(located, municipalityTable.names, residents);
  const seated = new Set(places.filter((place) => place.seat).map((place) => place.municipality));
  if (seated.size < mesh.units.length * 0.8) {
    throw new Error(
      `only ${seated.size} of ${mesh.units.length} municipalities have a place of their name in them`,
    );
  }
  const capitalOf = (place) =>
    place.seat ? (CAPITALS.get(mesh.units[place.municipality].code) ?? 0) : 0;
  if (places.filter((place) => capitalOf(place) > 0).length !== CAPITALS.size) {
    throw new Error("not every capital was found among the places");
  }
  const placeTable = {
    names: places.map((place) => place.name),
    at: encodePoints(
      places.map((place) => [place.x, place.y]),
      POINT_Q,
    ),
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

  // --- Which provinces a line runs through ---
  // By district: the municipality index would test two thousand outlines
  // for every point. A province counts once a line runs PROVINCE_REACH
  // units in it, so a road that grazes a border or a river that is its
  // border for a few metres does not list the province next door.
  const provincesOf = (lines) => {
    const inProvince = Array.from({ length: provinces.length }, () => 0);
    for (const points of lines) {
      for (let index = 1; index < points.length; index += 1) {
        const [ax, ay] = points[index - 1];
        const [bx, by] = points[index];
        const district = districtIndex.locate((ax + bx) / 2, (ay + by) / 2);
        if (district >= 0) inProvince[provinceOfDistrict[district]] += Math.hypot(bx - ax, by - ay);
      }
    }
    return inProvince.reduce(
      (mask, length, province) => (length >= PROVINCE_REACH ? mask | (1 << province) : mask),
      0,
    );
  };

  // --- Terrain and rivers ---
  const grid = readGrid();
  const stretches = readRivers();
  const riverLengths = readRiverLengths();
  const riverProvinces = new Map();
  for (const name of new Set(stretches.map((stretch) => stretch.name))) {
    // A shared name has no length, and its provinces would be two rivers'.
    if ((riverLengths.get(name) ?? 0) === 0) continue;
    riverProvinces.set(
      name,
      provincesOf(
        stretches.filter((stretch) => stretch.name === name).map((stretch) => stretch.points),
      ),
    );
  }
  const aboutRivers = { lengths: riverLengths, provinces: riverProvinces };

  const head = (id, sources) => ({ format: DATA_FORMAT, id, sources });
  const chunks = {
    base: {
      ...head("base", [BORDERS, TERRAIN, RIVERS, POPULATION]),
      provinces: provinceTable,
      arcs: coarsePacked,
      terrain: packTerrain(grid, TERRAIN_OVERVIEW),
      rivers: packRivers(stretches, RIVERS_OVERVIEW, RIVER_LABELS, aboutRivers),
    },
    borders: {
      ...head("borders", [BORDERS, POPULATION]),
      districts: districtTable,
      municipalities: municipalityTable,
      arcs: upper,
    },
    gemeinden: { ...head("gemeinden", [BORDERS]), arcs: lower },
    "terrain-detail": {
      ...head("terrain-detail", [TERRAIN]),
      terrain: packTerrain(grid, terrainDetail),
    },
    "rivers-detail": {
      ...head("rivers-detail", [RIVERS]),
      rivers: packRivers(
        stretches,
        riversDetail,
        STREAM_LABELS,
        aboutRivers,
        RIVERS_OVERVIEW.minOrder,
      ),
    },
    places: { ...head("places", [PLACES, POPULATION]), places: placeTable },
    relief: { ...head("relief", [TERRAIN]), relief: packRelief(grid, RELIEF) },
    peaks: { ...head("peaks", [PLACES]), peaks: packPeaks(readPeaks(), PEAKS) },
    motorways: {
      ...head("motorways", [ROADS]),
      motorways: packRoads(readRoads("motorways"), ROAD_KINDS.motorways.q, provincesOf),
    },
    "main-roads": {
      ...head("main-roads", [ROADS]),
      roads: packRoads(readRoads("main-roads"), ROAD_KINDS["main-roads"].q, provincesOf),
    },
    lakes: { ...head("lakes", [LAND_COVER]), lakes: packLakes(readLakes(), lakesDrawn) },
    glaciers: {
      ...head("glaciers", [LAND_COVER, PLACES]),
      glaciers: packGlaciers(readGlaciers(), glaciersDrawn),
    },
  };

  const files = new Map();
  for (const id of CHUNK_IDS) {
    const chunk = chunks[id];
    const credit = chunk.sources
      .map((source) => `${source.holder}, ${source.name} (${source.stand})`)
      .join("; ");
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
const sizes = (text) =>
  `${kb(Buffer.byteLength(text))} (${kb(gzipSync(text, { level: 9 }).length)})`;

/** The tables behind the settings at the top of this file. */
function measure() {
  const size = (settings, id) => sizes(build(settings).files.get(id));
  console.log("Fine borders: tolerance, grid -> borders chunk, gemeinden chunk");
  for (const [tolerance, q] of [
    [0.03, 0.02],
    [0.03, 0.05],
    [0.06, 0.05],
    [0.1, 0.05],
    [0.1, 0.1],
    [0.2, 0.1],
  ]) {
    const { files } = build({ fine: { tolerance, q } });
    console.log(
      `  ${tolerance}  ${q}  ${sizes(files.get("borders"))}  ${sizes(files.get("gemeinden"))}`,
    );
  }
  console.log("Terrain detail: tolerance, smallest ring, grid -> chunk");
  for (const [tolerance, minArea, q] of [
    [0.08, 0.6, 0.05],
    [0.14, 1.2, 0.05],
    [0.2, 2, 0.05],
    [0.2, 2, 0.1],
    [0.3, 3, 0.1],
  ]) {
    console.log(
      `  ${tolerance}  ${minArea}  ${q}  ${size({ terrainDetail: { ...TERRAIN_DETAIL, tolerance, minArea, q } }, "terrain-detail")}`,
    );
  }
  console.log("Rivers detail: lowest order, tolerance, grid -> chunk");
  for (const [minOrder, tolerance, q] of [
    [4, 0.08, 0.05],
    [4, 0.12, 0.05],
    [4, 0.2, 0.1],
    [3, 0.08, 0.05],
    [3, 0.12, 0.05],
    [3, 0.2, 0.1],
  ]) {
    console.log(
      `  ${minOrder}  ${tolerance}  ${q}  ${size({ riversDetail: { minOrder, tolerance, q } }, "rivers-detail")}`,
    );
  }
  console.log("Lakes: smallest lake (m²), tolerance, grid -> chunk");
  for (const [minArea, tolerance, q] of [
    [30_000, 0.03, 0.02],
    [30_000, 0.06, 0.05],
    [50_000, 0.03, 0.05],
    [50_000, 0.06, 0.05],
    [100_000, 0.06, 0.05],
    [100_000, 0.1, 0.05],
  ]) {
    console.log(
      `  ${minArea}  ${tolerance}  ${q}  ${size({ lakes: { ...LAKES_DRAWN, minArea, tolerance, q } }, "lakes")}`,
    );
  }
  console.log("Glaciers: smallest glacier (m²), tolerance, grid -> chunk");
  for (const [minArea, tolerance, q] of [
    [30_000, 0.03, 0.02],
    [30_000, 0.06, 0.05],
    [100_000, 0.06, 0.05],
    [100_000, 0.1, 0.05],
  ]) {
    console.log(
      `  ${minArea}  ${tolerance}  ${q}  ${size({ glaciers: { ...GLACIERS_DRAWN, minArea, tolerance, q } }, "glaciers")}`,
    );
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
if (everything || args.has("--refresh-motorways")) await refreshRoads("motorways");
if (everything || args.has("--refresh-main-roads")) await refreshRoads("main-roads");
if (everything || args.has("--refresh-lakes")) await refreshLakes();
if (everything || args.has("--refresh-glaciers")) await refreshGlaciers();

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
