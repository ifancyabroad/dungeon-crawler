import mongoose from "mongoose";
import { env } from "./env";

export async function connectDB() {
	mongoose.set("strictQuery", true);
	await mongoose.connect(env.MONGO_URI);
	console.log("✅ Mongo connected");

	mongoose.connection.on("error", (err) => {
		console.error("Mongo connection error:", err);
	});
}
