import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// 5175 (5173=regime-regular, 5174=simples-nacional); /api e /health proxy p/ API :8080.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5175,
    proxy: {
      "/api": { target: process.env.API_URL ?? "http://localhost:8080", changeOrigin: true },
      "/health": { target: process.env.API_URL ?? "http://localhost:8080", changeOrigin: true },
    },
  },
});
