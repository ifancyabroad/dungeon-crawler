import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import type {
	CreateGameOptions,
	CreateGameResponse,
	CurrentGameResponse,
	GameStatusResponse,
} from "./types";

export function useCreateGame() {
	return useMutation<CreateGameResponse, Error, CreateGameOptions>({
		mutationFn: (options) => api.post("game", { json: options }).json<CreateGameResponse>(),
	});
}

export function useContinueGame() {
	return useMutation({
		mutationFn: () => api.get("game").json<CurrentGameResponse>(),
	});
}

export function useGameStatus() {
	return useQuery<GameStatusResponse>({
		queryKey: ["gameStatus"],
		queryFn: () => api.get("game/status").json<GameStatusResponse>(),
		staleTime: 30_000,
	});
}
