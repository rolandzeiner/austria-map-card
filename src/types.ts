/** Minimal HA shape: only the fields this card touches. */
export interface HomeAssistant {
  /** The user's profile language; older versions only had top-level `language`. */
  locale?: { language?: string } & Record<string, unknown>;
  language?: string;
  themes?: { darkMode?: boolean; theme?: string } & Record<string, unknown>;
  selectedTheme?: { theme?: string; dark?: boolean } | null;
  /** The home's position, from Settings → System → General. */
  config?: { latitude?: number; longitude?: number };
  states?: Record<string, HassEntity | undefined>;
}

export interface HassEntity {
  state: string;
  attributes: Record<string, unknown>;
}

/** Marker every card config extends. */
export interface LovelaceCardConfig {
  type: string;
  [key: string]: unknown;
}

/** The layers the map can draw, in drawing order. */
export const LAYER_IDS = [
  "terrain",
  "rivers",
  "municipalities",
  "districts",
  "provinces",
  "peaks",
  "cities",
] as const;
export type LayerId = (typeof LAYER_IDS)[number];

/** ISO 3166-2 codes of the nine provinces. */
export const PROVINCE_IDS = [
  "AT-1",
  "AT-2",
  "AT-3",
  "AT-4",
  "AT-5",
  "AT-6",
  "AT-7",
  "AT-8",
  "AT-9",
] as const;
export type ProvinceId = (typeof PROVINCE_IDS)[number];

/** What the card opens on: the whole country or one province. */
export type MapView = "austria" | ProvinceId;

/** Where the "you are here" pin comes from: the home, the device showing
 *  the dashboard, or an entity id such as `person.anna`. */
export type LocationSource = "home" | "device" | (string & {});

/** The YAML the user writes. Every key but `type` is optional. */
export interface AustriaMapCardConfig extends LovelaceCardConfig {
  title?: string;
  /** Layers that are on when the card opens. */
  layers?: LayerId[];
  /** Names on the map: provinces, towns, rivers. Default true. */
  show_labels?: boolean;
  /** The layer button on the map. Off locks the layers. Default true. */
  show_layer_control?: boolean;
  /** `austria` or a province code, `AT-1` to `AT-9`. Default `austria`. */
  view?: MapView;
  /** Mark where you are with a pin. Default false. */
  show_location?: boolean;
  /** `home`, `device` or an entity id. Default `home`. */
  location?: LocationSource;
}

// ── ha-form schema ──────────────────────────────────────────────────────
// Subset of HA selector keys; the canonical list lives in the HA frontend,
// src/data/selector.ts.
export interface SelectOption {
  value: string;
  label: string;
}
export type HASelector =
  | { boolean: Record<string, never> }
  | { text: Record<string, never> }
  | { entity: { filter?: ReadonlyArray<{ domain: string }> } }
  | {
      select: {
        mode?: "dropdown" | "list";
        multiple?: boolean;
        options: ReadonlyArray<SelectOption>;
      };
    };

export interface HaFormSchema {
  name: string;
  required?: boolean;
  selector: HASelector;
}
