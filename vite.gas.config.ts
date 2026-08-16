import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root: fileURLToPath(new URL("./gas-frontend", import.meta.url)),
  base: "",
  plugins: [react()],
  resolve: {
    // Bundel GAS berformat IIFE tanpa code splitting, jadi pdfjs akan ikut ter-inline.
    // Impor rekening koran PDF karena itu dibatasi pada versi web.
    alias: [
      { find: "../lib/pdf-text", replacement: fileURLToPath(new URL("./lib/pdf-text.gas.ts", import.meta.url)) },
    ],
  },
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
  css: {
    postcss: projectRoot,
  },
  build: {
    outDir: fileURLToPath(new URL("./dist/gas-frontend", import.meta.url)),
    emptyOutDir: true,
    target: "es2020",
    minify: "esbuild",
    sourcemap: false,
    cssCodeSplit: false,
    lib: {
      entry: fileURLToPath(new URL("./gas-frontend/main.tsx", import.meta.url)),
      name: "VinnStoreGasApp",
      formats: ["iife"],
      fileName: () => "frontend.js",
      cssFileName: "frontend",
    },
  },
});
