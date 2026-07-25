import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react()],
    server: {
      proxy: {
        "/auth": env.VITE_BACKEND_URL,
        "/books": env.VITE_BACKEND_URL,
        "/ask": env.VITE_BACKEND_URL,
        "/health": env.VITE_BACKEND_URL,
      },
    },
  };
});