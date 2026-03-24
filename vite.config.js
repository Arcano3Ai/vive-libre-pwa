import { defineConfig } from "vite";

export default defineConfig({
  base: "/",
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
});
