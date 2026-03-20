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
import { playMagicArrow } from "./magicArrow";
import { playShield } from "./shield";
import { playConeOfCold } from "./coneOfCold";
import { playMightyLeap } from "./mightyLeap";
import { playCleave } from "./cleave";
import { playBerserk } from "./berserk";
import { playSneakAttack } from "./sneakAttack";
import { playShadowStep } from "./shadowStep";
import { playPoisonBlade } from "./poisonBlade";
import { idxToXY, getTilesInLine } from "@app/shared";
import { TILE_WIDTH, TILE_HEIGHT } from "../../tiles/tilesetRegistry";
import { useMapStore } from "../../../features/map/mapStore";
import { useGameStore } from "../../../features/game/gameStore";

/** Resolve the world-pixel centre of an actor by id, using current game state. */
function actorWorldPos(actorId: string, mapWidth: number): { px: number; py: number } | undefined {
	const gs = useGameStore.getState().state;
	if (!gs) return undefined;
	const floorState = gs.floors[gs.heroFloorIndex]?.state;
	if (!floorState) return undefined;
	const actor = floorState.actorsById[actorId];
	if (!actor) return undefined;
	const { x, y } = idxToXY(actor.idx, mapWidth);
	return { px: x * TILE_WIDTH + TILE_WIDTH / 2, py: y * TILE_HEIGHT + TILE_HEIGHT / 2 };
}

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

const magicArrowHandler: SkillAnimHandlerFn = (ctx, scene, mapWidth) => {
	if (!ctx.event.targetActorId) return DEFAULT_ANIM_RESULT;
	const pos = actorWorldPos(ctx.event.targetActorId, mapWidth);
	if (!pos) return DEFAULT_ANIM_RESULT;
	playMagicArrow(scene, ctx.heroSprite, pos.px, pos.py, ctx.onImpact);
	return { handled: true, fxDeferred: true };
};

const shieldHandler: SkillAnimHandlerFn = (ctx, scene, _mapWidth) => {
	playShield(scene, ctx.heroSprite, ctx.onImpact);
	return { handled: true, fxDeferred: true };
};

const coneOfColdHandler: SkillAnimHandlerFn = (ctx, scene, mapWidth) => {
	if (ctx.event.targetTileIdx === undefined) return DEFAULT_ANIM_RESULT;
	const { x: hx, y: hy } = idxToXY(ctx.heroIdxAfter, mapWidth);
	const { x: tx, y: ty } = idxToXY(ctx.event.targetTileIdx, mapWidth);
	const dirAngle = Math.atan2(ty - hy, tx - hx);
	playConeOfCold(scene, ctx.heroSprite, dirAngle, ctx.onImpact);
	return { handled: true, fxDeferred: true };
};

const mightyLeapHandler: SkillAnimHandlerFn = (ctx, scene, mapWidth) => {
	if (!ctx.heroMoved) return DEFAULT_ANIM_RESULT;
	const result = playMightyLeap(scene, ctx.heroSprite, ctx.heroIdxAfter, mapWidth, ctx.onImpact);
	return { handled: true, fxDeferred: true, newHeroTilePos: result.newHeroTilePos };
};

const cleaveHandler: SkillAnimHandlerFn = (ctx, scene, _mapWidth) => {
	playCleave(scene, ctx.heroSprite, ctx.onImpact);
	return { handled: true, fxDeferred: true };
};

const berserkHandler: SkillAnimHandlerFn = (ctx, scene, _mapWidth) => {
	playBerserk(scene, ctx.heroSprite, ctx.onImpact);
	return { handled: true, fxDeferred: true };
};

const sneakAttackHandler: SkillAnimHandlerFn = (ctx, scene, mapWidth) => {
	if (!ctx.event.targetActorId) return DEFAULT_ANIM_RESULT;
	const gs = useGameStore.getState().state;
	const floorState = gs?.floors[gs?.heroFloorIndex ?? 0]?.state;
	const targetActor = floorState?.actorsById[ctx.event.targetActorId];
	if (!targetActor) return DEFAULT_ANIM_RESULT;
	playSneakAttack(scene, ctx.heroSprite, targetActor.idx, mapWidth, ctx.onImpact);
	return { handled: true, fxDeferred: true };
};

const shadowStepHandler: SkillAnimHandlerFn = (ctx, scene, mapWidth) => {
	if (!ctx.heroMoved) return DEFAULT_ANIM_RESULT;
	const result = playShadowStep(scene, ctx.heroSprite, ctx.heroIdxAfter, mapWidth, ctx.onImpact);
	return { handled: true, fxDeferred: true, newHeroTilePos: result.newHeroTilePos };
};

const poisonBladeHandler: SkillAnimHandlerFn = (ctx, scene, mapWidth) => {
	if (!ctx.event.targetActorId) return DEFAULT_ANIM_RESULT;
	const gs = useGameStore.getState().state;
	const floorState = gs?.floors[gs?.heroFloorIndex ?? 0]?.state;
	const targetActor = floorState?.actorsById[ctx.event.targetActorId];
	if (!targetActor) return DEFAULT_ANIM_RESULT;
	playPoisonBlade(scene, ctx.heroSprite, targetActor.idx, mapWidth, ctx.onImpact);
	return { handled: true, fxDeferred: true };
};

/** Map skill ID → animation handler. Add entries here to support new skill animations. */
export const SKILL_ANIM_REGISTRY: Record<string, SkillAnimHandlerFn> = {
	fireball: fireballHandler,
	charge: chargeHandler,
	war_cry: warCryHandler,
	lightning_bolt: lightningBoltHandler,
	smoke_bomb: smokeBombHandler,
	magic_arrow: magicArrowHandler,
	shield: shieldHandler,
	cone_of_cold: coneOfColdHandler,
	mighty_leap: mightyLeapHandler,
	cleave: cleaveHandler,
	berserk: berserkHandler,
	sneak_attack: sneakAttackHandler,
	shadow_step: shadowStepHandler,
	poison_blade: poisonBladeHandler,
};

export { DEFAULT_ANIM_RESULT } from "./types";
export type { SkillAnimResult, SkillAnimHandlerFn, SkillAnimContext } from "./types";
