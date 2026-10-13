import { LitElement, html, nothing, type PropertyValues, type TemplateResult } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";

import { normaliseConfig, type NormalisedConfig } from "./config.ts";
import { CARD_NAME, CARD_TAG, CARD_VERSION, REPO_URL } from "./const.ts";
import "./editor.ts";
import { describeFeature, type FeatureInfo } from "./layers/info.ts";
import { sharedLoader, type ChunkLoader } from "./layers/loader.ts";
import { LAYERS, chunksFor, type LayerDef } from "./layers/registry.ts";
import { localize, resolveLang } from "./localize/localize.ts";
import {
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
import { MapGesture, ZOOM_STEP, keyCommand, wheelFactor } from "./map/gestures.ts";
import type { Feature } from "./map/labels.ts";
import { derivePalette, readTheme } from "./map/palette.ts";
import { MapRenderer, type RenderState } from "./map/renderer.ts";
import { cardStyles } from "./styles.ts";
import { PROVINCE_IDS, type HomeAssistant, type LayerId } from "./types.ts";

console.info(
  `%c AUSTRIA-MAP-CARD %c ${CARD_VERSION} `,
  "color:#fff;background:#c8102e;font-weight:600",
  "color:#c8102e;background:#fff",
);

/** Pixels kept free round a feature that "zoom here" frames. */
const FRAME_PADDING = 28;
const TOAST_MS = 1800;
const LICENCE_URL = "https://creativecommons.org/licenses/by/4.0/";

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

  @query("canvas") private _canvas?: HTMLCanvasElement;
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
  }

  /** Re-render only when something the card shows changed. Home Assistant
   *  reassigns `hass` on every state change in the house. */
  protected override shouldUpdate(changed: PropertyValues<this>): boolean {
    if (changed.size === 1 && changed.has("hass")) return this._hassFingerprint() !== this._hassKey;
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
    if (changed.has("hass")) this._hassKey = this._hassFingerprint();
    this._refreshPalette(false);
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
    renderer.setPalette(derivePalette(theme));
    this._requestDraw();
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
    this._setCamera(zoomAbout(this._camera, size, size.width / 2, size.height / 2, factor));
  }

  private _resetView(): void {
    const camera = this._openingCamera();
    if (camera) this._setCamera(camera);
  }

  // ── Drawing ────────────────────────────────────────────────────────────

  private _state(camera: Camera): RenderState {
    return {
      camera,
      layers: this._layers,
      showLabels: this._config.show_labels,
      selection: this._selection,
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
    renderer.draw(this._state(camera));
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
    this._gesture.down(event.pointerId, ...this._local(event));
    canvas.classList.add("dragging");
  }

  private _onPointerMove(event: PointerEvent): void {
    const size = this._renderer?.size;
    if (!this._camera || !size) return;
    const camera = this._gesture.move(event.pointerId, ...this._local(event), this._camera, size);
    if (camera !== null && camera !== this._camera) this._setCamera(camera);
  }

  private _onPointerUp(event: PointerEvent): void {
    const [x, y] = this._local(event);
    const release = this._gesture.up(event.pointerId, event.type !== "pointerup", performance.now());
    if (!this._gesture.active) (event.currentTarget as HTMLElement).classList.remove("dragging");
    const renderer = this._renderer;
    if (!renderer || !this._camera) return;
    if (release === "double-tap") {
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
      this._setCamera(zoomAbout(this._camera, size, ...this._local(event), wheelFactor(event.deltaY)));
    },
    passive: false,
  };

  private _onKeyDown(event: KeyboardEvent): void {
    // Shortcuts with a modifier belong to the browser.
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const command = keyCommand(event.key);
    const renderer = this._renderer;
    if (!command || !renderer || !this._camera) return;
    event.preventDefault();
    const size = renderer.size;
    if (command.kind === "pan") this._setCamera(panBy(this._camera, size, command.dx, command.dy));
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
            class=${classMap({ zoomed: zoom > 1.0001 })}
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
          ></canvas>
          <span class="crosshair" aria-hidden="true"></span>
          <span id="map-help" class="sr-only">${this._t("card.map_help")}</span>
          ${ready ? nothing : this._renderLoading()} ${this._renderToolbar(zoom)}
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
