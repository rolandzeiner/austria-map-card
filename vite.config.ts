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
import { defineConfig } from "vite-plus";

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
    build: {
      // Library mode: one ES module, no index.html, no hashed file name.
      lib: {
        entry: "src/austria-map-card.ts",
        formats: ["es"],
        fileName: () => "austria-map-card.js",
      },
      outDir: "dist",
      // dist/ is shared with the data build: the ten austria-map-data-*.js
      // chunks sit beside the card and are not part of this graph. Vite
      // empties its output directory before each build by default, which
      // would delete every one of them. A dev build's .map is gitignored.
      emptyOutDir: false,
      copyPublicDir: false,
      target: "es2022",
      sourcemap: dev,
      rolldownOptions: {
        output: {
          banner,
          // One self-contained file for the code. The editor is bundled in;
          // the data chunks are not part of this graph at all (their URL is
          // computed at run time, so the bundler leaves that import alone).
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
      jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
      rules: {
        "vite-plus/prefer-vite-plus-imports": "error",
        // Opt-in rules from the `suspicious` category; the rest of that
        // category is mostly noise for Lit code (e.g. `_private` names).
        "typescript/no-unnecessary-type-assertion": "error",
        "eslint/no-shadow": "error",
        "unicorn/no-array-sort": "error",
      },
      // typeCheck: `vp check` also reports TypeScript's own diagnostics,
      // which makes it the pipeline's only type-check.
      // denyWarnings: a warning fails `vp check` (and CI) instead of
      // scrolling past with exit 0.
      options: { typeAware: true, typeCheck: true, denyWarnings: true },
    },
  };
});
