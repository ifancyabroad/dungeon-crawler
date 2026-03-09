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
			const revertMessage = useGameStore.getState().revertToConfirmed();
			useErrorStore.getState().showError(revertMessage ?? reason);
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
