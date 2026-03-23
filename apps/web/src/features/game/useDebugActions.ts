import { useMutation, useQuery } from "@tanstack/react-query";
import type { GameState } from "@app/shared";
import { api } from "../../lib/api";

const DEBUG_SECRET = import.meta.env.VITE_DEBUG_SECRET as string | undefined;

function debugHeaders(): Record<string, string> {
	return DEBUG_SECRET ? { "x-debug-secret": DEBUG_SECRET } : {};
}

export function useDebugGodModeStatus(enabled: boolean) {
	return useQuery({
		queryKey: ["debugGodMode"],
		queryFn: () =>
			api
				.get("debug/god-mode", { headers: debugHeaders() })
				.json<{ ok: true; godMode: boolean }>(),
		enabled,
		staleTime: Infinity,
	});
}

export function useDebugSetGodMode() {
	return useMutation({
		mutationFn: (value: boolean) =>
			api
				.post("debug/god-mode", { json: { enabled: value }, headers: debugHeaders() })
				.json<{ ok: true; godMode: boolean }>(),
	});
}

export function useDebugHeal() {
	return useMutation({
		mutationFn: () =>
			api
				.post("debug/heal", { headers: debugHeaders() })
				.json<{ ok: true; state: GameState }>(),
	});
}

export function useDebugGiveSkill() {
	return useMutation({
		mutationFn: (skillId: string) =>
			api
				.post("debug/give-skill", { json: { skillId }, headers: debugHeaders() })
				.json<{ ok: true; state: GameState }>(),
	});
}

export function useDebugKillEnemies() {
	return useMutation({
		mutationFn: () =>
			api
				.post("debug/kill-enemies", { headers: debugHeaders() })
				.json<{ ok: true; state: GameState }>(),
	});
}

export function useDebugSetXp() {
	return useMutation({
		mutationFn: (xp: number) =>
			api
				.post("debug/set-xp", { json: { xp }, headers: debugHeaders() })
				.json<{ ok: true; state: GameState }>(),
	});
}
