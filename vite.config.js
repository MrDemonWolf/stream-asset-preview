import { execSync } from "node:child_process";
import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// deployed commit: GITHUB_SHA in CI, git fallback locally, "dev" if neither works
function commitHash() {
  const sha = process.env.GITHUB_SHA;
  if (sha) return sha.slice(0, 7);
  try {
    return execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    return "dev";
  }
}

// base must match the GitHub Pages project subpath: <user>.github.io/stream-asset-preview/
export default defineConfig({
  base: "/stream-asset-preview/",
  define: { __COMMIT_HASH__: JSON.stringify(commitHash()) },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "./src") },
  },
});
