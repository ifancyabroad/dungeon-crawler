import http from "node:http";
import { Server } from "socket.io";
import { buildApp } from "./app";
import { connectDB } from "./config/db";
import { env } from "./config/env";
import { attachSocket } from "./socket";

const DEV = env.NODE_ENV !== "production";
const socketOrigin = DEV ? "http://localhost:5173" : process.env.WEB_ORIGIN || false;

async function main() {
	await connectDB();
	const app = buildApp();
	const server = http.createServer(app);
	const io = new Server(server, {
		cors: { origin: socketOrigin, credentials: true },
	});
	attachSocket(io);

	server.listen(env.PORT, () => {
		console.log(`🚀 API listening on http://localhost:${env.PORT}`);
	});
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
