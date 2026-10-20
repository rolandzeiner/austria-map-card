import { LitElement, html, nothing, type PropertyValues, type TemplateResult } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";

import { normaliseConfig, type NormalisedConfig } from "./config.ts";
import { CARD_NAME, CARD_TAG, CARD_VERSION, REPO_URL } from "./const.ts";
import "./editor.ts";
import { describeFeature, type FeatureInfo } from "./layers/info.ts";
import { sharedLoader, type ChunkLoader } from "./layers/loader.ts";
import { LAYERS, chunksFor, type LayerDef } from "./layers/registry.ts";
import { locate, locationKey, type Position } from "./location.ts";
import { localize, resolveLang } from "./localize/localize.ts";
import {
  clampCamera,
  fitBox,
  homeCamera,
  panBy,
  resizeCamera,
  zoomAbout,
  zoomOf,
  MAX_ZOOM,
  type Camera,
  type Size,
} from "./map/camera.ts";
import { MapGesture, ZOOM_STEP, keyCommand, wheelFactor, type Pose } from "./map/gestures.ts";
import type { Feature } from "./map/labels.ts";
import { derivePalette, readTheme, type Palette } from "./map/palette.ts";
import { project, type MapPoint } from "./map/projection.ts";
import { ReliefGL } from "./map/relief-gl.ts";
import { reliefLines } from "./map/relief-lines.ts";
import { MapRenderer, type RenderState } from "./map/renderer.ts";
import {
  FLAT,
  TILT_PITCH,
  View3D,
  clampTilted,
  isFlat,
  normalBearing,
  orient,
  panTilted,
  zoomTilted,
  type Orientation,
} from "./map/view3d.ts";
import type { Relief } from "./layers/store.ts";
import { cardStyles } from "./styles.ts";
import { PROVINCE_IDS, type HomeAssistant, type LayerId } from "./types.ts";
import { MAP_HEIGHT, MAP_WIDTH } from "./map/projection.ts";

console.info(
  `%c AUSTRIA-MAP-CARD %c ${CARD_VERSION} `,
  "color:#fff;background:#c8102e;font-weight:600",
  "color:#c8102e;background:#fff",
);

/** Pixels kept free round a feature that "zoom here" frames. */
const FRAME_PADDING = 28;
/** Map units shown on either side of the pin by "show your location". */
const HERE_SURROUNDINGS = 14;
const TOAST_MS = 1800;
const LICENCE_URL = "https://creativecommons.org/licenses/by/4.0/";

/** Pixels across of the flat map laid over the relief. */
const DRAPE_WIDTH = 3072;
const TILT_MS = 450;

/** Whether this browser can draw the tilted map at all. */
const canTilt = (): boolean => typeof WebGL2RenderingContext !== "undefined";

/** Flat ground, for the moment between tilting and the relief arriving. */
let flatGround: Relief | undefined;
const flatRelief = (): Relief =>
  (flatGround ??= { columns: MAP_WIDTH, rows: MAP_HEIGHT, metres: new Float32Array(MAP_WIDTH * MAP_HEIGHT), peak: 0 });

/** What a layer's line in the layer list says under its name, if anything. */
type LayerNote = "zoom" | "loading" | "failed" | null;

@customElement(CARD_TAG)
export class AustriaMapCard extends LitElement {
  static override styles = cardStyles;

  @property({ attribute: false }) public hass?: HomeAssistant;

  @state() private _config: NormalisedConfig = normaliseConfig({ type: `custom:${CARD_TAG}` });
  /** The layers that are on. Starts from the config; changes last for the session. */
  @state() private _layers: ReadonlySet<LayerId> = new Set(this._config.layers);
  @state() private _selection: Feature | null = null;
  @state() private _layersOpen = false;
  @state() private _toast = false;
  /** What Enter found nothing under; cleared by the next selection. */
  @state() private _nothingHere = false;
  /** Bumped when something the template shows changed outside Lit's view. */
  @state() private _revision = 0;
  /** Tilt and compass heading; FLAT is the plain map. Lasts for the session. */
  @state() private _orientation: Orientation = FLAT;
  /** False once WebGL 2 turned out not to be there. */
  @state() private _canTilt = canTilt();
  /** The browser's answer when the pin follows this device. */
  @state() private _device: Position | null = null;

  @query("canvas.map") private _canvas?: HTMLCanvasElement;
  @query("canvas.relief") private _reliefCanvas?: HTMLCanvasElement;
  @query(".stage") private _stage?: HTMLElement;
  @query(".probe") private _probe?: HTMLElement;
  @query(".layers-button") private _layersButton?: HTMLButtonElement;

  private _camera: Camera | null = null;
  private _renderer?: MapRenderer;
  private readonly _loader: ChunkLoader = sharedLoader({ base: import.meta.url, version: CARD_VERSION });
  private readonly _gesture = new MapGesture();
  private _unsubscribe?: () => void;
  private _resizeObserver?: ResizeObserver;
  private _raf = 0;
  private _toastTimer?: ReturnType<typeof setTimeout>;
  private _hassKey = "";
  private _paletteKey = "";
  private _viewKey = "";
  private _locationKey = "";
  private _watch: number | null = null;
  /** The WebGL renderer, made the first time the map tilts. */
  private _gl: ReliefGL | null = null;
  private _drape?: { canvas: HTMLCanvasElement; renderer: MapRenderer; key: string };
  private _palette?: Palette;
  private _tiltRaf = 0;
  /** The right mouse button or Shift turns and tilts instead of moving. */
  private _turning = false;

  // ── HA card contract ───────────────────────────────────────────────────

  public setConfig(config: unknown): void {
    const next = normaliseConfig(config);
    const previous = this._config;
    this._config = next;
    // Editing the config resets what it describes, and only that: a new
    // list of layers replaces the session's, a new opening view moves the map.
    if (next.layers.join() !== previous.layers.join()) this._layers = new Set(next.layers);
    if (next.view !== previous.view) this._camera = this._openingCamera();
    if (!next.show_layer_control) this._layersOpen = false;
    if (this.isConnected) this._syncDeviceWatch();
    this._requestDraw();
  }

  public getCardSize(): number {
    return 8;
  }

  public getGridOptions(): Record<string, number> {
    return { columns: 12, rows: 7, min_columns: 6, min_rows: 5 };
  }

  public static getStubConfig(): Record<string, unknown> {
    return {};
  }

  public static getConfigElement(): HTMLElement {
    // Synchronous on purpose: the editor module is imported at the top of
    // this file, so the element is always registered by now.
    return document.createElement(`${CARD_TAG}-editor`);
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────

  override connectedCallback(): void {
    super.connectedCallback();
    this._unsubscribe = this._loader.subscribe(this._onData);
    document.addEventListener("pointerdown", this._onDocumentPointer, true);
    this._syncDeviceWatch();
    if (this._renderer) {
      this._observe();
      // The theme may have changed while the card was detached, and a card
      // moved before its first update never got a palette at all.
      void this.updateComplete.then(() => this._refreshPalette(true));
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this._unsubscribe?.();
    document.removeEventListener("pointerdown", this._onDocumentPointer, true);
    this._resizeObserver?.disconnect();
    cancelAnimationFrame(this._raf);
    this._raf = 0;
    clearTimeout(this._toastTimer);
    this._gesture.reset();
    this._stopDeviceWatch();
    cancelAnimationFrame(this._tiltRaf);
    this._tiltRaf = 0;
  }

  /** Re-render only when something the card shows changed. Home Assistant
   *  reassigns `hass` on every state change in the house. */
  protected override shouldUpdate(changed: PropertyValues<this>): boolean {
    if (changed.size === 1 && changed.has("hass")) {
      return this._hassFingerprint() !== this._hassKey || this._currentLocationKey() !== this._locationKey;
    }
    return true;
  }

  protected override firstUpdated(): void {
    const canvas = this._canvas;
    if (!canvas) return;
    try {
      this._renderer = new MapRenderer(canvas, this._loader.store, () => new Path2D());
    } catch (error) {
      console.error("[austria-map-card] no canvas to draw on", error);
      return;
    }
    this._observe();
    this._loader.request(["base"]);
  }

  protected override updated(changed: PropertyValues<this>): void {
    const themeChanged = changed.has("hass") && this._hassFingerprint() !== this._hassKey;
    if (changed.has("hass")) this._hassKey = this._hassFingerprint();
    this._refreshPalette(false);
    // Home Assistant writes a new theme's variables onto the document in
    // its own update; read once more after the next frame, when they are
    // certain to have landed.
    if (themeChanged) requestAnimationFrame(() => this._refreshPalette(true));
    const location = this._currentLocationKey();
    if (location !== this._locationKey) {
      this._locationKey = location;
      this._requestDraw();
    }
  }

  private _observe(): void {
    const stage = this._stage;
    if (!stage) return;
    this._resizeObserver?.disconnect();
    this._resizeObserver = new ResizeObserver((entries) => this._onResize(entries[0]?.contentRect));
    this._resizeObserver.observe(stage);
  }

  private _onResize(box: { width: number; height: number } | undefined): void {
    const renderer = this._renderer;
    if (!box || !renderer) return;
    const size: Size = { width: Math.floor(box.width), height: Math.floor(box.height) };
    if (size.width <= 0 || size.height <= 0) return;
    const before = renderer.size;
    if (size.width === before.width && size.height === before.height) return;
    renderer.resize(size.width, size.height, window.devicePixelRatio);
    if (this._gl && this._reliefCanvas) this._gl.resize(this._reliefCanvas, size.width, size.height, window.devicePixelRatio);
    // Being laid out means being in the document: a good moment to retry a
    // palette read that failed earlier.
    if (!renderer.hasPalette) this._refreshPalette(true);
    this._camera =
      this._camera !== null && before.width > 0 ? resizeCamera(this._camera, before, size) : this._openingCamera();
    this._drawNow();
  }

  // ── Theme ──────────────────────────────────────────────────────────────

  private _isDark(): boolean {
    return this.hass?.themes?.darkMode ?? window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  private _hassFingerprint(): string {
    const hass = this.hass;
    return [resolveLang(hass), hass?.themes?.darkMode, hass?.themes?.theme, hass?.selectedTheme?.theme].join("|");
  }

  /** Re-read the canvas colours when the theme changed or an earlier read
   *  failed. The key is only stored on success, so a read taken while the
   *  card was detached is tried again. */
  private _refreshPalette(force: boolean): void {
    const renderer = this._renderer;
    const probe = this._probe;
    if (!renderer || !probe) return;
    const key = this._hassFingerprint();
    if (!force && key === this._paletteKey && renderer.hasPalette) return;
    const theme = readTheme(probe, this._isDark());
    if (theme === null) {
      this._paletteKey = "";
      return;
    }
    this._paletteKey = key;
    this._palette = derivePalette(theme);
    renderer.setPalette(this._palette);
    this._requestDraw();
  }

  // ── Location ───────────────────────────────────────────────────────────

  private _currentLocationKey(): string {
    const config = this._config;
    return config.show_location ? locationKey(this.hass, config.location, this._device) : "";
  }

  /** Where the pin goes, in map units, or null for no pin. */
  private _here(): MapPoint | null {
    const config = this._config;
    if (!config.show_location) return null;
    const here = locate(this.hass, config.location, this._device);
    return here === null ? null : project(here.latitude, here.longitude);
  }

  /** Follow the browser's position while the pin asks for this device, and
   *  only then: the permission prompt comes from the first watch. */
  private _syncDeviceWatch(): void {
    const wanted = this._config.show_location && this._config.location === "device";
    if (!wanted) {
      this._stopDeviceWatch();
      return;
    }
    const geolocation = typeof navigator === "undefined" ? undefined : navigator.geolocation;
    if (this._watch !== null || geolocation === undefined) return;
    this._watch = geolocation.watchPosition(
      (fix) => (this._device = { latitude: fix.coords.latitude, longitude: fix.coords.longitude }),
      // Refused, or no fix: the pin stays on the home (src/location.ts).
      (error) => console.warn("[austria-map-card] no device position:", error.message),
      { maximumAge: 60_000, timeout: 30_000 },
    );
  }

  private _stopDeviceWatch(): void {
    if (this._watch === null) return;
    navigator.geolocation?.clearWatch(this._watch);
    this._watch = null;
  }

  private _goHere(): void {
    const here = this._here();
    const size = this._renderer?.size;
    if (here === null || !size) return;
    const [x, y] = here;
    this._setCamera(
      fitBox([x - HERE_SURROUNDINGS, y - HERE_SURROUNDINGS, x + HERE_SURROUNDINGS, y + HERE_SURROUNDINGS], size, 0),
    );
  }

  // ── Camera ─────────────────────────────────────────────────────────────

  /** The view the card opens on and resets to: the country, or one province. */
  private _openingCamera(): Camera | null {
    const size = this._renderer?.size;
    if (!size || size.width === 0) return null;
    const view = this._config.view;
    if (view === "austria") return homeCamera(size);
    // A province's outline comes with the base chunk; until then, the country.
    const overview = this._loader.store.overview;
    if (overview === undefined) return null;
    return fitBox(overview.index.box(PROVINCE_IDS.indexOf(view)), size, 16);
  }

  private _setCamera(camera: Camera): void {
    this._camera = camera;
    this._requestDraw();
  }

  private _zoomBy(factor: number): void {
    const size = this._renderer?.size;
    if (!this._camera || !size) return;
    if (!this._flat) this._setCamera(zoomTilted(this._camera, size, factor));
    else this._setCamera(zoomAbout(this._camera, size, size.width / 2, size.height / 2, factor));
  }

  private _resetView(): void {
    const camera = this._openingCamera();
    this._stopTilt();
    this._orientation = FLAT;
    if (camera) this._setCamera(camera);
  }

  // ── Tilt and turn ──────────────────────────────────────────────────────

  /** True while the plain map is drawn: no tilt, north up, or no WebGL. */
  private get _flat(): boolean {
    return isFlat(this._orientation) || !this._canTilt;
  }

  /** The WebGL renderer, made on first use; null where there is none. */
  private _relief(): ReliefGL | null {
    if (this._gl !== null || !this._canTilt) return this._gl;
    const canvas = this._reliefCanvas;
    const size = this._renderer?.size;
    if (!canvas || !size) return null;
    this._gl = ReliefGL.create(canvas);
    if (this._gl === null) {
      this._canTilt = false;
      this._orientation = FLAT;
      return null;
    }
    this._gl.resize(canvas, size.width, size.height, window.devicePixelRatio);
    return this._gl;
  }

  /** Apply a pose from a gesture or a key. Back at no tilt and near north,
   *  the map snaps flat and the flat camera's limits apply again. */
  private _setPose(pose: Pose): void {
    const size = this._renderer?.size;
    if (!size) return;
    let { orientation } = pose;
    if (orientation.pitch === 0 && Math.abs(orientation.bearing) < 0.05) orientation = FLAT;
    this._orientation = orientation;
    this._setCamera(isFlat(orientation) ? clampCamera(pose.camera, size) : clampTilted(pose.camera, size));
  }

  private _orientBy(pitch: number, bearing: number): void {
    if (!this._camera || !this._canTilt) return;
    this._stopTilt();
    this._setPose({ camera: this._camera, orientation: orient(this._orientation, pitch, bearing) });
  }

  private _stopTilt(): void {
    cancelAnimationFrame(this._tiltRaf);
    this._tiltRaf = 0;
  }

  /** Ease to an orientation, the short way round; at once with reduced motion. */
  private _tiltTo(target: Orientation): void {
    this._stopTilt();
    const from = this._orientation;
    const turn = normalBearing(target.bearing - from.bearing);
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      if (this._camera) this._setPose({ camera: this._camera, orientation: target });
      return;
    }
    const start = performance.now();
    const step = (now: number): void => {
      const t = Math.min(1, (now - start) / TILT_MS);
      const eased = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      const camera = this._camera;
      if (!camera) return;
      this._setPose({
        camera,
        orientation:
          t >= 1
            ? target
            : { pitch: from.pitch + (target.pitch - from.pitch) * eased, bearing: normalBearing(from.bearing + turn * eased) },
      });
      this._tiltRaf = t < 1 ? requestAnimationFrame(step) : 0;
    };
    this._tiltRaf = requestAnimationFrame(step);
  }

  private _toggleTilt(): void {
    this._tiltTo(this._orientation.pitch > 0 ? FLAT : { pitch: TILT_PITCH, bearing: this._orientation.bearing });
  }

  private _faceNorth(): void {
    this._tiltTo({ pitch: this._orientation.pitch, bearing: 0 });
  }

  /** The layers painted into the picture laid over the relief: only the
   *  terrain fills an area. Lines and towns are drawn sharp, over it. */
  private _drapeLayers(): ReadonlySet<LayerId> {
    return new Set(this._layers.has("terrain") ? (["terrain"] as const) : []);
  }

  /** Redraw the flat map that covers the relief, when what it shows changed. */
  private _updateDrape(gl: ReliefGL): void {
    const palette = this._palette;
    if (palette === undefined) return;
    if (this._drape === undefined) {
      const canvas = document.createElement("canvas");
      this._drape = { canvas, renderer: new MapRenderer(canvas, this._loader.store, () => new Path2D()), key: "" };
      this._drape.renderer.resize(DRAPE_WIDTH, Math.round((DRAPE_WIDTH * MAP_HEIGHT) / MAP_WIDTH), 1, DRAPE_WIDTH);
    }
    const drape = this._drape;
    const layers = this._drapeLayers();
    const selection = this._selection?.kind === "city" ? null : this._selection;
    const key = [this._loader.store.revision, [...layers].join(), this._paletteKey, JSON.stringify(selection)].join("|");
    if (key === drape.key) return;
    drape.key = key;
    drape.renderer.setPalette(palette);
    drape.renderer.draw({
      camera: { x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2, k: DRAPE_WIDTH / MAP_WIDTH },
      layers,
      showLabels: false,
      selection,
      here: null,
      fillsOnly: true,
    });
    gl.setDrape(drape.canvas, key);
  }

  // ── Drawing ────────────────────────────────────────────────────────────

  private _state(camera: Camera): RenderState {
    return {
      camera,
      layers: this._layers,
      showLabels: this._config.show_labels,
      selection: this._selection,
      here: this._here(),
    };
  }

  private _requestDraw(): void {
    if (!this._raf && this.isConnected) this._raf = requestAnimationFrame(this._frame);
  }

  private readonly _frame = (): void => {
    this._raf = 0;
    this._drawNow();
  };

  private _drawNow(): void {
    const renderer = this._renderer;
    if (!renderer) return;
    this._camera ??= this._openingCamera();
    const camera = this._camera ?? homeCamera(renderer.size);
    // Ask for whatever this view needs; what is already there costs nothing.
    this._loader.request(chunksFor(this._layers, camera.k));
    const gl = this._flat ? null : this._relief();
    if (gl === null || gl.lost) {
      if (this._reliefCanvas) this._reliefCanvas.hidden = true;
      if (gl?.lost) {
        this._canTilt = false;
        this._orientation = FLAT;
      }
      renderer.draw(this._state(camera));
    } else {
      if (this._reliefCanvas) this._reliefCanvas.hidden = false;
      this._loader.request(["relief", ...chunksFor(this._drapeLayers(), DRAPE_WIDTH / MAP_WIDTH)]);
      const store = this._loader.store;
      gl.setRelief(store.relief ?? flatRelief());
      this._updateDrape(gl);
      const view = new View3D(camera, this._orientation, renderer.size, store.relief);
      gl.draw(view, this._palette ? reliefLines(store, this._layers, camera.k, this._selection, this._palette) : []);
      renderer.drawTilted(this._state(camera), view);
    }
    this._syncView(camera, renderer.size);
  }

  /** Tell the template when the view crossed something it shows: a zoom
   *  limit, or the scale from which a layer draws. */
  private _syncView(camera: Camera, size: Size): void {
    const zoom = zoomOf(camera, size);
    const key = [
      zoom <= 1.0001,
      zoom >= MAX_ZOOM - 0.0001,
      ...LAYERS.map((layer) => camera.k >= layer.minScale),
    ].join();
    if (key === this._viewKey) return;
    this._viewKey = key;
    this._revision += 1;
  }

  private readonly _onData = (): void => {
    this._revision += 1;
    this._requestDraw();
  };

  // ── Pointer, wheel and keyboard ────────────────────────────────────────

  private _local(event: PointerEvent | WheelEvent): [number, number] {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    return [event.clientX - rect.left, event.clientY - rect.top];
  }

  private _onPointerDown(event: PointerEvent): void {
    const canvas = event.currentTarget as HTMLCanvasElement;
    canvas.setPointerCapture?.(event.pointerId);
    this._stopTilt();
    this._turning = this._canTilt && (event.button === 2 || event.shiftKey);
    this._gesture.down(event.pointerId, ...this._local(event));
    canvas.classList.add("dragging");
  }

  private _onPointerMove(event: PointerEvent): void {
    const size = this._renderer?.size;
    if (!this._camera || !size) return;
    if (this._canTilt) {
      const pose = { camera: this._camera, orientation: this._orientation };
      const next = this._gesture.movePose(event.pointerId, ...this._local(event), pose, size, this._turning);
      if (next !== null && (next.camera !== pose.camera || next.orientation !== pose.orientation)) this._setPose(next);
      return;
    }
    const camera = this._gesture.move(event.pointerId, ...this._local(event), this._camera, size);
    if (camera !== null && camera !== this._camera) this._setCamera(camera);
  }

  /** The right mouse button turns the map, so its menu stays shut. */
  private _onContextMenu(event: MouseEvent): void {
    if (this._canTilt) event.preventDefault();
  }

  private _onPointerUp(event: PointerEvent): void {
    const [x, y] = this._local(event);
    const release = this._gesture.up(event.pointerId, event.type !== "pointerup", performance.now());
    if (!this._gesture.active) (event.currentTarget as HTMLElement).classList.remove("dragging");
    const renderer = this._renderer;
    if (!renderer || !this._camera) return;
    if (release === "double-tap" && !this._flat) {
      // Zoom in on the tapped ground: it comes to the middle.
      const view = new View3D(this._camera, this._orientation, renderer.size, this._loader.store.relief);
      const at = view.pick(x, y, this._loader.store.relief);
      const camera = at === null ? this._camera : { ...this._camera, x: at[0], y: at[1] };
      this._setCamera(zoomTilted(camera, renderer.size, ZOOM_STEP * ZOOM_STEP));
    } else if (release === "double-tap") {
      this._setCamera(zoomAbout(this._camera, renderer.size, x, y, ZOOM_STEP * ZOOM_STEP));
    } else if (release === "tap") {
      this._select(renderer.hit(this._state(this._camera), x, y));
    }
  }

  private readonly _wheel = {
    handleEvent: (event: WheelEvent): void => {
      // Plain scrolling belongs to the dashboard. Zoom only with Ctrl or
      // Cmd; a trackpad pinch arrives as Ctrl + wheel, so that works too.
      if (!(event.ctrlKey || event.metaKey)) {
        this._toast = true;
        clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => (this._toast = false), TOAST_MS);
        return;
      }
      event.preventDefault();
      const size = this._renderer?.size;
      if (!this._camera || !size) return;
      if (!this._flat) this._setCamera(zoomTilted(this._camera, size, wheelFactor(event.deltaY)));
      else this._setCamera(zoomAbout(this._camera, size, ...this._local(event), wheelFactor(event.deltaY)));
    },
    passive: false,
  };

  private _onKeyDown(event: KeyboardEvent): void {
    // Shortcuts with a modifier belong to the browser.
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const command = keyCommand(event.key, event.shiftKey, this._canTilt);
    const renderer = this._renderer;
    if (!command || !renderer || !this._camera) return;
    event.preventDefault();
    const size = renderer.size;
    if (command.kind === "pan") {
      this._setCamera(
        this._flat
          ? panBy(this._camera, size, command.dx, command.dy)
          : panTilted(this._camera, this._orientation, size, command.dx, command.dy),
      );
    } else if (command.kind === "orient") this._orientBy(command.pitch, command.bearing);
    else if (command.kind === "zoom") this._zoomBy(command.factor);
    else if (command.kind === "reset") this._resetView();
    else {
      // What is under the crosshair, drawn as it is now.
      this._drawNow();
      const hit = renderer.hit(this._state(this._camera), size.width / 2, size.height / 2);
      this._select(hit);
      this._nothingHere = hit === null;
    }
  }

  // ── Selection ──────────────────────────────────────────────────────────

  private _select(feature: Feature | null): void {
    this._selection = feature;
    this._nothingHere = false;
    // A town's municipality, district and province are in the borders chunk.
    if (feature?.kind === "city") this._loader.request(["borders"]);
    this._requestDraw();
  }

  private _zoomToSelection(): void {
    const renderer = this._renderer;
    if (!renderer || this._selection === null) return;
    const box = renderer.boxOf(this._selection);
    if (box) this._setCamera(fitBox(box, renderer.size, FRAME_PADDING));
  }

  // ── Layers ─────────────────────────────────────────────────────────────

  private _toggleLayer(id: LayerId): void {
    const next = new Set(this._layers);
    if (!next.delete(id)) next.add(id);
    this._layers = next;
    this._requestDraw();
  }

  private _layerNote(layer: LayerDef): LayerNote {
    if (!this._layers.has(layer.id)) return null;
    const scale = this._camera?.k ?? 0;
    if (scale < layer.minScale) return "zoom";
    const states = ["base" as const, ...layer.chunks(scale)].map((id) => this._loader.state(id));
    if (states.includes("failed") || states.includes("outdated")) return "failed";
    return states.includes("loading") ? "loading" : null;
  }

  private _closeLayers(returnFocus: boolean): void {
    if (!this._layersOpen) return;
    this._layersOpen = false;
    if (returnFocus) this._layersButton?.focus();
  }

  /** A press anywhere outside the layer list and its button closes the list. */
  private readonly _onDocumentPointer = (event: PointerEvent): void => {
    if (!this._layersOpen) return;
    const path = event.composedPath();
    const inside = path.some(
      (node) => node instanceof HTMLElement && (node.classList.contains("layers") || node.classList.contains("layers-button")),
    );
    if (!inside) this._closeLayers(false);
  };

  private _onLayersKeyDown(event: KeyboardEvent): void {
    if (event.key !== "Escape") return;
    event.stopPropagation();
    this._closeLayers(true);
  }

  // ── Template ───────────────────────────────────────────────────────────

  private _t(key: string, vars?: Record<string, string | number>): string {
    return localize(key, resolveLang(this.hass), vars);
  }

  protected override render(): TemplateResult {
    // Read so the template is rebuilt when the loader or the view changes.
    void this._revision;
    const config = this._config;
    const loader = this._loader;
    const ready = loader.state("base") === "ready";
    const size = this._renderer?.size;
    const zoom = this._camera && size ? zoomOf(this._camera, size) : 1;
    return html`
      <ha-card>
        <span class="probe" aria-hidden="true"></span>
        ${config.title ? html`<h2 class="title">${config.title}</h2>` : nothing}
        <div class="stage">
          <canvas
            class=${classMap({ map: true, zoomed: zoom > 1.0001, tilted: !this._flat })}
            tabindex="0"
            role="application"
            aria-label=${this._t("card.map_label")}
            aria-describedby="map-help"
            @pointerdown=${this._onPointerDown}
            @pointermove=${this._onPointerMove}
            @pointerup=${this._onPointerUp}
            @pointercancel=${this._onPointerUp}
            @wheel=${this._wheel}
            @keydown=${this._onKeyDown}
            @contextmenu=${this._onContextMenu}
          ></canvas>
          ${this._canTilt ? html`<canvas class="relief" aria-hidden="true" hidden></canvas>` : nothing}
          <span class="crosshair" aria-hidden="true"></span>
          <span id="map-help" class="sr-only"
            >${this._t("card.map_help")}${this._canTilt ? ` ${this._t("card.map_help_tilt")}` : ""}</span
          >
          ${ready ? nothing : this._renderLoading()} ${this._renderReliefLoading()} ${this._renderToolbar(zoom)}
          ${this._layersOpen && config.show_layer_control ? this._renderLayers() : nothing} ${this._renderNotice()}
        </div>
        ${this._renderInfo()} ${this._renderCredit()}
      </ha-card>
    `;
  }

  private _renderLoading(): TemplateResult | typeof nothing {
    const state = this._loader.state("base");
    if (state === "failed" || state === "outdated") return nothing;
    return html`<div class="loading" role="status">${this._t("card.loading")}</div>`;
  }

  private _renderReliefLoading(): TemplateResult | typeof nothing {
    if (this._flat || this._loader.state("relief") !== "loading") return nothing;
    return html`<div class="toast" role="status">${this._t("card.loading_relief")}</div>`;
  }

  private _tool(label: string, icon: string, onClick: () => void, disabled = false): TemplateResult {
    return html`
      <button type="button" class="tool" aria-label=${label} title=${label} ?disabled=${disabled} @click=${onClick}>
        <ha-icon icon=${icon} aria-hidden="true"></ha-icon>
      </button>
    `;
  }

  /** Buttons for everything a drag or a pinch does: the single-pointer
   *  alternative (WCAG 2.5.1, 2.5.7). */
  private _renderToolbar(zoom: number): TemplateResult {
    const layersLabel = this._t("controls.layers");
    return html`
      <div class="toolbar" role="group" aria-label=${this._t("controls.group")}>
        ${this._config.show_layer_control
          ? html`
              <button
                type="button"
                class="tool layers-button"
                aria-label=${layersLabel}
                title=${layersLabel}
                aria-expanded=${this._layersOpen ? "true" : "false"}
                aria-controls="layers"
                @click=${() => (this._layersOpen = !this._layersOpen)}
              >
                <ha-icon icon="mdi:layers-outline" aria-hidden="true"></ha-icon>
              </button>
              <span class="tool-gap"></span>
            `
          : nothing}
        ${this._tool(this._t("controls.zoom_in"), "mdi:plus", () => this._zoomBy(ZOOM_STEP), zoom >= MAX_ZOOM - 0.0001)}
        ${this._tool(this._t("controls.zoom_out"), "mdi:minus", () => this._zoomBy(1 / ZOOM_STEP), zoom <= 1.0001)}
        ${this._tool(this._t("controls.reset"), "mdi:fit-to-screen-outline", () => this._resetView())}
        ${this._canTilt
          ? html`
              <button
                type="button"
                class="tool"
                aria-label=${this._t("controls.tilt")}
                title=${this._t("controls.tilt")}
                aria-pressed=${this._orientation.pitch > 0 ? "true" : "false"}
                @click=${() => this._toggleTilt()}
              >
                <ha-icon icon="mdi:rotate-3d-variant" aria-hidden="true"></ha-icon>
              </button>
            `
          : nothing}
        ${this._canTilt && this._orientation.bearing !== 0
          ? html`
              <button
                type="button"
                class="tool compass"
                aria-label=${this._t("controls.north")}
                title=${this._t("controls.north")}
                @click=${() => this._faceNorth()}
              >
                <ha-icon
                  icon="mdi:navigation"
                  aria-hidden="true"
                  style=${`transform: rotate(${-this._orientation.bearing}rad)`}
                ></ha-icon>
              </button>
            `
          : nothing}
        ${this._config.show_location
          ? this._tool(this._t("controls.my_location"), "mdi:crosshairs-gps", () => this._goHere(), this._here() === null)
          : nothing}
      </div>
    `;
  }

  private _renderLayers(): TemplateResult {
    return html`
      <div id="layers" class="layers" role="group" aria-labelledby="layers-title" @keydown=${this._onLayersKeyDown}>
        <h3 id="layers-title">${this._t("controls.layers")}</h3>
        ${LAYERS.map((layer) => {
          const note = this._layerNote(layer);
          return html`
            <button
              type="button"
              class="layer"
              role="switch"
              aria-checked=${this._layers.has(layer.id) ? "true" : "false"}
              @click=${() => this._toggleLayer(layer.id)}
            >
              <ha-icon icon=${layer.icon} aria-hidden="true"></ha-icon>
              <span class="layer-text">
                <span>${this._t(`layers.${layer.id}`)}</span>
                ${note ? html`<span class="layer-note">${this._t(`layer_notes.${note}`)}</span>` : nothing}
              </span>
              <span class="switch" aria-hidden="true"></span>
            </button>
          `;
        })}
      </div>
    `;
  }

  /** What went wrong with the data, and the one thing that fixes it. */
  private _renderNotice(): TemplateResult | typeof nothing {
    const loader = this._loader;
    if (loader.outdated) {
      return html`
        <div class="notice" role="alert">
          <span>${this._t("card.outdated")}</span>
          <button type="button" class="text" @click=${() => window.location.reload()}>${this._t("card.reload")}</button>
        </div>
      `;
    }
    if (loader.failed.length > 0) {
      return html`
        <div class="notice" role="alert">
          <span>${this._t("card.load_failed")}</span>
          <button type="button" class="text" @click=${() => loader.retry()}>${this._t("card.retry")}</button>
        </div>
      `;
    }
    return this._toast ? html`<div class="toast" role="status">${this._t("card.zoom_hint")}</div>` : nothing;
  }

  private _number(value: number): string {
    try {
      return new Intl.NumberFormat(resolveLang(this.hass)).format(value);
    } catch {
      return String(value);
    }
  }

  private _renderFacts(info: FeatureInfo): TemplateResult | typeof nothing {
    if (info.facts.length === 0) return nothing;
    return html`
      <dl class="facts">
        ${info.facts.map(
          (fact) => html`
            <div>
              <dt>${this._t(fact.label)}</dt>
              <dd>
                ${this._number(fact.value)}
                ${fact.source
                  ? html`<span class="fact-source"
                      >${this._t("facts.source", { holder: fact.source.holder, stand: fact.source.stand })}</span
                    >`
                  : nothing}
              </dd>
            </div>
          `,
        )}
      </dl>
    `;
  }

  /** What was tapped, under the map: no tooltip that a finger would cover.
   *  The text is a live region, so Enter on the map reads it out; the
   *  buttons sit beside it and are not read along. */
  private _renderInfo(): TemplateResult {
    const info = this._selection === null ? null : describeFeature(this._loader.store, this._selection);
    return html`
      <section class="info" aria-label=${this._t("card.info_label")}>
        <div class="info-text" aria-live="polite" aria-atomic="true">
          ${info === null
            ? html`<p class="info-idle">${this._t(this._nothingHere ? "card.nothing_here" : "card.info_idle")}</p>`
            : html`
                <p class="info-name">
                  <span lang="de">${info.name}</span>
                  <span class="info-kind">${this._t(info.kind)}</span>
                </p>
                ${info.parents.length > 0
                  ? html`<p class="info-parents" lang="de">${[...new Set(info.parents)].filter((name) => name !== info.name).join(" · ")}</p>`
                  : nothing}
                ${this._renderFacts(info)}
              `}
        </div>
        ${info === null
          ? nothing
          : html`
              <div class="info-actions">
                <button type="button" class="text" @click=${this._zoomToSelection}>${this._t("controls.zoom_here")}</button>
                <button
                  type="button"
                  class="icon"
                  aria-label=${this._t("controls.clear")}
                  title=${this._t("controls.clear")}
                  @click=${() => this._select(null)}
                >
                  <ha-icon icon="mdi:close" aria-hidden="true"></ha-icon>
                </button>
              </div>
            `}
      </section>
    `;
  }

  /** Who the data is from, assembled from the chunks that are loaded. */
  private _renderCredit(): TemplateResult | typeof nothing {
    const sources = this._loader.store.sources();
    if (sources.length === 0) return nothing;
    const holders = [...new Set(sources.map((source) => source.holder))].join(", ");
    const licence = sources[0]?.licence ?? "";
    return html`
      <p class="credit">
        ${this._t("card.credit", { holders })} ·
        <a href=${LICENCE_URL} target="_blank" rel="noopener noreferrer">${licence}</a>
      </p>
    `;
  }
}

// ── Picker registration ──────────────────────────────────────────────────

interface CustomCardEntry {
  type: string;
  name: string;
  description?: string;
  preview?: boolean;
  documentationURL?: string;
}
const registry = window as unknown as { customCards?: CustomCardEntry[] };
registry.customCards ??= [];
if (!registry.customCards.some((card) => card.type === CARD_TAG)) {
  registry.customCards.push({
    type: CARD_TAG,
    name: CARD_NAME,
    description: "A zoomable map of Austria with terrain, rivers, borders and towns.",
    preview: true,
    documentationURL: REPO_URL,
  });
}

declare global {
  interface HTMLElementTagNameMap {
    "austria-map-card": AustriaMapCard;
  }
}
