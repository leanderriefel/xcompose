import { defineConfig } from "vite";
export default defineConfig({
  define: { global: "globalThis" },
  server: { host: "127.0.0.1", port: 5174, strictPort: true },
});
