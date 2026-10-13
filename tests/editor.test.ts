/**
 * @vitest-environment happy-dom
 *
 * The visual editor as Lovelace drives it: it is handed the raw config,
 * shows ha-form the config with every default filled in, and answers each
 * change with a `config-changed` event carrying only what differs.
 */
import { beforeAll, describe, expect, it } from "vitest";

import "../src/editor.ts";
import type { HaFormSchema } from "../src/types.ts";

interface EditorElement extends HTMLElement {
  hass: unknown;
  setConfig(config: Record<string, unknown>): void;
  updateComplete: Promise<boolean>;
}
interface FormElement extends HTMLElement {
  data: Record<string, unknown>;
  schema: ReadonlyArray<HaFormSchema>;
  computeLabel(field: { name: string }): string;
  computeHelper(field: { name: string }): string | undefined;
}

const TYPE = "custom:austria-map-card";

async function mount(config: Record<string, unknown>, language = "de"): Promise<{ editor: EditorElement; form: FormElement }> {
  const editor = document.createElement("austria-map-card-editor") as unknown as EditorElement;
  editor.hass = { locale: { language } };
  editor.setConfig(config);
  document.body.appendChild(editor);
  await editor.updateComplete;
  return { editor, form: editor.shadowRoot?.querySelector("ha-form") as unknown as FormElement };
}

/** What Lovelace receives when ha-form reports a change. */
async function change(editor: EditorElement, form: FormElement, value: Record<string, unknown>): Promise<Record<string, unknown>> {
  let saved: Record<string, unknown> = {};
  editor.addEventListener("config-changed", (event) => {
    saved = (event as CustomEvent<{ config: Record<string, unknown> }>).detail.config;
  });
  form.dispatchEvent(new CustomEvent("value-changed", { detail: { value }, bubbles: true, composed: true }));
  await editor.updateComplete;
  return saved;
}

beforeAll(() => {
  document.body.innerHTML = "";
});

describe("the editor", () => {
  it("is registered under the tag the card asks for", () => {
    expect(customElements.get("austria-map-card-editor")).toBeDefined();
  });

  it("shows a card with no options as the card draws it: defaults on, not blank", async () => {
    const { form } = await mount({ type: TYPE });
    expect(form.data).toMatchObject({
      view: "austria",
      layers: ["terrain", "rivers", "provinces", "cities"],
      show_labels: true,
      show_layer_control: true,
    });
  });

  it("labels its fields and explains the two that need it, in the user's language", async () => {
    const { form } = await mount({ type: TYPE });
    expect(form.schema.map((field) => form.computeLabel(field))).toEqual([
      "Titel",
      "Ansicht beim Öffnen",
      "Ebenen beim Öffnen",
      "Namen auf der Karte anzeigen",
      "Ebenen-Schaltfläche anzeigen",
    ]);
    expect(form.computeHelper({ name: "layers" })).toMatch(/Auf der Karte kannst du/);
    expect(form.computeHelper({ name: "show_layer_control" })).toMatch(/Wanddisplay/);
    expect(form.computeHelper({ name: "title" })).toBeUndefined();
    const english = await mount({ type: TYPE }, "en");
    expect(english.form.computeLabel({ name: "view" })).toBe("Opening view");
  });

  it("offers the layers under the names the map's layer list uses", async () => {
    const { form } = await mount({ type: TYPE });
    const layers = form.schema.find((field) => field.name === "layers")!;
    const options = "select" in layers.selector ? layers.selector.select.options : [];
    expect(options.map((option) => option.label)).toEqual([
      "Gelände",
      "Flüsse",
      "Gemeinden",
      "Bezirke",
      "Bundesländer",
      "Städte und Orte",
    ]);
  });

  it("saves only what was changed, with type first", async () => {
    const { editor, form } = await mount({ type: TYPE });
    const saved = await change(editor, form, { ...form.data, show_labels: false });
    expect(saved).toEqual({ type: TYPE, show_labels: false });
    expect(Object.keys(saved)[0]).toBe("type");
  });

  it("keeps showing the change it just reported: Lovelace does not hand the config back", async () => {
    const { editor, form } = await mount({ type: TYPE });
    await change(editor, form, { ...form.data, view: "AT-5" });
    expect(form.data.view).toBe("AT-5");
    const saved = await change(editor, form, { ...form.data, layers: ["rivers", "terrain"] });
    expect(saved).toEqual({ type: TYPE, view: "AT-5", layers: ["terrain", "rivers"] });
  });

  it("takes a default back out when the user returns to it", async () => {
    const { editor, form } = await mount({ type: TYPE, show_layer_control: false, title: "Karte" });
    const saved = await change(editor, form, { ...form.data, show_layer_control: true, title: "" });
    expect(saved).toEqual({ type: TYPE });
  });

  it("keeps options it does not know, such as the grid options Lovelace adds", async () => {
    const config = { type: TYPE, grid_options: { columns: 12, rows: 8 }, view: "AT-2" };
    const { editor, form } = await mount(config);
    expect(await change(editor, form, { ...form.data, show_labels: false })).toEqual({ ...config, show_labels: false });
  });

  it("still opens on a config the card rejects, so it can be repaired", async () => {
    const { form } = await mount({ type: TYPE, view: "AT-12", layers: ["roads"] });
    expect(form).not.toBeNull();
    expect(form.data).toMatchObject({ view: "AT-12", layers: ["roads"] });
  });

  it("stops the form's own event from reaching the dialog", async () => {
    const { editor, form } = await mount({ type: TYPE });
    let leaked = false;
    editor.addEventListener("value-changed", () => (leaked = true));
    await change(editor, form, { ...form.data });
    expect(leaked).toBe(false);
  });
});
