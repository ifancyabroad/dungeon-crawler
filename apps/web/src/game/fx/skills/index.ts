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
import { playWhirlwindStrike } from "./whirlwindStrike";
import { playShieldBash } from "./shieldBash";
import { playBattleCry } from "./battleCry";
import { playBerserkerRage } from "./berserkerRage";
import { playFrostNova } from "./frostNova";
import { playMindSpike } from "./mindSpike";
import { playArcaneSurge } from "./arcaneSurge";
import { playSoulDrain } from "./soulDrain";
import { playGarrote } from "./garrote";
import { playHemorrhage } from "./hemorrhage";
import { playMarkedForDeath } from "./markedForDeath";
import { playCaltrops } from "./caltrops";
import { playGustSlam } from "./gustSlam";
import { playGore } from "./gore";
import { playEntangle } from "./entangle";
import { playDeathBolt } from "./deathBolt";
import { playDeathMark } from "./deathMark";
import { playHellfireBolt } from "./hellfireBolt";
import { playPetrifyRay } from "./petrifyRay";
import { playFireCone } from "./fireCone";
import { playFireBreath } from "./fireBreath";
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

const whirlwindStrikeHandler: SkillAnimHandlerFn = (ctx, scene, _mapWidth) => {
	playWhirlwindStrike(scene, ctx.casterSprite, ctx.onImpact);
	return { handled: true, fxDeferred: false };
};

const shieldBashHandler: SkillAnimHandlerFn = (ctx, scene, mapWidth) => {
	if (ctx.event.targetActorIdx === undefined) return DEFAULT_ANIM_RESULT;
	playShieldBash(scene, ctx.casterSprite, ctx.event.targetActorIdx, mapWidth, ctx.onImpact);
	return { handled: true, fxDeferred: true };
};

const battleCryHandler: SkillAnimHandlerFn = (ctx, scene, _mapWidth) => {
	playBattleCry(scene, ctx.casterSprite, ctx.onImpact);
	return { handled: true, fxDeferred: false };
};

const berserkerRageHandler: SkillAnimHandlerFn = (ctx, scene, _mapWidth) => {
	playBerserkerRage(scene, ctx.casterSprite, ctx.onImpact);
	return { handled: true, fxDeferred: false };
};

const frostNovaHandler: SkillAnimHandlerFn = (ctx, scene, _mapWidth) => {
	playFrostNova(scene, ctx.casterSprite, ctx.onImpact);
	return { handled: true, fxDeferred: false };
};

const mindSpikeHandler: SkillAnimHandlerFn = (ctx, scene, _mapWidth) => {
	if (!ctx.targetWorldPos) return DEFAULT_ANIM_RESULT;
	playMindSpike(
		scene,
		ctx.casterSprite,
		ctx.targetWorldPos.px,
		ctx.targetWorldPos.py,
		ctx.onImpact,
	);
	return { handled: true, fxDeferred: true };
};

const arcaneSurgeHandler: SkillAnimHandlerFn = (ctx, scene, _mapWidth) => {
	playArcaneSurge(scene, ctx.casterSprite, ctx.onImpact);
	return { handled: true, fxDeferred: false };
};

const soulDrainHandler: SkillAnimHandlerFn = (ctx, scene, _mapWidth) => {
	if (!ctx.targetWorldPos) return DEFAULT_ANIM_RESULT;
	playSoulDrain(
		scene,
		ctx.casterSprite,
		ctx.targetWorldPos.px,
		ctx.targetWorldPos.py,
		ctx.onImpact,
	);
	return { handled: true, fxDeferred: false };
};

const garroteHandler: SkillAnimHandlerFn = (ctx, scene, mapWidth) => {
	if (ctx.event.targetActorIdx === undefined) return DEFAULT_ANIM_RESULT;
	playGarrote(scene, ctx.casterSprite, ctx.event.targetActorIdx, mapWidth, ctx.onImpact);
	return { handled: true, fxDeferred: true };
};

const hemorrhageHandler: SkillAnimHandlerFn = (ctx, scene, mapWidth) => {
	if (ctx.event.targetActorIdx === undefined) return DEFAULT_ANIM_RESULT;
	playHemorrhage(scene, ctx.casterSprite, ctx.event.targetActorIdx, mapWidth, ctx.onImpact);
	return { handled: true, fxDeferred: true };
};

const markedForDeathHandler: SkillAnimHandlerFn = (ctx, scene, _mapWidth) => {
	if (!ctx.targetWorldPos) return DEFAULT_ANIM_RESULT;
	playMarkedForDeath(scene, ctx.targetWorldPos.px, ctx.targetWorldPos.py, ctx.onImpact);
	return { handled: true, fxDeferred: false };
};

const caltropsHandler: SkillAnimHandlerFn = (ctx, scene, _mapWidth) => {
	playCaltrops(scene, ctx.casterSprite, ctx.onImpact);
	return { handled: true, fxDeferred: false };
};

const gustSlamHandler: SkillAnimHandlerFn = (ctx, scene, _mapWidth) => {
	playGustSlam(scene, ctx.casterSprite, ctx.onImpact);
	return { handled: true, fxDeferred: false };
};

const goreHandler: SkillAnimHandlerFn = (ctx, scene, _mapWidth) => {
	if (!ctx.targetWorldPos) return DEFAULT_ANIM_RESULT;
	playGore(scene, ctx.casterSprite, ctx.targetWorldPos.px, ctx.targetWorldPos.py, ctx.onImpact);
	return { handled: true, fxDeferred: true };
};

const entangleHandler: SkillAnimHandlerFn = (ctx, scene, _mapWidth) => {
	playEntangle(scene, ctx.casterSprite, ctx.onImpact);
	return { handled: true, fxDeferred: false };
};

const deathBoltHandler: SkillAnimHandlerFn = (ctx, scene, _mapWidth) => {
	if (!ctx.targetWorldPos) return DEFAULT_ANIM_RESULT;
	playDeathBolt(
		scene,
		ctx.casterSprite,
		ctx.targetWorldPos.px,
		ctx.targetWorldPos.py,
		ctx.onImpact,
	);
	return { handled: true, fxDeferred: true };
};

const deathMarkHandler: SkillAnimHandlerFn = (ctx, scene, _mapWidth) => {
	if (!ctx.targetWorldPos) return DEFAULT_ANIM_RESULT;
	playDeathMark(scene, ctx.targetWorldPos.px, ctx.targetWorldPos.py, ctx.onImpact);
	return { handled: true, fxDeferred: false };
};

const hellfireBoltHandler: SkillAnimHandlerFn = (ctx, scene, _mapWidth) => {
	if (!ctx.targetWorldPos) return DEFAULT_ANIM_RESULT;
	playHellfireBolt(
		scene,
		ctx.casterSprite,
		ctx.targetWorldPos.px,
		ctx.targetWorldPos.py,
		ctx.onImpact,
	);
	return { handled: true, fxDeferred: true };
};

const petrifyRayHandler: SkillAnimHandlerFn = (ctx, scene, _mapWidth) => {
	if (!ctx.targetWorldPos) return DEFAULT_ANIM_RESULT;
	playPetrifyRay(
		scene,
		ctx.casterSprite,
		ctx.targetWorldPos.px,
		ctx.targetWorldPos.py,
		ctx.onImpact,
	);
	return { handled: true, fxDeferred: true };
};

const fireConeHandler: SkillAnimHandlerFn = (ctx, scene, mapWidth) => {
	if (ctx.event.targetTileIdx === undefined) return DEFAULT_ANIM_RESULT;
	const { x: cx, y: cy } = idxToXY(ctx.casterIdxAfter, mapWidth);
	const { x: tx, y: ty } = idxToXY(ctx.event.targetTileIdx, mapWidth);
	const dirAngle = Math.atan2(ty - cy, tx - cx);
	playFireCone(scene, ctx.casterSprite, dirAngle, ctx.onImpact);
	return { handled: true, fxDeferred: true };
};

const fireBreathHandler: SkillAnimHandlerFn = (ctx, scene, mapWidth) => {
	if (ctx.event.targetTileIdx === undefined) return DEFAULT_ANIM_RESULT;
	const { x: cx, y: cy } = idxToXY(ctx.casterIdxAfter, mapWidth);
	const { x: tx, y: ty } = idxToXY(ctx.event.targetTileIdx, mapWidth);
	const dirAngle = Math.atan2(ty - cy, tx - cx);
	playFireBreath(scene, ctx.casterSprite, dirAngle, ctx.onImpact);
	return { handled: true, fxDeferred: true };
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
	whirlwind_strike: whirlwindStrikeHandler,
	shield_bash: shieldBashHandler,
	battle_cry: battleCryHandler,
	berserker_rage: berserkerRageHandler,
	frost_nova: frostNovaHandler,
	mind_spike: mindSpikeHandler,
	arcane_surge: arcaneSurgeHandler,
	soul_drain: soulDrainHandler,
	garrote: garroteHandler,
	hemorrhage: hemorrhageHandler,
	marked_for_death: markedForDeathHandler,
	caltrops: caltropsHandler,
	gust_slam: gustSlamHandler,
	gore: goreHandler,
	entangle: entangleHandler,
	death_bolt: deathBoltHandler,
	death_mark: deathMarkHandler,
	hellfire_bolt: hellfireBoltHandler,
	petrify_ray: petrifyRayHandler,
	fire_cone: fireConeHandler,
	fire_breath: fireBreathHandler,
};

export { DEFAULT_ANIM_RESULT } from "./types";
export type { SkillAnimResult, SkillAnimHandlerFn, SkillAnimContext } from "./types";
