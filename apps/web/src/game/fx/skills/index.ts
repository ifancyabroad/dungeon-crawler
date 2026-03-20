/**
 * Skill animation registry.
 * To add a new skill animation: implement a SkillAnimHandlerFn and add it here.
 */

import type { SkillAnimHandlerFn } from "./types";
import { DEFAULT_ANIM_RESULT } from "./types";
import { playFireball } from "./fireball";
import { playCharge } from "./charge";
import { playWarCry } from "./warCry";
import { playLightningBolt } from "./lightningBolt";
import { playSmokeBomb } from "./smokeBomb";
import { idxToXY, getTilesInLine } from "@app/shared";
import { TILE_WIDTH, TILE_HEIGHT } from "../../tiles/tilesetRegistry";
import { useMapStore } from "../../../features/map/mapStore";

const fireballHandler: SkillAnimHandlerFn = (ctx, scene, mapWidth) => {
	if (ctx.event.targetTileIdx === undefined) return DEFAULT_ANIM_RESULT;
	playFireball(scene, ctx.heroSprite, ctx.event.targetTileIdx, mapWidth, ctx.onImpact);
	return { handled: true, fxDeferred: true };
};

const chargeHandler: SkillAnimHandlerFn = (ctx, _scene, mapWidth) => {
	if (!ctx.heroMoved) return DEFAULT_ANIM_RESULT;
	const { x, y } = idxToXY(ctx.heroIdxAfter, mapWidth);
	playCharge(
		_scene,
		ctx.heroSprite,
		x * TILE_WIDTH + TILE_WIDTH / 2,
		y * TILE_HEIGHT + TILE_HEIGHT / 2,
		ctx.onImpact,
	);
	return { handled: true, fxDeferred: true, newHeroTilePos: { x, y } };
};

/** Emanates from hero position; calls onImpact immediately so damage numbers show with the burst. */
const warCryHandler: SkillAnimHandlerFn = (ctx, scene, _mapWidth) => {
	playWarCry(scene, ctx.heroSprite, ctx.onImpact);
	return { handled: true, fxDeferred: true };
};

const lightningBoltHandler: SkillAnimHandlerFn = (ctx, scene, mapWidth) => {
	if (ctx.event.targetTileIdx === undefined) return DEFAULT_ANIM_RESULT;

	// The beam stops before the first wall — compute the actual tile the bolt
	// should visually terminate at so the animation matches the server result.
	const { opacityMask, mapConfigOverride } = useMapStore.getState();
	const mapHeight = mapConfigOverride?.height;
	let visualTargetIdx = ctx.event.targetTileIdx;
	if (opacityMask && mapHeight !== undefined) {
		const line = getTilesInLine(
			ctx.heroIdxAfter,
			ctx.event.targetTileIdx,
			mapWidth,
			mapHeight,
			opacityMask,
		);
		if (line.length > 0) visualTargetIdx = line[line.length - 1];
	}

	playLightningBolt(scene, ctx.heroSprite, visualTargetIdx, mapWidth, ctx.onImpact);
	return { handled: true, fxDeferred: true };
};

const smokeBombHandler: SkillAnimHandlerFn = (ctx, scene, _mapWidth) => {
	playSmokeBomb(scene, ctx.heroSprite, ctx.onImpact);
	return { handled: true, fxDeferred: true };
};

/** Map skill ID → animation handler. Add entries here to support new skill animations. */
export const SKILL_ANIM_REGISTRY: Record<string, SkillAnimHandlerFn> = {
	fireball: fireballHandler,
	charge: chargeHandler,
	war_cry: warCryHandler,
	lightning_bolt: lightningBoltHandler,
	smoke_bomb: smokeBombHandler,
};

export { DEFAULT_ANIM_RESULT } from "./types";
export type { SkillAnimResult, SkillAnimHandlerFn, SkillAnimContext } from "./types";
