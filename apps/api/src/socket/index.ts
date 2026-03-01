/**
 * Socket.IO: attach to server and register domain handlers per connection.
 * Auth (cookie/token) is resolved here and passed into handlers.
 */

import type { Server } from "socket.io";
import type { Socket } from "socket.io";
import { parseCookie } from "../lib/cookies";
import { registerGameHandlers } from "./game.handlers";

const COOKIE_NAME = "game_token";

function getToken(socket: Socket): string | undefined {
	const cookieHeader = socket.handshake.headers.cookie;
	return parseCookie(typeof cookieHeader === "string" ? cookieHeader : undefined, COOKIE_NAME);
}

export function attachSocket(io: Server): void {
	io.on("connection", (socket: Socket) => {
		registerGameHandlers(io, socket, getToken);
	});
}
