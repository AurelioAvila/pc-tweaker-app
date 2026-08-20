import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

// The app predates this config, so the baseline is `recommended` rather than
// the uninstaller's strictTypeChecked: the goal is a CI gate that catches
// real mistakes today without demanding a rewrite of 4,500 working lines.
// New modules extracted out of App.tsx are expected to stay clean under it,
// and the tier can be raised once the split is complete.
export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
    },
  },
  {
    // Legacy code carried over from the pre-split monolith: the
    // React-Compiler-era rules stay visible as warnings here and get fixed
    // for real as each site is reworked (two are analyzer false positives on
    // async loaders; two are deliberate, commented reset/animation-sync
    // patterns). Never add new code that needs this.
    files: [
      "src/App.tsx",
      "src/components/gaming.tsx",
      "src/components/maintenance.tsx",
      "src/components/startup.tsx",
    ],
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/component-hook-factories": "warn",
    },
  },
  {
    ignores: [
      "dist/",
      "src-tauri/",
      "node_modules/",
      "backend/",
      "marketing/",
      "site/",
      "scripts/",
    ],
  },
);
