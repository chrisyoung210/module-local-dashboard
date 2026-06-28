import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  resolve: {
    alias: {
      "module_dashboard_protocol": resolve(
        __dirname,
        "../module_dashboard_protocol"
      ),
    },
  },
  test: {
    environment: "node",
    include: ["src-ui/**/*.test.ts", "src-ui/**/*.test.tsx"]
  }
});
