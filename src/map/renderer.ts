/**
 * Draws the map onto a canvas.
 *
 * Canvas rather than SVG, because the map is panned and zoomed freely and
 * holds more than a hundred thousand vertices once the municipalities are
 * in: an SVG would be laid out and rasterised whole on every frame. Here a
 * frame strokes only the tiles in view, line widths stay constant on screen
 * by dividing them by the scale, and every path is built once and kept.
 *
 * Nothing in this file touches the DOM beyond the 2D context it is handed,
 * so the preview script draws real frames with it in Node.
 */
import { drawBorders } from "../layers/borders.ts";
import { LAYERS, useFineBorders, type DrawContext } from "../layers/registry.ts";
import { riverBox, riverLines, riverNear } from "../layers/rivers.ts";
import { grown } from "../layers/scales.ts";
import type { MapStore } from "../layers/store.ts";
import type { LayerId } from "../types.ts";
import { toMap, toScreen, visibleBox, type Box, type Camera, type Size } from "./camera.ts";
import { drawLabels, type DrawnCity, type Feature } from "./labels.ts";
import type { Palette } from "./palette.ts";
import { drawPin } from "./pin.ts";
import { MAP_HEIGHT, MAP_WIDTH, type MapPoint } from "./projection.ts";
import type { View3D } from "./view3d.ts";
import { ShapeCache, traceLines, traceRings, type PathFactory } from "./tiles.ts";

export interface RenderState {
  readonly camera: Camera;
  readonly layers: ReadonlySet<LayerId>;
  readonly showLabels: boolean;
  readonly selection: Feature | null;
  /** Where the "you are here" pin goes, in map units; null for no pin. */
  readonly here: MapPoint | null;
}

/** The part of a canvas element the renderer uses. */
export interface CanvasLike {
  width: number;
  height: number;
  getContext(type: "2d"): CanvasRenderingContext2D | null;
}

/** How near a tap has to be, in pixels. */
const CITY_REACH = 12;
const RIVER_REACH = 7;
/** Map units shown on either side of a town by "zoom here". */
const CITY_SURROUNDINGS = 14;

export class MapRenderer {
  public readonly store: MapStore;
  private readonly canvas: CanvasLike;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly shapes: ShapeCache;
  private palette: Palette | undefined;
  private width = 0;
  private height = 0;
  private dpr = 1;
  private cities: DrawnCity[] = [];
  /** The 3D view of the last frame, if it was tilted: taps are picked through it. */
  private tilted: View3D | null = null;

  public constructor(canvas: CanvasLike, store: MapStore, createPath: PathFactory) {
    const ctx = canvas.getContext("2d");
    if (ctx === null) throw new Error("no 2D context");
    this.canvas = canvas;
    this.ctx = ctx;
    this.store = store;
    this.shapes = new ShapeCache(createPath);
  }

  public get hasPalette(): boolean {
    return this.palette !== undefined;
  }

  public setPalette(palette: Palette): void {
    this.palette = palette;
  }

  /** The canvas size in CSS pixels. */
  public get size(): Size {
    return { width: this.width, height: this.height };
  }

  /** `maxPixels` caps the backing store's width; the 3D drape asks for more. */
  public resize(width: number, height: number, devicePixelRatio: number, maxPixels = 2400): void {
    // Cap the backing store: a 1600 px wide card at DPR 3 would be 14 MP to
    // fill on every frame of a pinch.
    const dpr = Math.min(devicePixelRatio || 1, 2, maxPixels / Math.max(width, 1));
    this.width = width;
    this.height = height;
    this.dpr = dpr;
    this.canvas.width = Math.max(1, Math.round(width * dpr));
    this.canvas.height = Math.max(1, Math.round(height * dpr));
  }

  public draw(state: RenderState): void {
    const { ctx, store, palette, dpr } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.cities = [];
    this.tilted = null;
    const overview = store.overview;
    if (palette === undefined || overview === undefined || this.width === 0) return;

    const { camera, layers } = state;
    const size = this.size;
    const scale = camera.k;
    const fine = useFineBorders(store, layers, scale);
    const dc: DrawContext = {
      ctx,
      store,
      palette,
      shapes: this.shapes,
      camera,
      size,
      scale,
      box: visibleBox(camera, size),
      fine,
    };
    const on = (id: LayerId, minScale: number): boolean => layers.has(id) && scale >= minScale;

    // From here on the context is in map units.
    ctx.setTransform(
      dpr * scale,
      0,
      0,
      dpr * scale,
      dpr * (size.width / 2 - camera.x * scale),
      dpr * (size.height / 2 - camera.y * scale),
    );

    const country =
      fine && store.detail !== undefined
        ? this.shapes.get("country:fine", (path) => traceRings(path, (store.detail as NonNullable<typeof store.detail>).country))
        : this.shapes.get("country:coarse", (path) => traceRings(path, overview.country));
    ctx.fillStyle = palette.land;
    ctx.fill(country, "evenodd");

    // The terrain is carried a little past the border so it meets it
    // cleanly; the country's own shape cuts it off.
    ctx.save();
    ctx.clip(country, "evenodd");
    for (const layer of LAYERS) {
      if (layer.clipped && on(layer.id, layer.minScale)) layer.draw(dc);
    }
    ctx.restore();

    for (const layer of LAYERS) {
      if (!layer.clipped && on(layer.id, layer.minScale)) layer.draw(dc);
    }
    // The national border is not a layer: without it there is no map.
    drawBorders(dc, 0);

    if (state.selection !== null) this.highlight(dc, state.selection);

    // Names and towns are drawn in screen pixels.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.cities = drawLabels({
      ctx,
      store,
      palette,
      camera,
      size,
      box: dc.box,
      layers,
      showLabels: state.showLabels,
      selection: state.selection,
    });
    if (state.selection?.kind === "city") {
      const row = state.selection.row;
      const city = this.cities.find((entry) => entry.row === row);
      if (city !== undefined) {
        ctx.beginPath();
        ctx.arc(city.x, city.y, city.radius + 4.5, 0, Math.PI * 2);
        ctx.lineWidth = 2;
        ctx.strokeStyle = palette.accent;
        ctx.stroke();
      }
    }
    // On top of everything: it is the one mark that is about you.
    if (state.here !== null) drawPin(ctx, ...toScreen(camera, size, ...state.here), palette);
  }

  /**
   * The canvas over the tilted map: only the names, the towns and the pin,
   * upright in screen pixels, each placed where its ground point is seen.
   * The map itself is the WebGL canvas underneath.
   */
  public drawTilted(state: RenderState, view: View3D): void {
    const { ctx, store, palette, dpr } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.cities = [];
    this.tilted = view;
    if (palette === undefined || store.overview === undefined || this.width === 0) return;
    const relief = store.relief;
    const project = (x: number, y: number): [number, number] | null => view.projectGround(relief, x, y);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.cities = drawLabels({
      ctx,
      store,
      palette,
      camera: state.camera,
      size: this.size,
      box: [0, 0, MAP_WIDTH, MAP_HEIGHT],
      layers: state.layers,
      showLabels: state.showLabels,
      selection: state.selection,
      project,
    });
    if (state.selection?.kind === "city") {
      const row = state.selection.row;
      const city = this.cities.find((entry) => entry.row === row);
      if (city !== undefined) {
        ctx.beginPath();
        ctx.arc(city.x, city.y, city.radius + 4.5, 0, Math.PI * 2);
        ctx.lineWidth = 2;
        ctx.strokeStyle = palette.accent;
        ctx.stroke();
      }
    }
    if (state.here !== null) {
      const tip = project(...state.here);
      if (tip !== null) drawPin(ctx, tip[0], tip[1], palette);
    }
  }

  /** Mark the selected area or river. A selected town is ringed with the labels. */
  private highlight(dc: DrawContext, selection: Feature): void {
    const { ctx, store, palette, scale } = dc;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    if (selection.kind === "river") {
      const river = riverLines(store, scale, selection.name);
      if (river === undefined) return;
      const path = this.shapes.get(`selected:river:${selection.name}:${scale >= 2 ? "detail" : "overview"}:${river.which.length}`, (target) =>
        traceLines(target, river.lines, river.which),
      );
      ctx.strokeStyle = palette.accent;
      ctx.lineWidth = grown(2.6, scale) / scale;
      ctx.stroke(path);
      return;
    }
    const rings = this.ringsOf(selection, dc.fine);
    if (rings === undefined) return;
    const path = this.shapes.get(`selected:${selection.kind}:${selection.row}:${rings.set}`, (target) =>
      traceRings(target, rings.rings()),
    );
    ctx.fillStyle = palette.accentFill;
    ctx.fill(path, "evenodd");
    ctx.strokeStyle = palette.accent;
    ctx.lineWidth = 2 / scale;
    ctx.stroke(path);
  }

  /** The outline of an area, on the borders that are being drawn. */
  private ringsOf(selection: Feature, fine: boolean): { set: string; rings: () => Float32Array[] } | undefined {
    const { store } = this;
    if (selection.kind === "province") {
      const index = fine && store.detail !== undefined ? store.detail.provinceIndex : store.overview?.index;
      if (index === undefined) return undefined;
      return { set: fine ? "fine" : "coarse", rings: () => index.rings(selection.row) };
    }
    if (selection.kind === "district" && store.detail !== undefined) {
      const index = store.detail.districtIndex;
      return { set: "fine", rings: () => index.rings(selection.row) };
    }
    if (selection.kind === "municipality") {
      const index = store.municipalityIndex;
      if (index === undefined) return undefined;
      return { set: "fine", rings: () => index.rings(selection.row) };
    }
    return undefined;
  }

  /**
   * What is at a pixel of the last frame: a town, a river, or the smallest
   * area whose layer is on. Null for abroad, or when nothing there can be
   * told apart yet.
   */
  public hit(state: RenderState, px: number, py: number): Feature | null {
    const { store } = this;
    const { camera, layers } = state;
    const scale = camera.k;
    let nearest: DrawnCity | undefined;
    let distance = Infinity;
    for (const city of this.cities) {
      const inLabel =
        city.label !== null &&
        px >= city.label.x &&
        px <= city.label.x + city.label.w &&
        py >= city.label.y &&
        py <= city.label.y + city.label.h;
      const away = inLabel ? 0 : Math.hypot(px - city.x, py - city.y);
      if (away <= Math.max(CITY_REACH, city.radius + 8) && away < distance) {
        distance = away;
        nearest = city;
      }
    }
    if (nearest !== undefined) return { kind: "city", row: nearest.row };

    let x: number;
    let y: number;
    if (this.tilted !== null) {
      const picked = this.tilted.pick(px, py, store.relief);
      if (picked === null) return null;
      [x, y] = picked;
    } else {
      [x, y] = toMap(camera, this.size, px, py);
    }
    if (layers.has("rivers")) {
      const river = riverNear(store, scale, x, y, RIVER_REACH / scale);
      if (river !== undefined) return { kind: "river", name: river.name, order: river.order };
    }
    const municipal = store.municipalityIndex;
    const municipalities = LAYERS.find((layer) => layer.id === "municipalities");
    if (layers.has("municipalities") && municipal !== undefined && scale >= (municipalities?.minScale ?? 0)) {
      const row = municipal.locate(x, y);
      if (row >= 0) return { kind: "municipality", row };
    }
    if (layers.has("districts") && store.detail !== undefined) {
      const row = store.detail.districtIndex.locate(x, y);
      if (row >= 0) return { kind: "district", row };
    }
    if (layers.has("provinces")) {
      const fine = useFineBorders(store, layers, scale);
      const index = fine && store.detail !== undefined ? store.detail.provinceIndex : store.overview?.index;
      const row = index?.locate(x, y) ?? -1;
      if (row >= 0) return { kind: "province", row };
    }
    return null;
  }

  /** The part of the map that shows a feature whole, for "zoom here". */
  public boxOf(feature: Feature): Box | undefined {
    const { store } = this;
    switch (feature.kind) {
      case "province":
        return (store.detail?.provinceIndex ?? store.overview?.index)?.box(feature.row);
      case "district":
        return store.detail?.districtIndex.box(feature.row);
      case "municipality":
        return store.municipalityIndex?.box(feature.row);
      case "city": {
        const places = store.places;
        if (places === undefined) return undefined;
        const x = places.at[feature.row * 2] as number;
        const y = places.at[feature.row * 2 + 1] as number;
        return [x - CITY_SURROUNDINGS, y - CITY_SURROUNDINGS, x + CITY_SURROUNDINGS, y + CITY_SURROUNDINGS];
      }
      case "river":
        return riverBox(store, feature.name);
    }
  }
}
