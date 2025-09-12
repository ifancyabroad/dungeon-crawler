import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../../lib/api";

export type Score = { player: string; points: number; _id?: string };

export function useScores() {
	return useQuery({
		queryKey: ["scores"],
		queryFn: ({ signal }) => apiFetch<Score[]>("/scores", { signal }),
	});
}

export function useCreateScore() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (body: { player: string; points: number }) =>
			apiFetch<Score>("/scores", {
				method: "POST",
				body: JSON.stringify(body),
			}),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["scores"] });
		},
	});
}
