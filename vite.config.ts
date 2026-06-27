import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  resolve: {
    alias: {
      "module_dashboard_protocol/types": resolve(
        __dirname,
        "../module_dashboard_protocol/types/index.ts"
      ),
    },
  },
  test: {
    environment: "node",
    include: ["src-ui/**/*.test.ts", "src-ui/**/*.test.tsx"]
  }
});
