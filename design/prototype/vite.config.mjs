import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  publicDir: false,
  plugins: [react()],
  server: { host: "127.0.0.1", port: 3204, strictPort: true },
  preview: { host: "127.0.0.1", port: 3204, strictPort: true },
  build: { outDir: "dist", emptyOutDir: true },
});
