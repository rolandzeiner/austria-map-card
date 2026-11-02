// One config for the whole card toolchain under Vite+ (`vp`): build (Vite 8
// library mode on Rolldown), test (Vitest), lint + type-check (Oxlint with
// tsgolint) and format (Oxfmt).
//
// This build writes one file, dist/austria-map-card.js, and that file holds
// code only. The map's geometry lives in dist/austria-map-data-*.js, which
// scripts/build-data.mjs writes and the card imports at run time, one chunk
// at a time, when a layer or a zoom level first needs it. A Lovelace
// resource loads on every dashboard, map or not, which is why several
// hundred kilobytes of borders may not sit in this bundle.
//
// Decorators are deliberately not configured here. Rolldown reads
// tsconfig.json itself and turns on Lit's legacy (experimental) decorators
// from it.
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { defineConfig } from "vite-plus";

import { CHUNK_IDS, chunkFile } from "./src/data/format.ts";

// A fingerprint of the committed data chunks, baked into the card as
// __DATA_ID__ and sent with every chunk request (`?v=<version>-<id>`), so a
// rebuilt card never reads a chunk the browser cached before the data
// changed: a data build without a version bump reached no browser that had
// the old chunks for its 31-day lifetime. A hash of the files, not a
// time, so the same chunks give the same bundle and CI's byte-for-byte
// check of the committed bundle holds.
function dataId(): string {
  const hash = createHash("sha256");
  const files = CHUNK_IDS.map((id) => `dist/${chunkFile(id)}`);
  if (!files.every((file) => existsSync(file))) return "nodata";
  for (const file of files) hash.update(readFileSync(file));
  return hash.digest("hex").slice(0, 8);
}

// MUST be a legal comment — `/*! ... */` — not `//`. The minifier strips
// ordinary comments including a `//` banner, silently. `comments: { legal:
// true }` below is the other half of the same requirement.
const banner =
  "/*! Austria Map Card — bundled by Rolldown. Edit sources in src/, then `npm run build`. */";

// Dev vs prod comes from Vite's mode: `npm run dev` passes `--mode
// development`. `vp build --watch` alone still builds production.
export default defineConfig(({ mode }) => {
  const dev = mode === "development";
  return {
    define: { __DATA_ID__: JSON.stringify(dataId()) },
    build: {
      // Library mode: one ES module, no index.html, no hashed file name.
      lib: {
        entry: "src/austria-map-card.ts",
        formats: ["es"],
        fileName: () => "austria-map-card.js",
      },
      outDir: "dist",
      // dist/ is shared with the data build: the twelve austria-map-data-*.js
      // chunks sit beside the card and are not part of this graph. Vite
      // empties its output directory before each build by default, which
      // would delete every one of them. With nothing emptied, a dev build's
      // .map stays in dist/; *.js.map is gitignored, so it never ships or
      // trips the drift check.
      emptyOutDir: false,
      copyPublicDir: false,
      target: "es2022",
      sourcemap: dev,
      rolldownOptions: {
        output: {
          banner,
          // One self-contained file for the code; the editor is bundled in.
          codeSplitting: false,
          comments: { legal: true },
          // Set on the Rolldown output, not `build.minify`: Vite's library
          // mode skips whitespace minification for ES output. Keep console.*
          // (dropConsole: false): the calls in catch blocks are the card's
          // only client-side failure signal, and the version line tells you
          // which bundle the browser loaded. dropConsole is all-or-nothing.
          minify: dev ? false : { compress: { dropConsole: false }, mangle: true, codegen: true },
        },
      },
    },
    fmt: {
      // Leave Lit html/css templates alone. Formatting them rewrites the
      // whitespace inside rendered elements, which changes the DOM.
      embeddedLanguageFormatting: "off",
      // Format everything but build output (the bundle and the data
      // chunks), the data build's inputs and downloads, Vitest snapshots,
      // the Markdown and the workflow YAML, which keep their hand formatting.
      ignorePatterns: [
        "dist/**",
        "scripts/data/**",
        ".cache/**",
        "**/*.md",
        ".github/**",
        "**/__snapshots__/**",
      ],
    },
    lint: {
      ignorePatterns: ["dist/**", ".cache/**"],
      // Oxlint's default plugins plus vitest; listing plugins replaces the
      // defaults, so all four are named.
      plugins: ["typescript", "unicorn", "oxc", "vitest"],
      jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
      rules: {
        "vite-plus/prefer-vite-plus-imports": "error",
        // Opt-in rules from the `suspicious` category; the rest of that
        // category is mostly noise for Lit code (e.g. `_private` names).
        "typescript/no-unnecessary-type-assertion": "error",
        "eslint/no-shadow": "error",
        "unicorn/no-array-sort": "error",
        // Test hygiene, from the vitest plugin named in `plugins` above: a committed
        // .only or .skip quietly drops tests, a test without an assertion
        // passes whatever the code does, and a duplicate title makes a
        // failure ambiguous to read.
        "vitest/no-focused-tests": "error",
        "vitest/no-disabled-tests": "error",
        "vitest/no-identical-title": "error",
        "vitest/expect-expect": "error",
        "vitest/no-standalone-expect": "error",
        "vitest/no-conditional-expect": "error",
        "vitest/no-commented-out-tests": "error",
        "vitest/valid-title": "error",
        // expect(value, message) is Vitest API; the rule's default of one
        // argument is Jest's.
        "vitest/valid-expect": ["error", { maxArgs: 2 }],
        // On by default with the plugin; wants a type on every vi.fn().
        // About 60 untyped mocks across the portfolio, no bug behind any.
        "vitest/require-mock-type-parameters": "off",
      },
      // typeCheck: `vp check` also reports TypeScript's own diagnostics,
      // which makes it the pipeline's only type-check.
      // denyWarnings: a warning fails `vp check` (and CI) instead of
      // scrolling past with exit 0.
      options: {
        typeAware: true,
        typeCheck: true,
        denyWarnings: true,
        reportUnusedDisableDirectives: "error",
      },
    },
  };
});
