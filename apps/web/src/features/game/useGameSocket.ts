import { useEffect, useRef } from "react";
import type { GameState } from "@app/shared";
import { io } from "socket.io-client";
import { getSocketUrl } from "../../lib/api";
import { useGameStore, setGameSocket } from "./gameStore";
import { useErrorStore } from "../error/errorStore";

/**
 * Connect socket when gameId is present; emit join; on state/error update store.
 * Call from Game page when we have a gameId.
 */
export function useGameSocket(gameId: string | null) {
	const connected = useRef(false);

	useEffect(() => {
		if (!gameId) {
			setGameSocket(null);
			return;
		}

		const url = getSocketUrl();
		const socket = io(url, { withCredentials: true, autoConnect: true });

		socket.on("connect", () => {
			connected.current = true;
			setGameSocket(socket);
			socket.emit("join", { gameId });
		});

		socket.on("state", (payload: { gameId: string; turn: number; state: GameState }) => {
			useGameStore.getState().setStateFromServer({
				gameId: payload.gameId,
				turn: payload.turn,
				state: payload.state,
			});
		});

		socket.on("error", (payload: { reason?: string }) => {
			const reason = payload.reason ?? "Connection or validation issue";
			console.warn("[game socket] error:", reason);
			// turn_mismatch = we're ahead of server (e.g. holding key). Don't revert; server will catch up via state events.
			if (reason !== "turn_mismatch") {
				useGameStore.getState().revertToConfirmed();
			}
			// Only show modal for unexpected errors, not for invalid move or server catching up
			const silentReasons = ["move_blocked", "move_out_of_bounds", "turn_mismatch"];
			if (!silentReasons.includes(reason)) {
				useErrorStore.getState().showError("Position synced with server.");
			}
		});

		socket.on("disconnect", () => {
			connected.current = false;
			setGameSocket(null);
		});

		socket.connect();

		return () => {
			setGameSocket(null);
			socket.removeAllListeners();
			socket.disconnect();
		};
	}, [gameId]);
}
