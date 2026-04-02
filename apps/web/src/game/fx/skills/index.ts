/**
 * Skill animation registry.
 * To add a new skill animation: implement a SkillAnimHandlerFn and add it here.
 */

import type { SkillAnimHandlerFn } from "./types";
import { DEFAULT_ANIM_RESULT } from "./types";
import { playFireball } from "./fireball";
import { playCharge } from "./charge";
import { playSecondWind } from "./secondWind";
import { playRecklessAttack } from "./recklessAttack";
import { playStealth } from "./stealth";
import { playLightningBolt } from "./lightningBolt";
import { playSmokeBomb } from "./smokeBomb";
import { playMagicArrow } from "./magicArrow";
import { playShield } from "./shield";
import { playConeOfCold } from "./coneOfCold";
import { playMightyLeap } from "./mightyLeap";
import { playCleave } from "./cleave";

import { playSneakAttack } from "./sneakAttack";
import { playShadowStep } from "./shadowStep";
import { playPoisonBlade } from "./poisonBlade";
import { playPoisonBite } from "./poisonBite";
import { idxToXY, getTilesInLine } from "@app/shared";
import { TILE_WIDTH, TILE_HEIGHT } from "../../tiles/tilesetRegistry";
import { useMapStore } from "../../../features/map/mapStore";

const fireballHandler: SkillAnimHandlerFn = (ctx, scene, mapWidth) => {
	if (ctx.event.targetTileIdx === undefined) return DEFAULT_ANIM_RESULT;
	playFireball(scene, ctx.casterSprite, ctx.event.targetTileIdx, mapWidth, ctx.onImpact);
	return { handled: true, fxDeferred: true };
};

const chargeHandler: SkillAnimHandlerFn = (ctx, _scene, mapWidth) => {
	if (!ctx.casterMoved) return DEFAULT_ANIM_RESULT;
	const { x, y } = idxToXY(ctx.casterIdxAfter, mapWidth);
	playCharge(
		_scene,
		ctx.casterSprite,
		x * TILE_WIDTH + TILE_WIDTH / 2,
		y * TILE_HEIGHT + TILE_HEIGHT / 2,
		ctx.onImpact,
	);
	return { handled: true, fxDeferred: true, newHeroTilePos: { x, y } };
};

const secondWindHandler: SkillAnimHandlerFn = (ctx, scene, _mapWidth) => {
	playSecondWind(scene, ctx.casterSprite, ctx.onImpact);
	return { handled: true, fxDeferred: false };
};

const recklessAttackHandler: SkillAnimHandlerFn = (ctx, scene, _mapWidth) => {
	if (!ctx.targetWorldPos) return DEFAULT_ANIM_RESULT;
	playRecklessAttack(
		scene,
		ctx.casterSprite,
		ctx.targetWorldPos.px,
		ctx.targetWorldPos.py,
		ctx.onImpact,
	);
	return { handled: true, fxDeferred: true };
};

const stealthHandler: SkillAnimHandlerFn = (ctx, scene, _mapWidth) => {
	playStealth(scene, ctx.casterSprite);
	return { handled: true, fxDeferred: false };
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
			ctx.casterIdxAfter,
			ctx.event.targetTileIdx,
			mapWidth,
			mapHeight,
			opacityMask,
		);
		if (line.length > 0) visualTargetIdx = line[line.length - 1];
	}

	playLightningBolt(scene, ctx.casterSprite, visualTargetIdx, mapWidth, ctx.onImpact);
	return { handled: true, fxDeferred: true };
};

const smokeBombHandler: SkillAnimHandlerFn = (ctx, scene, _mapWidth) => {
	playSmokeBomb(scene, ctx.casterSprite, ctx.onImpact);
	return { handled: true, fxDeferred: true };
};

const magicArrowHandler: SkillAnimHandlerFn = (ctx, scene, _mapWidth) => {
	if (!ctx.targetWorldPos) return DEFAULT_ANIM_RESULT;
	playMagicArrow(
		scene,
		ctx.casterSprite,
		ctx.targetWorldPos.px,
		ctx.targetWorldPos.py,
		ctx.onImpact,
	);
	return { handled: true, fxDeferred: true };
};

const shieldHandler: SkillAnimHandlerFn = (ctx, scene, _mapWidth) => {
	playShield(scene, ctx.casterSprite, ctx.onImpact);
	return { handled: true, fxDeferred: true };
};

const coneOfColdHandler: SkillAnimHandlerFn = (ctx, scene, mapWidth) => {
	if (ctx.event.targetTileIdx === undefined) return DEFAULT_ANIM_RESULT;
	const { x: cx, y: cy } = idxToXY(ctx.casterIdxAfter, mapWidth);
	const { x: tx, y: ty } = idxToXY(ctx.event.targetTileIdx, mapWidth);
	const dirAngle = Math.atan2(ty - cy, tx - cx);
	playConeOfCold(scene, ctx.casterSprite, dirAngle, ctx.onImpact);
	return { handled: true, fxDeferred: true };
};

const mightyLeapHandler: SkillAnimHandlerFn = (ctx, scene, mapWidth) => {
	if (!ctx.casterMoved) return DEFAULT_ANIM_RESULT;
	const result = playMightyLeap(
		scene,
		ctx.casterSprite,
		ctx.casterIdxAfter,
		mapWidth,
		ctx.onImpact,
	);
	return { handled: true, fxDeferred: true, newHeroTilePos: result.newHeroTilePos };
};

const cleaveHandler: SkillAnimHandlerFn = (ctx, scene, _mapWidth) => {
	playCleave(scene, ctx.casterSprite, ctx.onImpact);
	return { handled: true, fxDeferred: true };
};

const sneakAttackHandler: SkillAnimHandlerFn = (ctx, scene, mapWidth) => {
	if (ctx.event.targetActorIdx === undefined) return DEFAULT_ANIM_RESULT;
	playSneakAttack(scene, ctx.casterSprite, ctx.event.targetActorIdx, mapWidth, ctx.onImpact);
	return { handled: true, fxDeferred: true };
};

const shadowStepHandler: SkillAnimHandlerFn = (ctx, scene, mapWidth) => {
	if (!ctx.casterMoved) return DEFAULT_ANIM_RESULT;
	const result = playShadowStep(
		scene,
		ctx.casterSprite,
		ctx.casterIdxAfter,
		mapWidth,
		ctx.onImpact,
	);
	return { handled: true, fxDeferred: true, newHeroTilePos: result.newHeroTilePos };
};

const poisonBladeHandler: SkillAnimHandlerFn = (ctx, scene, mapWidth) => {
	if (ctx.event.targetActorIdx === undefined) return DEFAULT_ANIM_RESULT;
	playPoisonBlade(scene, ctx.casterSprite, ctx.event.targetActorIdx, mapWidth, ctx.onImpact);
	return { handled: true, fxDeferred: true };
};

const poisonBiteHandler: SkillAnimHandlerFn = (ctx, scene, _mapWidth) => {
	if (!ctx.targetWorldPos) return DEFAULT_ANIM_RESULT;
	playPoisonBite(scene, ctx.targetWorldPos.px, ctx.targetWorldPos.py, ctx.onImpact);
	// Contact — onImpact is called immediately inside playPoisonBite; no deferral needed.
	return { handled: true, fxDeferred: false };
};

/** Map skill ID → animation handler. Add entries here to support new skill animations. */
export const SKILL_ANIM_REGISTRY: Record<string, SkillAnimHandlerFn> = {
	fireball: fireballHandler,
	charge: chargeHandler,
	lightning_bolt: lightningBoltHandler,
	smoke_bomb: smokeBombHandler,
	magic_arrow: magicArrowHandler,
	shield: shieldHandler,
	cone_of_cold: coneOfColdHandler,
	mighty_leap: mightyLeapHandler,
	cleave: cleaveHandler,
	sneak_attack: sneakAttackHandler,
	shadow_step: shadowStepHandler,
	poison_blade: poisonBladeHandler,
	poison_bite: poisonBiteHandler,
	second_wind: secondWindHandler,
	reckless_attack: recklessAttackHandler,
	stealth: stealthHandler,
};

export { DEFAULT_ANIM_RESULT } from "./types";
export type { SkillAnimResult, SkillAnimHandlerFn, SkillAnimContext } from "./types";
