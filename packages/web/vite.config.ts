import { defineConfig } from "vite";

// Rutas relativas: el mismo build sirve en Pages (/tejo/) y desde `tejo view` (/) (decisión #66).
export default defineConfig({
  base: "./",
});
