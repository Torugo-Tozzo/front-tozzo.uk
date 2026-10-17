/// <reference types="vitest/config" />
import path from "node:path"
import { defineConfig } from "vite"
import solid from "vite-plugin-solid"
import { visualizer } from "rollup-plugin-visualizer"

export default defineConfig({
  plugins: [
    solid(),
    // `bun run analyze`: chunk sizes in dist/stats.html (plan: measure each phase).
    process.env.ANALYZE ? visualizer({ filename: "dist/stats.html", gzipSize: true }) : null,
  ],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          // Give chart libraries their own group; Rolldown then emits its runtime
          // separately, so the toaster cannot pull ECharts into other pages.
          groups: [{ name: 'echarts', test: /node_modules[\/](?:echarts|zrender)[\/]/ }],
        },
      },
    },
  },
  server: {
    port: 5175,
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  test: {
    environment: "happy-dom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.mjs"],
    restoreMocks: true,
  },
})
