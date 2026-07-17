import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

export default [
  { ignores: ["dist/**"] },
  js.configs.recommended,

  // Browser app source (React + JSX). `__COMMIT_HASH__` is injected by Vite's
  // `define` at build time (see vite.config.js).
  {
    files: ["src/**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, __COMMIT_HASH__: "readonly" },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
    },
  },

  // shadcn/ui primitives intentionally co-export their `cva` variants next to
  // the component; fast-refresh doesn't apply to these leaf files.
  {
    files: ["src/components/ui/**/*.{js,jsx}"],
    rules: { "react-refresh/only-export-components": "off" },
  },

  // Node-run build tooling (Vite config, one-shot scripts).
  {
    files: ["*.config.js", "scripts/**/*.{js,mjs}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...globals.node },
    },
  },

  // Vitest unit tests (pure lib functions, node environment).
  {
    files: ["src/**/*.test.{js,jsx}"],
    languageOptions: { globals: { ...globals.node } },
  },
];
