/**
 * The layers of the map, as one list.
 *
 * A layer is an entry here: which data it needs at which scale, from which
 * scale on it is worth drawing, and how it draws. The renderer, the loader,
 * the layer button on the map and the editor all read this list, so a new
 * layer is one new entry and its translations.
 *
 * Scale is in screen pixels per map unit (one unit is about 585 m), not a
 * zoom factor: what can be told apart on screen depends on the pixels, and
 * a wide card has more of them at the same zoom.
 */
import { CHUNK_IDS, type ChunkId } from "../data/format.ts";
import type { Box, Camera, Size } from "../map/camera.ts";
import type { Palette } from "../map/palette.ts";
import type { ShapeCache } from "../map/tiles.ts";
import { LAYER_IDS, type LayerId } from "../types.ts";
import { districtsLayer, municipalitiesLayer, provincesLayer } from "./borders.ts";
import { motorwaysLayer } from "./motorways.ts";
import { peaksLayer } from "./peaks.ts";
import { citiesLayer } from "./places.ts";
import { riversLayer } from "./rivers.ts";
import { SCALES } from "./scales.ts";
import type { MapStore } from "./store.ts";
import { terrainLayer } from "./terrain.ts";

/** What a layer gets to draw with. The context is already in map units. */
export interface DrawContext {
  readonly ctx: CanvasRenderingContext2D;
  readonly store: MapStore;
  readonly palette: Palette;
  readonly shapes: ShapeCache;
  readonly camera: Camera;
  readonly size: Size;
  /** Pixels per map unit. */
  readonly scale: number;
  /** The part of the map in view. */
  readonly box: Box;
  /** True when the fine borders are loaded and called for. */
  readonly fine: boolean;
}

export interface LayerDef {
  readonly id: LayerId;
  /** Icon for the layer list. */
  readonly icon: string;
  /** The layer draws nothing below this scale. */
  readonly minScale: number;
  /** Drawn inside the national border: what the data carries past it is cut off. */
  readonly clipped: boolean;
  /** The chunks the layer needs at a scale, beyond the base chunk. */
  chunks(scale: number): readonly ChunkId[];
  draw(dc: DrawContext): void;
}

/** In drawing order, bottom first. */
export const LAYERS: readonly LayerDef[] = [
  terrainLayer,
  riversLayer,
  municipalitiesLayer,
  districtsLayer,
  provincesLayer,
  motorwaysLayer,
  peaksLayer,
  citiesLayer,
];

if (LAYERS.map((layer) => layer.id).join() !== LAYER_IDS.join()) {
  throw new Error("the layer registry and LAYER_IDS have drifted apart");
}

export const layerById = (id: LayerId): LayerDef => LAYERS.find((layer) => layer.id === id) as LayerDef;

/** Every chunk the map needs for these layers at this scale. */
export function chunksFor(layers: ReadonlySet<LayerId>, scale: number): ChunkId[] {
  const wanted = new Set<ChunkId>(["base"]);
  // The national outline and the land itself switch to the fine borders.
  if (scale >= SCALES.fineBorders) wanted.add("borders");
  for (const layer of LAYERS) {
    if (!layers.has(layer.id)) continue;
    for (const id of layer.chunks(scale)) wanted.add(id);
  }
  return CHUNK_IDS.filter((id) => wanted.has(id));
}

/** Whether the fine borders should be drawn, given what is loaded. */
export function useFineBorders(store: MapStore, layers: ReadonlySet<LayerId>, scale: number): boolean {
  if (store.detail === undefined) return false;
  return scale >= SCALES.fineBorders || layers.has("districts") || layers.has("municipalities");
}
