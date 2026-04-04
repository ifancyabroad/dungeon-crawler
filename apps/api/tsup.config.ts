import { defineConfig } from "tsup";

export default defineConfig({
	entry: ["src/server.ts"],
	format: ["cjs"],
	platform: "node",
	target: "node20",
	bundle: true,
	// Bundle everything — workspace packages and npm deps — into a single file.
	// EB receives only dist/ + Procfile + .ebextensions; no node_modules needed.
	noExternal: [/.*/],
	sourcemap: true,
	clean: true,
});
