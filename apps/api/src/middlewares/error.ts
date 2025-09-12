import type { ErrorRequestHandler, RequestHandler } from "express";
import { z, ZodError } from "zod";

type WithStatus = { status?: number };

const getStatus = (err: unknown): number => {
	if (typeof err === "object" && err !== null) {
		const rec = err as Record<string, unknown>;
		if (typeof rec.status === "number") return rec.status;
	}
	return 500;
};

const getMessage = (err: unknown): string =>
	err instanceof Error && err.message ? err.message : "Internal Server Error";

export const notFoundHandler: RequestHandler = (_req, _res, next) => {
	const err = Object.assign(new Error("Not Found"), { status: 404 } as WithStatus);
	next(err);
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
	if (err instanceof ZodError) {
		const details = z.treeifyError(err);
		return res.status(400).json({ error: "ValidationError", details });
	}

	const status = getStatus(err);
	const message = getMessage(err);
	if (status >= 500) console.error(err);
	res.status(status).json({ error: message });
};
