/**
 * Zod schema and types for vault definitions (handcrafted map structures).
 */

import { z } from "zod";

export const VaultLegendEntrySchema = z.object({
	tile: z.enum(["wall", "floor"]),
	marker: z.string().optional(),
	groundTileId: z.number().int().nonnegative().optional(),
	wallTileId: z.number().int().nonnegative().optional(),
	decorationTileId: z.number().int().nonnegative().optional(),
	collision: z.boolean().optional(),
});

export const VaultSpawnEntrySchema = z.union([
	z.object({ marker: z.string(), encounterId: z.string() }),
	z.object({ marker: z.string(), chestType: z.enum(["regular", "rare"]) }),
]);

export const VaultDefSchema = z.object({
	id: z.string(),
	width: z.number().int().positive(),
	height: z.number().int().positive(),
	tags: z.array(
		z.enum(["start", "exit", "boss", "treasure", "corridor", "chamber", "alcove", "generic"]),
	),
	layout: z.array(z.string()),
	legend: z.record(z.string(), VaultLegendEntrySchema),
	spawns: z.array(VaultSpawnEntrySchema).optional(),
});

export type VaultDefinition = z.infer<typeof VaultDefSchema>;

export const VaultsArraySchema = z.array(VaultDefSchema);
