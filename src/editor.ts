import { LitElement, css, html, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import { LOCATION_MODES, normaliseConfig, tidyConfig } from "./config.ts";
import { CARD_TAG } from "./const.ts";
import { buildSchema } from "./editor-schema.ts";
import { localize, resolveLang } from "./localize/localize.ts";
import type { HomeAssistant } from "./types.ts";

/** An entity id rather than one of the named sources. */
const isEntity = (location: unknown): location is string =>
  typeof location === "string" && !(LOCATION_MODES as ReadonlyArray<string>).includes(location);

/** Visual editor: ha-form over the card's options, shown with the card's
 *  real defaults filled in and saved back with only what you changed. */
@customElement(`${CARD_TAG}-editor`)
export class AustriaMapCardEditor extends LitElement {
  static override styles = css`
    :host {
      display: block;
    }
  `;

  @property({ attribute: false }) public hass?: HomeAssistant;

  // Start from a valid config so the form renders even before setConfig.
  @state() private _config: Record<string, unknown> = { type: `custom:${CARD_TAG}` };
  /** "A person or tracker" is chosen but no entity picked yet. The config
   *  cannot say so: until there is an entity, the pin marks the home. */
  @state() private _entityMode = false;

  public setConfig(config: Record<string, unknown>): void {
    this._config = { ...config };
  }

  private _t = (key: string): string => localize(`editor.${key}`, resolveLang(this.hass));

  private _layerName = (id: string): string => localize(`layers.${id}`, resolveLang(this.hass));

  private _label = ({ name }: { name: string }): string => this._t(name);

  private _helper = ({ name }: { name: string }): string | undefined => {
    const text = this._t(`${name}_helper`);
    return text === `editor.${name}_helper` ? undefined : text;
  };

  /** What the form shows. A config the card would reject (hand-written
   *  YAML with a typo) is shown as it is, so the form still opens and the
   *  error card above it says what is wrong. */
  private _shown(): Record<string, unknown> {
    let shown: Record<string, unknown>;
    try {
      shown = normaliseConfig(this._config);
    } catch {
      shown = this._config;
    }
    // `location` holds an entity id or a named source; the form asks for
    // the kind first and offers the picker for an entity.
    const location = shown.location;
    if (!this._entityMode && !isEntity(location)) return shown;
    return { ...shown, location: "entity", location_entity: isEntity(location) ? location : undefined };
  }

  private _onChange(ev: CustomEvent<{ value: Record<string, unknown> }>): void {
    ev.stopPropagation();
    const { location: choice, location_entity: picked, ...value } = ev.detail.value;
    let location = choice;
    if (choice === "entity") {
      this._entityMode = true;
      location = typeof picked === "string" && picked !== "" ? picked : undefined;
    } else if (choice !== undefined) {
      this._entityMode = false;
    }
    const next = tidyConfig({ ...this._config, ...value, location });
    // Lovelace won't call setConfig again while the dialog is open, so keep
    // our own copy current or the form snaps back on the next render.
    this._config = next;
    this.dispatchEvent(
      new CustomEvent("config-changed", { detail: { config: next }, bubbles: true, composed: true }),
    );
  }

  protected override render(): TemplateResult {
    const shown = this._shown();
    const location = { shown: shown.show_location === true, entity: shown.location === "entity" };
    return html`
      <ha-form
        .hass=${this.hass}
        .data=${shown}
        .schema=${buildSchema(this._t, this._layerName, location)}
        .computeLabel=${this._label}
        .computeHelper=${this._helper}
        @value-changed=${this._onChange}
      ></ha-form>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "austria-map-card-editor": AustriaMapCardEditor;
  }
}
