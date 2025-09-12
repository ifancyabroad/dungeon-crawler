import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";

export type Score = { player: string; points: number; _id?: string };

export function useScores() {
	return useQuery({
		queryKey: ["scores"],
		queryFn: ({ signal }) => api.get<Score[]>("scores", { signal }),
	});
}

export function useCreateScore() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (body: { player: string; points: number }) =>
			api.post<Score>("scores", { json: body }).json<Score>(),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["scores"] });
		},
	});
}
