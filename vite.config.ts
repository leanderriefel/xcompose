import { defineConfig } from "vite";
import { crx } from "@crxjs/vite-plugin";
import { resolve } from "node:path";
import manifest from "./manifest.json" with { type: "json" };

// https://crxjs.dev/vite-plugin
// We use @crxjs/vite-plugin to turn the static manifest into a Vite-aware build.
// It handles HMR in dev, bundling of background/content/popup/options, and
// copies icons/web_accessible_resources automatically.

export default defineConfig(({ mode }) => {
  const isFirefox = mode === "firefox";

  // Firefox still uses MV3 (109+), but needs slightly relaxed CSP for eval? no.
  // We keep the same manifest; @crxjs will adapt `background.service_worker`
  // to `background.scripts` for Firefox if needed. The `browser_specific_settings`
  // is already in manifest.json.

  return {
    // public/ is not needed — manifest + icons are at project root via crx plugin
    // But Vite still copies anything in /public if present.
    plugins: [
      crx({
        manifest: {
          ...manifest,
          // Ensure manifest_version stays 3; crx will rewrite background for Firefox if isFirefox
          ...(isFirefox
            ? {
                // Firefox MV3 still supports service_worker; keep as-is for 109+
                // If you need MV2 fallback, uncomment:
                // background: { scripts: ["src/background.ts"] }
              }
            : {}),
        },
        // contentScripts are bundling via Vite; keep HMR fast
        contentScripts: {
          preambleCode: false,
        },
      }),
    ],

    // For type = module libraries; crx handles entries
    build: {
      outDir: isFirefox ? "dist-firefox" : "dist",
      emptyOutDir: true,
      sourcemap: isFirefox ? "inline" : false,
      target: "esnext",
      // crx sets rollupOptions automatically; we only tweak chunking
      rollupOptions: {
        // Keep content script as single file (IIFE) for X's isolated world
        // @crxjs already does this, but we hint:
        output: {
          chunkFileNames: "assets/[name]-[hash].js",
        },
      },
    },
    esbuild: {
      target: "esnext",
    },

    resolve: {
      alias: {
        "@": resolve(__dirname, "src"),
      },
    },

    // Dev server: needed for HMR injection; not used when loading unpacked via `vite build --watch`
    server: {
      port: 5173,
      strictPort: true,
      hmr: {
        port: 5173,
      },
    },
  };
});
