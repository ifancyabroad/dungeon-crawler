import { useMutation } from "@tanstack/react-query";
import { api } from "../../lib/api";
import type { CreateGameResponse, CurrentGameResponse } from "./types";

export function useCreateGame() {
	return useMutation({
		mutationFn: () => api.post("game").json<CreateGameResponse>(),
	});
}

export function useContinueGame() {
	return useMutation({
		mutationFn: () => api.get("game").json<CurrentGameResponse>(),
	});
}
