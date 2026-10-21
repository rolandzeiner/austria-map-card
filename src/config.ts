/**
 * One table of defaults, shared by the card and its editor.
 *
 * ha-form knows nothing about a card's defaults: given a config without a
 * key it draws a boolean as off, a dropdown as blank and a multi-select as
 * empty. So every optional field's default lives in DEFAULTS and nowhere
 * else. The card reads its config through `normaliseConfig`, the editor
 * shows `normaliseConfig(config)` and saves `tidyConfig(next)`.
 */
import {
  LAYER_IDS,
  PROVINCE_IDS,
  type AustriaMapCardConfig,
  type LayerId,
  type LocationSource,
  type MapView,
} from "./types.ts";

export const VIEWS: ReadonlyArray<MapView> = ["austria", ...PROVINCE_IDS];

export const DEFAULTS = {
  layers: ["terrain", "rivers", "provinces", "cities"] as ReadonlyArray<LayerId>,
  show_labels: true,
  show_layer_control: true,
  view: "austria" as MapView,
  show_location: false,
  location: "home" as LocationSource,
} as const;

/** What `location` accepts besides an entity id. */
export const LOCATION_MODES = ["home", "device"] as const;
const ENTITY_ID = /^[a-z_]+\.[a-z0-9_]+$/;

/** The config as the card reads it: every DEFAULTS key is present. */
export interface NormalisedConfig extends AustriaMapCardConfig {
  title: string;
  layers: LayerId[];
  show_labels: boolean;
  show_layer_control: boolean;
  view: MapView;
  show_location: boolean;
  location: LocationSource;
}

/** "" is what a cleared text field or dropdown hands back. An empty list
 *  is a value: a map with every layer switched off. */
const isUnset = (value: unknown): boolean => value === undefined || value === null || value === "";

/** Layers in drawing order, each once, so two configs that mean the same
 *  compare equal however the user ordered them. */
const sortLayers = (layers: ReadonlyArray<LayerId>): LayerId[] =>
  LAYER_IDS.filter((id) => layers.includes(id));

function parseLayers(value: unknown): LayerId[] {
  if (isUnset(value)) return [...DEFAULTS.layers];
  const known: ReadonlyArray<string> = LAYER_IDS;
  if (
    !Array.isArray(value) ||
    value.some((entry) => typeof entry !== "string" || !known.includes(entry))
  ) {
    throw new Error(`"layers" must be a list of: ${LAYER_IDS.join(", ")}.`);
  }
  return sortLayers(value as LayerId[]);
}

function parseFlag(
  config: Record<string, unknown>,
  key: "show_labels" | "show_layer_control" | "show_location",
): boolean {
  const value = config[key];
  if (isUnset(value)) return DEFAULTS[key];
  if (typeof value !== "boolean") throw new Error(`"${key}" must be true or false.`);
  return value;
}

function parseView(value: unknown): MapView {
  if (isUnset(value)) return DEFAULTS.view;
  if (typeof value === "string" && (VIEWS as ReadonlyArray<string>).includes(value))
    return value as MapView;
  throw new Error(`"view" must be one of: ${VIEWS.join(", ")}.`);
}

function parseLocation(value: unknown): LocationSource {
  if (isUnset(value)) return DEFAULTS.location;
  if (
    typeof value === "string" &&
    ((LOCATION_MODES as ReadonlyArray<string>).includes(value) || ENTITY_ID.test(value))
  ) {
    return value;
  }
  throw new Error('"location" must be home, device or an entity id such as person.anna.');
}

function parseTitle(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") throw new Error('"title" must be text.');
  return value.trim();
}

/**
 * Validate the YAML and fill in every default: what the card renders and
 * what the editor shows. Throws with a message Lovelace prints on its error
 * card, so each one names the key and the values it accepts.
 *
 * The user's keys keep their order and the defaults follow them: ha-form
 * saves back in this order, so filling the defaults in first would reorder
 * the saved YAML.
 */
export function normaliseConfig(raw: unknown): NormalisedConfig {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("The card configuration must be a mapping of options.");
  }
  const config = raw as Record<string, unknown>;
  const parsed: Record<string, unknown> = {
    title: parseTitle(config.title),
    layers: parseLayers(config.layers),
    show_labels: parseFlag(config, "show_labels"),
    show_layer_control: parseFlag(config, "show_layer_control"),
    view: parseView(config.view),
    show_location: parseFlag(config, "show_location"),
    location: parseLocation(config.location),
  };
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(config)) out[key] = key in parsed ? parsed[key] : config[key];
  for (const [key, value] of Object.entries(parsed)) if (!(key in out)) out[key] = value;
  return out as NormalisedConfig;
}

const sameLayers = (a: unknown, b: ReadonlyArray<LayerId>): boolean =>
  Array.isArray(a) &&
  sortLayers(a as LayerId[]).join() === sortLayers(b).join() &&
  a.length === b.length;

/**
 * The config as the editor saves it: only what differs from DEFAULTS,
 * cleared fields dropped, `type` first. A default saved into the YAML would
 * be pinned there, and a later change to DEFAULTS would never reach that
 * card.
 */
export function tidyConfig(config: Record<string, unknown>): AustriaMapCardConfig {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(config)) {
    if (isUnset(value)) continue;
    if (key === "layers") {
      if (sameLayers(value, DEFAULTS.layers)) continue;
      out[key] = Array.isArray(value) ? sortLayers(value as LayerId[]) : value;
      continue;
    }
    if (key in DEFAULTS && (DEFAULTS as Record<string, unknown>)[key] === value) continue;
    out[key] = value;
  }
  const { type, ...rest } = out;
  return (type === undefined ? rest : { type, ...rest }) as AustriaMapCardConfig;
}
