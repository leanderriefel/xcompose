import { crx } from "@crxjs/vite-plugin";
import solid from "vite-plugin-solid";
import { defineConfig } from "vite";
import manifest from "./manifest.json" with { type: "json" };

const isFirefox = process.argv.join(" ").includes("dist-firefox");

const baseManifest = {
  ...manifest,
  ...(isFirefox
    ? {
        background: {
          scripts: ["src/background.ts"],
          type: "module",
        },
      }
    : {}),
} as unknown as typeof manifest;

export default defineConfig({
  plugins: [solid({ dev: false }), crx({ manifest: baseManifest, contentScripts: { preambleCode: false } })],
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  build: {
    target: "esnext",
    minify: true,
    outDir: isFirefox ? "dist-firefox" : "dist",
    sourcemap: isFirefox ? ("inline" as const) : (false as const),
  },
});
