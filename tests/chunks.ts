/** The data chunks as committed in dist/, read as text and parsed, so the
 *  tests see exactly the bytes a browser would import. */
import baseText from "../dist/austria-map-data-base.js?raw";
import bordersText from "../dist/austria-map-data-borders.js?raw";
import gemeindenText from "../dist/austria-map-data-gemeinden.js?raw";
import lakesText from "../dist/austria-map-data-lakes.js?raw";
import mainRoadsText from "../dist/austria-map-data-main-roads.js?raw";
import motorwaysText from "../dist/austria-map-data-motorways.js?raw";
import peaksText from "../dist/austria-map-data-peaks.js?raw";
import placesText from "../dist/austria-map-data-places.js?raw";
import reliefText from "../dist/austria-map-data-relief.js?raw";
import riversText from "../dist/austria-map-data-rivers-detail.js?raw";
import terrainText from "../dist/austria-map-data-terrain-detail.js?raw";
import type { ChunkId, ChunkMap } from "../src/data/format.ts";
import { MapStore } from "../src/layers/store.ts";

export const CHUNK_TEXT: Record<ChunkId, string> = {
  base: baseText,
  borders: bordersText,
  gemeinden: gemeindenText,
  "terrain-detail": terrainText,
  "rivers-detail": riversText,
  places: placesText,
  relief: reliefText,
  peaks: peaksText,
  motorways: motorwaysText,
  "main-roads": mainRoadsText,
  lakes: lakesText,
};

const MARK = "export default ";

/** The object a chunk file exports. */
export function chunk<K extends ChunkId>(id: K): ChunkMap[K] {
  const text = CHUNK_TEXT[id];
  const json = text.slice(text.indexOf(MARK) + MARK.length).replace(/;\s*$/, "");
  return JSON.parse(json) as ChunkMap[K];
}

/** A store holding the given chunks, or all of them. */
export function storeWith(...ids: ChunkId[]): MapStore {
  const store = new MapStore();
  const wanted: ChunkId[] = ids.length > 0 ? ids : (Object.keys(CHUNK_TEXT) as ChunkId[]);
  for (const id of wanted) store.add(chunk(id));
  return store;
}
