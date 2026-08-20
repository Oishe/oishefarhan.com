import { defineConfig } from "vite"
import { fileURLToPath } from "node:url"

const dir = (p: string) => fileURLToPath(new URL(p, import.meta.url))

// Built widget bundles are served by Quartz out of its `static/` tree, so a
// production page loads them from /static/explorables/loader.js.
const OUT = dir("../../sites/quartz/quartz/static/explorables")

export default defineConfig({
  // Dev root is `lab/`, so `just lab` opens the widget index at `/`.
  // The alias keeps lab pages importing real source paths (`/src/...`)
  // rather than reaching up out of the dev root.
  root: dir("./lab"),
  resolve: {
    alias: [{ find: /^\/src\//, replacement: dir("./src") + "/" }],
  },
  build: {
    outDir: OUT,
    emptyOutDir: true,
    target: "es2022",
    // Off: this output is committed, and .map files are pure diff noise.
    sourcemap: false,
    rollupOptions: {
      // Only the loader is an entry point. Every widget is reached through a
      // dynamic import inside it, so Rollup splits each one into its own chunk
      // and nothing but the loader is fetched up front.
      input: dir("./src/loader.ts"),
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "[name]-[hash].js",
      },
    },
  },
})
