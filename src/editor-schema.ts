import { VIEWS } from "./config.ts";
import { LAYER_IDS, type HaFormSchema } from "./types.ts";

/**
 * The editor's form. `t` resolves a key below `editor.` in the card's own
 * translations; the layer names are the ones the layer button on the map
 * uses, so the two lists cannot drift apart.
 */
export function buildSchema(t: (key: string) => string, layerName: (id: string) => string): ReadonlyArray<HaFormSchema> {
  return [
    { name: "title", selector: { text: {} } },
    {
      name: "view",
      selector: {
        select: { mode: "dropdown", options: VIEWS.map((value) => ({ value, label: t(`view_${value}`) })) },
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
  ];
}
