/**
 * What the card says about a tapped feature: its name, what it is, the
 * units it belongs to, and the facts its table carries.
 *
 * The facts are read generically. A table column brings its own label key,
 * format and source, so a new column (area, altitude) shows up here without
 * a line of card code.
 */
import type { SourceInfo } from "../data/format.ts";
import type { Feature } from "../map/labels.ts";
import { classOf, roadSet } from "./roads.ts";
import type { Fact, MapStore, Table } from "./store.ts";

export interface InfoFact {
  /** Translation key of the label. */
  readonly label: string;
  readonly value: number;
  readonly format: Fact["format"];
  readonly source: SourceInfo | undefined;
}

export interface FeatureInfo {
  readonly name: string;
  /** Translation key of what the feature is: `kinds.province`, `kinds.town_0`, ... */
  readonly kind: string;
  /** The units it lies in, nearest first. */
  readonly parents: readonly string[];
  readonly facts: readonly InfoFact[];
}

/** The facts of one table row. A value of zero means "not known" and is left out. */
function factsOf(store: MapStore, facts: readonly Fact[], row: number): InfoFact[] {
  return facts
    .map((fact) => ({
      label: fact.label,
      value: fact.values[row] ?? 0,
      format: fact.format,
      source: store.source(fact.source),
    }))
    .filter((fact) => fact.value !== 0);
}

const rowInfo = (store: MapStore, table: Table, row: number, kind: string, parents: string[]): FeatureInfo => ({
  name: table.names[row] ?? "",
  kind,
  parents,
  facts: factsOf(store, table.facts, row),
});

/**
 * Describe a feature from what is loaded. Null when its own table is not
 * there (yet). A town's parents need the borders chunk: until that has
 * arrived the town is described without them.
 */
export function describeFeature(store: MapStore, feature: Feature): FeatureInfo | null {
  const provinces = store.overview?.provinces;
  const detail = store.detail;
  switch (feature.kind) {
    case "province":
      return provinces === undefined ? null : rowInfo(store, provinces, feature.row, "kinds.province", []);
    case "district": {
      if (detail === undefined || provinces === undefined) return null;
      const province = detail.districts.parent?.[feature.row] ?? -1;
      return rowInfo(store, detail.districts, feature.row, "kinds.district", [provinces.names[province] ?? ""]);
    }
    case "municipality": {
      if (detail === undefined || provinces === undefined) return null;
      const district = detail.municipalities.parent?.[feature.row] ?? -1;
      return rowInfo(store, detail.municipalities, feature.row, "kinds.municipality", [
        detail.districts.names[district] ?? "",
        provinces.names[detail.provinceOf[feature.row] ?? -1] ?? "",
      ]);
    }
    case "city": {
      const places = store.places;
      if (places === undefined) return null;
      const name = places.names[feature.row] ?? "";
      const parents: string[] = [];
      const municipality = places.municipality[feature.row] ?? -1;
      if (detail !== undefined && provinces !== undefined && municipality >= 0) {
        const district = detail.municipalities.parent?.[municipality] ?? -1;
        parents.push(
          detail.municipalities.names[municipality] ?? "",
          detail.districts.names[district] ?? "",
          provinces.names[detail.provinceOf[municipality] ?? -1] ?? "",
        );
      }
      return {
        name,
        kind: `kinds.town_${places.kind[feature.row] ?? 2}`,
        parents,
        facts: factsOf(store, places.facts, feature.row),
      };
    }
    case "peak": {
      const peaks = store.peaks;
      if (peaks === undefined) return null;
      const x = peaks.at[feature.row * 2] as number;
      const y = peaks.at[feature.row * 2 + 1] as number;
      const parents: string[] = [];
      const municipality = store.municipalityIndex?.locate(x, y) ?? -1;
      if (detail !== undefined && provinces !== undefined && municipality >= 0) {
        const district = detail.municipalities.parent?.[municipality] ?? -1;
        parents.push(
          detail.municipalities.names[municipality] ?? "",
          detail.districts.names[district] ?? "",
          provinces.names[detail.provinceOf[municipality] ?? -1] ?? "",
        );
      } else if (provinces !== undefined && store.overview !== undefined) {
        const province = store.overview.index.locate(x, y);
        if (province >= 0) parents.push(provinces.names[province] ?? "");
      }
      return { name: peaks.names[feature.row] ?? "", kind: "kinds.peak", parents, facts: factsOf(store, peaks.facts, feature.row) };
    }
    case "road": {
      const roads = roadSet(store, classOf(feature.ref));
      const route = roads?.refs.indexOf(feature.ref) ?? -1;
      if (roads === undefined || route < 0) return null;
      const name = roads.names[route] ?? "";
      const kinds: Record<string, string> = { A: "kinds.motorway", S: "kinds.expressway", B: "kinds.main_road" };
      return {
        // "A1 · West Autobahn"; a route without a name of its own is its number.
        name: name === "" ? feature.ref : `${feature.ref} · ${name}`,
        kind: kinds[feature.ref[0] ?? "A"] ?? "kinds.motorway",
        parents: [],
        facts: [],
      };
    }
    case "river": {
      const source = store.sources().find((entry) => entry.id === "bmluk-ggn");
      return {
        name: feature.name,
        // Stream order 5 is where the map's overview starts: a river from there up.
        kind: feature.order >= 5 ? "kinds.river" : "kinds.stream",
        parents: [],
        facts: [{ label: "facts.stream_order", value: feature.order, format: "integer", source }],
      };
    }
  }
}
