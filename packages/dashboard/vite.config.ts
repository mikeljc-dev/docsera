import preact from "@preact/preset-vite";
import { defineConfig } from "vite";

export default defineConfig({
  base: "/dashboard/",
  plugins: [preact()],
  server: {
    proxy: {
      "/admin": "http://localhost:3000",
    },
  },
});
