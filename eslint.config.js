import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default [
	// Ignore build outputs & deps everywhere
	{ ignores: ["**/dist/**", "**/node_modules/**"] },

	// Base JS rules
	eslint.configs.recommended,

	// TypeScript rules (fast, no type-checking)
	...tseslint.configs.recommended,

	// Ensure a single tsconfig root so the parser doesn't get confused
	{
		files: ["**/*.{ts,tsx}"],
		languageOptions: {
			parserOptions: { tsconfigRootDir: __dirname },
		},
		rules: {
			"@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
		},
	},

	// Web app: browser globals
	{
		files: ["apps/web/**/*.{ts,tsx}"],
		languageOptions: {
			globals: { window: "readonly", document: "readonly" },
		},
	},

	// API app: node globals
	{
		files: ["apps/api/**/*.ts"],
		languageOptions: {
			globals: { process: "readonly" },
		},
	},

	// Let Prettier handle formatting
	prettier,
];
