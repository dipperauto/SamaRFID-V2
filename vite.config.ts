import { defineConfig, loadEnv } from "vite";
import dyadComponentTagger from "@dyad-sh/react-vite-component-tagger";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const backend = env.VITE_BACKEND_URL || "http://localhost:8000";

  return {
    server: {
      host: "localhost",
      port: 8080,
      proxy: {
        "/api": {
          target: backend,
          changeOrigin: true,
          secure: false,
        },
        "/static": {
          target: backend,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    plugins: [dyadComponentTagger(), react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});