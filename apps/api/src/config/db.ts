import mongoose from "mongoose";
import { env } from "./env";

export async function connectDB() {
	mongoose.set("strictQuery", true);
	await mongoose.connect(env.MONGO_URI);
	console.log("✅ Mongo connected");

	// Validate that transactions are supported (replica set required).
	try {
		const session = await mongoose.startSession();
		await session.withTransaction(async () => {});
		await session.endSession();
	} catch (err) {
		throw new Error(
			"Transactions are not supported. Use a MongoDB replica set (e.g. local rs or Atlas). " +
				(err instanceof Error ? err.message : String(err)),
		);
	}

	mongoose.connection.on("error", (err) => {
		console.error("Mongo connection error:", err);
	});
}

/**
 * Run fn inside a MongoDB transaction. Replica set required.
 */
export async function runTransaction<T>(
	fn: (session: mongoose.mongo.ClientSession) => Promise<T>,
): Promise<T> {
	const session = await mongoose.startSession();
	try {
		return await session.withTransaction(fn);
	} finally {
		await session.endSession();
	}
}
