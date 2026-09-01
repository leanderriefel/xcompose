import { crx } from "@crxjs/vite-plugin";
import solid from "vite-plugin-solid";
import { defineConfig } from "vite";
import manifest from "./manifest.json" with { type: "json" };

export default defineConfig({
  plugins: [solid(), crx({ manifest, contentScripts: { preambleCode: false } })],
  build: { target: "esnext" },
});
