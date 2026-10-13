import { LitElement, html, nothing, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import { normaliseConfig, type NormalisedConfig } from "./config.ts";
import { CARD_NAME, CARD_TAG, CARD_VERSION, REPO_URL } from "./const.ts";
import "./editor.ts";
import { cardStyles } from "./styles.ts";
import type { HomeAssistant } from "./types.ts";

console.info(
  `%c AUSTRIA-MAP-CARD %c ${CARD_VERSION} `,
  "color:#fff;background:#c8102e;font-weight:600",
  "color:#c8102e;background:#fff",
);

@customElement(CARD_TAG)
export class AustriaMapCard extends LitElement {
  static override styles = cardStyles;

  @property({ attribute: false }) public hass?: HomeAssistant;

  @state() private _config: NormalisedConfig = normaliseConfig({ type: `custom:${CARD_TAG}` });

  public setConfig(config: unknown): void {
    this._config = normaliseConfig(config);
  }

  public getCardSize(): number {
    return 7;
  }

  public getGridOptions(): Record<string, number> {
    return { columns: 12, rows: 7, min_columns: 6, min_rows: 4 };
  }

  public static getStubConfig(): Record<string, unknown> {
    return {};
  }

  public static getConfigElement(): HTMLElement {
    // Synchronous on purpose: the editor module is imported at the top of
    // this file, so the element is always registered by now.
    return document.createElement(`${CARD_TAG}-editor`);
  }

  protected override render(): TemplateResult {
    const config = this._config;
    return html`
      <ha-card>
        ${config.title ? html`<h2 class="title">${config.title}</h2>` : nothing}
      </ha-card>
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
