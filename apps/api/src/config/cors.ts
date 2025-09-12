import cors, { CorsOptions } from "cors";

const DEV = process.env.NODE_ENV !== "production";
const viteOrigin = "http://localhost:5173";
const prodOrigin = process.env.WEB_ORIGIN;

const corsOptions: CorsOptions = {
	origin: DEV ? viteOrigin : prodOrigin || false,
	credentials: false,
};

export const corsMiddleware = cors(corsOptions);
