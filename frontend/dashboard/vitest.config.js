import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./test/setup.js"],
    setupFilesAfterEnv: ["./test/setup-dom.js"],
    include: ["test/**/*.test.js", "test/**/*.test.jsx"],
    globals: true,
  },
  resolve: {
    alias: {
      "@": "/assets",
    },
  },
});
