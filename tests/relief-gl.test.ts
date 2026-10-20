/**
 * The shaders only compile in a browser with WebGL, which no test has. What
 * can be checked here is what made them fail to link once: a uniform that
 * both shaders of a pair declare must have the same precision in both.
 */
import { describe, expect, it } from "vitest";

import { SHADERS } from "../src/map/relief-gl.ts";

/** Uniform name to its declared or default precision. Vertex floats default to highp. */
function uniforms(source: string, stage: "vertex" | "fragment"): Map<string, string> {
  const fallback = stage === "vertex" ? "highp" : (/precision (\w+) float;/.exec(source)?.[1] ?? "none");
  const found = new Map<string, string>();
  for (const match of source.matchAll(/uniform\s+(?:(lowp|mediump|highp)\s+)?(\w+)\s+(\w+)/g)) {
    const [, precision, type, name] = match;
    const floaty = /^(float|vec\d|mat\d)$/.test(type!);
    found.set(name!, precision ?? (floaty ? fallback : "n/a"));
  }
  return found;
}

describe("the shaders", () => {
  for (const [name, pair] of Object.entries(SHADERS)) {
    it(`share every uniform at one precision (${name})`, () => {
      const vertex = uniforms(pair.vertex, "vertex");
      const fragment = uniforms(pair.fragment, "fragment");
      for (const [uniform, precision] of fragment) {
        if (vertex.has(uniform)) expect(precision, uniform).toBe(vertex.get(uniform));
      }
    });

    it(`are GLSL ES 3.00 (${name})`, () => {
      expect(pair.vertex.startsWith("#version 300 es")).toBe(true);
      expect(pair.fragment.startsWith("#version 300 es")).toBe(true);
    });
  }
});
