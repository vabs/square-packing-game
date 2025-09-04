import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // For GitHub Pages project site deployment at https://vabs.github.io/square-packing-game/
  // ensure asset URLs are prefixed with the repository name.
  base: "/square-packing-game/",
});