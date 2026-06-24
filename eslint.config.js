// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    files: ["src/app/**/*", "src/features/**/*"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/fare",
              message: "Pricing is deferred — see lib/fare/README.md",
            },
          ],
          patterns: [
            {
              group: ["**/lib/fare", "**/lib/fare/**"],
              message: "Pricing is deferred — see lib/fare/README.md",
            },
          ],
        },
      ],
    },
  },
]);
