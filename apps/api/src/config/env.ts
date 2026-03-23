import "dotenv/config";

function required(name: string): string {
	const v = process.env[name];
	if (!v) throw new Error(`Missing required env var: ${name}`);
	return v;
}

const nodeEnv = process.env.NODE_ENV ?? "development";
const pepper = process.env.GAME_TOKEN_PEPPER ?? "";

if (nodeEnv === "production" && !pepper) {
	throw new Error("GAME_TOKEN_PEPPER is required in production");
}

let pepperWarningLogged = false;
if (nodeEnv !== "production" && !pepper && !pepperWarningLogged) {
	pepperWarningLogged = true;
	console.warn("[env] GAME_TOKEN_PEPPER is empty; token hashing is insecure in dev/test.");
}

export const env = {
	NODE_ENV: nodeEnv,
	PORT: Number(process.env.PORT ?? 4000),
	MONGO_URI: required("MONGO_URI"),
	GAME_TOKEN_PEPPER: pepper,
	/** Optional. When set, enables debug API routes (POST /api/debug/*). Must not be set in production. */
	DEBUG_SECRET: process.env.DEBUG_SECRET ?? "",
};
