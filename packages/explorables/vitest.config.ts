import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    // `src/dsp/` is pure numerics and must run headless. Anything that needs a
    // DOM belongs in a component, not here.
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
})
