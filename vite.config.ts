import { readFileSync, writeFileSync } from "node:fs";
import { crx, type ManifestV3Export } from "@crxjs/vite-plugin";
import solid from "vite-plugin-solid";
import { defineConfig } from "vite";
import manifest from "./manifest.json" with { type: "json" };

export default defineConfig(({ mode }) => {
  const isFirefox = mode === "firefox";

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
  } as unknown as ManifestV3Export;

  function stripUseDynamicUrl() {
    return {
      name: "strip-use-dynamic-url",
      closeBundle() {
        if (!isFirefox) return;
        const p = "dist-firefox/manifest.json";
        const m = JSON.parse(readFileSync(p, "utf8"));
        for (const r of m.web_accessible_resources ?? []) delete r.use_dynamic_url;
        writeFileSync(p, `${JSON.stringify(m, null, 2)}\n`);
      },
    };
  }

  return {
    plugins: [
      solid({ dev: false }),
      crx({ manifest: baseManifest, contentScripts: { preambleCode: false } }),
      stripUseDynamicUrl(),
    ],
    define: { "process.env.NODE_ENV": JSON.stringify("production") },
    build: {
      target: "esnext",
      minify: true,
      outDir: isFirefox ? "dist-firefox" : "dist",
      sourcemap: false,
    },
  };
});
