import "dotenv/config";

function required(name: string): string {
	const v = process.env[name];
	if (!v) throw new Error(`Missing required env var: ${name}`);
	return v;
}

export const env = {
	NODE_ENV: process.env.NODE_ENV ?? "development",
	PORT: Number(process.env.PORT ?? 4000),
	MONGO_URI: required("MONGO_URI"),
};
