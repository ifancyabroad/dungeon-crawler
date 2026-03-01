/**
 * Zod schemas for game state and snapshot validation.
 * Used by API to validate persisted snapshot state (including RngState).
 */

import { z } from "zod";

export const RngStateSchema = z.discriminatedUnion("algo", [
	z.object({ algo: z.literal("xorshift32"), s: z.number() }),
	z.object({
		algo: z.literal("sfc32"),
		a: z.number(),
		b: z.number(),
		c: z.number(),
		d: z.number(),
	}),
]);

export const HeroStateSchema = z.object({
	floorIndex: z.number(),
	x: z.number(),
	y: z.number(),
});

export const EntitySchema = z.object({
	id: z.string(),
	kind: z.string(),
	x: z.number(),
	y: z.number(),
	data: z.record(z.string(), z.unknown()).optional(),
});

export const ItemSchema = z.object({
	id: z.string(),
	kind: z.string(),
	x: z.number(),
	y: z.number(),
	data: z.record(z.string(), z.unknown()).optional(),
});

/** tileOverrides: keys are stringified numbers (cell index) when parsed from JSON. */
export const FloorStateSchema = z.object({
	tileOverrides: z.record(z.string(), z.number()),
	entities: z.record(z.string(), EntitySchema),
	items: z.record(z.string(), ItemSchema),
});

/** Persisted dynamic state; validate snapshots with this (includes RngState). */
export const PersistedDynamicStateSchema = z.object({
	turn: z.number(),
	hero: HeroStateSchema,
	floors: z.array(FloorStateSchema),
	rngState: RngStateSchema,
});
