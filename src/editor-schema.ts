import { LOCATION_MODES, VIEWS } from "./config.ts";
import { LAYER_IDS, type HaFormSchema } from "./types.ts";

/** How the editor offers `location`: the two named sources, or an entity. */
const LOCATION_CHOICES = [...LOCATION_MODES, "entity"] as const;

/** What the form shows of the location options. */
export interface LocationFields {
  /** The pin is on, so where it comes from is asked. */
  readonly shown: boolean;
  /** "A person or tracker" is chosen, so the entity picker is offered. */
  readonly entity: boolean;
}

/**
 * The editor's form. `t` resolves a key below `editor.` in the card's own
 * translations; the layer names are the ones the layer button on the map
 * uses, so the two lists cannot drift apart.
 */
export function buildSchema(
  t: (key: string) => string,
  layerName: (id: string) => string,
  location: LocationFields = { shown: false, entity: false },
): ReadonlyArray<HaFormSchema> {
  return [
    { name: "title", selector: { text: {} } },
    {
      name: "view",
      selector: {
        select: {
          mode: "dropdown",
          options: VIEWS.map((value) => ({ value, label: t(`view_${value}`) })),
        },
      },
    },
    {
      name: "layers",
      selector: {
        select: {
          mode: "list",
          multiple: true,
          options: LAYER_IDS.map((value) => ({ value, label: layerName(value) })),
        },
      },
    },
    { name: "show_labels", selector: { boolean: {} } },
    { name: "show_layer_control", selector: { boolean: {} } },
    { name: "show_location", selector: { boolean: {} } },
    ...(location.shown
      ? [
          {
            name: "location",
            selector: {
              select: {
                mode: "dropdown" as const,
                options: LOCATION_CHOICES.map((value) => ({
                  value,
                  label: t(`location_mode_${value}`),
                })),
              },
            },
          },
        ]
      : []),
    ...(location.shown && location.entity
      ? [
          {
            name: "location_entity",
            selector: { entity: { filter: [{ domain: "person" }, { domain: "device_tracker" }] } },
          },
        ]
      : []),
  ];
}
