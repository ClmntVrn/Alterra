import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["node_modules/"] },
  js.configs.recommended,
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.browser
    },
    rules: {
      eqeqeq: "error",
      "no-var": "error",
      "prefer-const": "error",
      "no-unused-vars": ["error", { argsIgnorePattern: "^_", ignoreRestSiblings: true }]
    }
  },
  {
    files: ["sw.js"],
    languageOptions: { sourceType: "script", globals: globals.serviceworker }
  },
  {
    files: ["src/ui/theme.js"],
    languageOptions: { sourceType: "script" }
  },
  {
    files: ["eslint.config.js", "tests/**/*.js", "tools/**/*.js"],
    languageOptions: { globals: globals.node }
  }
];
