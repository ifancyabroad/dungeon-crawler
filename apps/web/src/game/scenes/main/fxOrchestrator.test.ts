import { describe, expect, it, vi } from "vitest";

vi.mock("phaser", () => ({
	default: {
		Math: {
			Easing: {
				Sine: { Out: "out" },
			},
		},
	},
}));

import { dispatchFxAndSync } from "./fxOrchestrator";

describe("dispatchFxAndSync", () => {
	it("always calls onAfterDispatch even when no floor/events", () => {
		const onAfterDispatch = vi.fn();
		dispatchFxAndSync({
			events: [],
			gs: { heroId: "hero" } as never,
			floor: null,
			heroSprite: {} as never,
			npcSprites: new Map(),
			attackAnimator: null,
			damageNumbers: null,
			deathFx: null,
			skillAnimController: null,
			onAfterDispatch,
		});
		expect(onAfterDispatch).toHaveBeenCalledTimes(1);
	});

	it("excludes claimed events from damage number main pass", () => {
		const skillEvent = { type: "skill_used", actorId: "npc-1" } as never;
		const hitEvent = { type: "damage", actorId: "hero" } as never;
		const events = [skillEvent, hitEvent];
		const handleEvents = vi.fn();
		const dispatchNonHero = vi.fn().mockReturnValue(new Set([skillEvent]));
		const onAfterDispatch = vi.fn();

		dispatchFxAndSync({
			events,
			gs: { heroId: "hero" } as never,
			floor: { actorsById: {} } as never,
			heroSprite: {} as never,
			npcSprites: new Map(),
			attackAnimator: { playEvents: vi.fn() } as never,
			damageNumbers: { handleEvents } as never,
			deathFx: { handleEvents: vi.fn() } as never,
			skillAnimController: { dispatchNonHero } as never,
			onAfterDispatch,
		});

		expect(dispatchNonHero).toHaveBeenCalledTimes(1);
		expect(handleEvents).toHaveBeenCalledTimes(1);
		expect(handleEvents).toHaveBeenCalledWith([hitEvent], expect.any(Function));
		expect(onAfterDispatch).toHaveBeenCalledTimes(1);
	});
});
