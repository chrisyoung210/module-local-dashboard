import { defineConfig } from "vite";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src-ui/**/*.test.ts", "src-ui/**/*.test.tsx"]
  }
});
