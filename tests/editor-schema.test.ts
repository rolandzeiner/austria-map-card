import { describe, expect, it } from "vite-plus/test";

import { DEFAULTS } from "../src/config.ts";
import { buildSchema } from "../src/editor-schema.ts";
import { localize } from "../src/localize/localize.ts";
import { LAYER_IDS } from "../src/types.ts";

describe("editor schema", () => {
  for (const lang of ["en", "de"]) {
    const t = (key: string): string => localize(`editor.${key}`, lang);
    const layerName = (id: string): string => localize(`layers.${id}`, lang);
    const schema = buildSchema(t, layerName, { shown: true, entity: true });

    it(`offers a field for every option (${lang})`, () => {
      expect(schema.map((field) => field.name).sort()).toEqual(
        ["title", "location_entity", ...Object.keys(DEFAULTS)].sort(),
      );
    });

    it(`labels every field and every option (${lang})`, () => {
      for (const field of schema) {
        expect(t(field.name), field.name).not.toBe(`editor.${field.name}`);
        if ("select" in field.selector) {
          for (const option of field.selector.select.options) {
            expect(option.label, `${field.name}=${option.value}`).not.toMatch(/^(editor|layers)\./);
          }
        }
      }
    });
  }

  it("asks where the pin comes from only once the pin is on, and for an entity only when one is wanted", () => {
    const names = (shown: boolean, entity: boolean): string[] =>
      buildSchema(
        (key) => key,
        (id) => id,
        { shown, entity },
      ).map((field) => field.name);
    expect(names(false, false)).not.toContain("location");
    expect(names(false, true)).not.toContain("location_entity");
    expect(names(true, false)).toContain("location");
    expect(names(true, false)).not.toContain("location_entity");
    expect(names(true, true).slice(-3)).toEqual(["show_location", "location", "location_entity"]);
  });

  it("offers every layer, in drawing order", () => {
    const layers = buildSchema(
      (key) => key,
      (id) => id,
    ).find((field) => field.name === "layers");
    const options = layers && "select" in layers.selector ? layers.selector.select.options : [];
    expect(options.map((option) => option.value)).toEqual([...LAYER_IDS]);
  });
});
