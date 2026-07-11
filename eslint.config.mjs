import { createRequire } from "module";

const require = createRequire(import.meta.url);
const nextConfigPath = require.resolve("eslint-config-next/package.json");
const nextRequire = createRequire(nextConfigPath);

const react = nextRequire("eslint-plugin-react");
const reactHooks = nextRequire("eslint-plugin-react-hooks");
const nextPlugin = nextRequire("@next/eslint-plugin-next");
const importPlugin = nextRequire("eslint-plugin-import");
const jsxA11y = nextRequire("eslint-plugin-jsx-a11y");
const tsPlugin = nextRequire("@typescript-eslint/eslint-plugin");
const tsParser = nextRequire("@typescript-eslint/parser");
const globals = nextRequire("globals");

const eslintConfig = [
  {
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "**/.well-known/workflow/**",
      "src/lib/data/**/*.json",
    ],
  },
  ...tsPlugin.configs["flat/recommended"],
  react.configs.flat.recommended,
  reactHooks.configs["recommended-latest"],
  nextPlugin.flatConfig.recommended,
  nextPlugin.flatConfig.coreWebVitals,
  importPlugin.flatConfigs.recommended,
  jsxA11y.flatConfigs.recommended,
  {
    files: ["**/*.{js,jsx,mjs,cjs,ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    settings: {
      react: {
        version: "detect",
      },
      "import/parsers": {
        [nextRequire.resolve("@typescript-eslint/parser")]: [
          ".ts",
          ".mts",
          ".cts",
          ".tsx",
          ".d.ts",
        ],
      },
      "import/resolver": {
        [nextRequire.resolve("eslint-import-resolver-node")]: {
          extensions: [".js", ".jsx", ".ts", ".tsx"],
        },
        [nextRequire.resolve("eslint-import-resolver-typescript")]: {
          alwaysTryTypes: true,
        },
      },
    },
    rules: {
      "import/no-anonymous-default-export": "warn",
      "react/no-unknown-property": "off",
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "jsx-a11y/alt-text": [
        "warn",
        {
          elements: ["img"],
          img: ["Image"],
        },
      ],
      "jsx-a11y/aria-props": "warn",
      "jsx-a11y/aria-proptypes": "warn",
      "jsx-a11y/aria-unsupported-elements": "warn",
      "jsx-a11y/role-has-required-aria-props": "warn",
      "jsx-a11y/role-supports-aria-props": "warn",
      "react/jsx-no-target-blank": "off",
    },
  },
];

export default eslintConfig;
