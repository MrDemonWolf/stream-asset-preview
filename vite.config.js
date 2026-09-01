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

// Content-Security-Policy for the PRODUCTION build only (GitHub Pages can't set
// HTTP headers, and a meta in index.html would break Vite's dev inline scripts).
// style-src allows 'unsafe-inline' because the app uses inline style={{…}} attrs
// and Tailwind's injected styles; no third-party scripts are ever loaded.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://static-cdn.jtvnw.net",
  "font-src 'self'",
  "connect-src 'self' https://api.twitch.tv https://id.twitch.tv",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
].join("; ");

function cspMeta() {
  return {
    name: "inject-csp-meta",
    apply: "build",
    transformIndexHtml(html) {
      return html.replace(
        "</head>",
        `  <meta http-equiv="Content-Security-Policy" content="${CSP}" />\n  </head>`,
      );
    },
  };
}

// base must match the GitHub Pages project subpath: <user>.github.io/stream-asset-preview/
export default defineConfig({
  base: "/stream-asset-preview/",
  define: { __COMMIT_HASH__: JSON.stringify(commitHash()) },
  plugins: [react(), tailwindcss(), cspMeta()],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "./src") },
    // Force a single React instance so newly-optimized deps (e.g. Radix) can't
    // pull a duplicate copy — that triggers "Invalid hook call".
    dedupe: ["react", "react-dom"],
  },
  // Vitest: unit tests live next to the lib helpers. Keep it away from the
  // Playwright specs in e2e/ (those run under `npm run e2e`, not Vitest).
  test: {
    include: ["src/**/*.test.{js,jsx}"],
  },
});
