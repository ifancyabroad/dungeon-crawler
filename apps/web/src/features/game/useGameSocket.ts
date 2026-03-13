import { useEffect, useRef } from "react";
import type { GameEvent, GameState } from "@app/shared";
import { io } from "socket.io-client";
import { getSocketUrl } from "../../lib/api";
import { useGameStore, setGameSocket } from "./gameStore";
import { useErrorStore } from "../error/errorStore";

/**
 * Connect socket when gameId is present; emit join; on state/error update store.
 * Call from Game page when we have a gameId.
 *
 * The socket ref is only exposed to the store AFTER the server confirms join via a
 * "state" event. This prevents actions from being emitted on an unauthorised socket
 * between reconnect and the server's join acknowledgement.
 */
export function useGameSocket(gameId: string | null) {
	const joinedRef = useRef(false);

	useEffect(() => {
		if (!gameId) {
			setGameSocket(null);
			return;
		}

		const url = getSocketUrl();
		const socket = io(url, { withCredentials: true, autoConnect: true });

		socket.on("connect", () => {
			joinedRef.current = false;
			socket.emit("join", { gameId });
		});

		socket.on(
			"state",
			(payload: { gameId: string; turn: number; state: GameState; events?: GameEvent[] }) => {
				// Expose the socket to the store on the first state after (re)connect so that
				// actions queued during disconnect are flushed with the correct auth context.
				if (!joinedRef.current) {
					joinedRef.current = true;
					setGameSocket(socket);
				}
				useGameStore.getState().setStateFromServer({
					gameId: payload.gameId,
					turn: payload.turn,
					state: payload.state,
					events: payload.events,
				});
			},
		);

		socket.on("error", (payload: { reason?: string }) => {
			const reason = payload.reason ?? "Connection or validation issue";
			console.warn("[game socket] error:", reason);
			// turn_mismatch = we're ahead of server (e.g. holding key). Don't revert; server will catch up via state events.
			if (reason !== "turn_mismatch") {
				useGameStore.getState().revertToConfirmed();
			}
			// Only show modal for unexpected errors, not for invalid move or server catching up
			const silentReasons = [
				"move_blocked",
				"move_blocked_by_enemy",
				"move_out_of_bounds",
				"attack_no_target",
				"attack_out_of_bounds",
				"turn_mismatch",
			];
			if (!silentReasons.includes(reason)) {
				useErrorStore.getState().showError("Position synced with server.");
			}
		});

		socket.on("disconnect", () => {
			joinedRef.current = false;
			setGameSocket(null);
		});

		socket.connect();

		return () => {
			joinedRef.current = false;
			setGameSocket(null);
			socket.removeAllListeners();
			socket.disconnect();
		};
	}, [gameId]);
}
