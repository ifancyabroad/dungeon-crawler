import { useMutation } from "@tanstack/react-query";
import { api } from "../../lib/api";
import type { CreateGameOptions, CreateGameResponse, CurrentGameResponse } from "./types";

export function useCreateGame() {
	return useMutation<CreateGameResponse, Error, CreateGameOptions | void>({
		mutationFn: (options) =>
			api.post("game", { json: options ?? {} }).json<CreateGameResponse>(),
	});
}

export function useContinueGame() {
	return useMutation({
		mutationFn: () => api.get("game").json<CurrentGameResponse>(),
	});
}
