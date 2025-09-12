import { buildApp } from "./app";
import { connectDB } from "./config/db";
import { env } from "./config/env";

async function main() {
	await connectDB();
	const app = buildApp();
	app.listen(env.PORT, () => {
		console.log(`🚀 API listening on http://localhost:${env.PORT}`);
	});
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
