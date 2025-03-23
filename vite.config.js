import { defineConfig } from "vite";

export default defineConfig({
  esbuild: {
    loader: "jsx",
    include: /\.[jt]sx?$/, // Supports .js, .jsx, .ts, and .tsx
  },
});
