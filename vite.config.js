import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import cesium from "vite-plugin-cesium";

export default defineConfig({
  plugins: [react(), cesium()],
  base: "./", // important if you serve from a folder or not the domain root
  build: {
    outDir: "kartbetjanten", // or another folder name if you prefer
  },
});
