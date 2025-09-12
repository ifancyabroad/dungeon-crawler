import express from "express";
import helmet from "helmet";
import compression from "compression";
import { corsMiddleware } from "./config/cors";
import routes from "./routes";
import { errorHandler, notFoundHandler } from "./middlewares/error";

export function buildApp() {
	const app = express();

	// Basic security headers
	app.use(helmet());
	// Simple CORS
	app.use(corsMiddleware);
	// JSON parsing
	app.use(express.json());
	// gzip responses
	app.use(compression());

	// Routes
	app.use("/api", routes);

	// 404 + errors
	app.use(notFoundHandler);
	app.use(errorHandler);

	return app;
}
