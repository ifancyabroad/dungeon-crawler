# Development Workflows

Common step-by-step workflows for this repository. For package responsibilities and constraints see [ARCHITECTURE.md](ARCHITECTURE.md). For content patterns see [PRD.md](PRD.md).

---

## Adding a New Monster

1. Create `packages/content/src/raw/monsters/<name>.json` following the shape of `goblin.json` (name, hp, ac, xpReward, aiStrategy, hitDie, attributes, and optional `damageResistances`/`damageImmunities`).
2. Add a Zod schema for the new monster if its shape differs from the existing `MonsterDef` schema; otherwise the existing schema covers it.
3. Run `pnpm --filter @app/content generate` to regenerate the typed lookup.
4. Add one or more encounter definitions in `packages/content/src/raw/encounters/` that reference the new monster.
5. Update floor encounter tables in `packages/shared/src/map/floorConfigs.ts` to include the new encounter IDs.
6. Verify: `pnpm typecheck && pnpm lint`.

---

## Adding a New Vault

1. Create/update `packages/content/src/raw/vaults/<vault>.json`.
2. Ensure `width`, `height`, `layout[]`, and `legend{}` are consistent:
    - `layout.length === height`
    - every layout row string length is exactly `width`
    - every character used in `layout` exists in `legend`
3. Treat entrances as part of the content contract:
    - vault perimeter wall tiles can seal the vault once stamped
    - include at least one perimeter walkable cell/doorway so the stamped vault remains reachable from the surrounding room
4. Regenerate typed lookups with `pnpm --filter @app/content generate`.
5. Verify: `pnpm typecheck && pnpm lint && pnpm test`.

---

## Adding a New Item

> Items are not yet implemented. This workflow describes the intended pattern based on existing content conventions.

1. Create `packages/content/src/raw/items/<name>.json` with the item definition (name, type, slot, stat modifiers).
2. Define or extend a Zod schema for `ItemDef` in `packages/content/src/build/buildContent.ts`.
3. Run `pnpm --filter @app/content generate` to regenerate the typed lookup (`itemsById`).
4. Add item stat application logic inside `packages/shared` (e.g. a helper that merges equipped item bonuses into an actor's effective stats at combat resolution time).
5. Add item drop logic to the relevant floor or monster definition.
6. Wire up inventory management in the shared engine: add an `equip`/`unequip`/`use` action type if needed (see "Adding a New Action" below).
7. Connect to the inventory modal stub in `apps/web/src/components/`.
8. Verify: `pnpm typecheck && pnpm lint && pnpm test`.

---

## Adding a New Skill

Skills are either **active** (hotbar, cooldown, `use_skill`) or **passive** (permanent buff, granted at level-up). Both share the same JSON/content pipeline but differ in their effect schema.

### Active skill

1. Create `packages/content/src/raw/skills/<name>.json` with `skillType: "active"`, `id`, `name`, `description`, `cooldown`, `targetType`, and an `effects` array of `ActiveSkillEffectDescriptor` objects. Follow existing files (`fireball.json`, `charge.json`).
2. If a new effect type is needed, add a variant to `ActiveSkillEffectDescriptorSchema` in `packages/content/src/schemas/skill.ts`, mirror it in `packages/shared/src/skills/types.ts`, implement a handler under `packages/shared/src/skills/effects/`, and register it in `resolveSkill.ts`.
3. Run `pnpm --filter @app/content generate`.
4. Add the skill id to the class's `activeSkillPool` (or `startingSkills`) in `packages/content/src/raw/classes/<class>.json`.
5. If the skill has a visual effect, add a handler in `apps/web/src/game/fx/skills/<name>.ts` and register it in `SKILL_ANIM_REGISTRY` in `apps/web/src/game/fx/skills/index.ts`.
6. If the skill requires targeting (tile or actor), the hotbar dispatches `enterTargeting(...)` — `TargetingSystem` handles the overlay automatically.

### Passive skill

1. Create `packages/content/src/raw/skills/<name>.json` with `skillType: "passive"`, `id`, `name`, `description`, and an `effects` array of `PassiveSkillEffectDescriptor` objects. Follow existing passive skill files.
2. If a new passive effect type is needed, add a variant to `PassiveSkillEffectDescriptorSchema` in `packages/content/src/schemas/skill.ts`, mirror it in `packages/shared/src/skills/types.ts`, and add a case in `packages/shared/src/skills/applyPassiveEffect.ts`. If the effect needs to be read at combat resolution time (e.g. extra damage dice), add the corresponding field to `Actor` and read it in the relevant combat handler.
3. Run `pnpm --filter @app/content generate`.
4. Add the skill id to the class's `passiveSkillPool` in `packages/content/src/raw/classes/<class>.json`.

### Both types

Verify: `pnpm typecheck && pnpm lint && pnpm test`.

---

## Adding a New Action

1. Define the Zod schema and TypeScript type in `packages/shared/src/game/actions.ts`. Add it to the `ActionSchema` discriminated union.
2. Add a handler case in `applyAction` inside `packages/shared/src/game/engine.ts`. Return `{ ok: true, state, events }` or `{ ok: false, reason }`.
3. Ensure the action is deterministic: no `Math.random` or `Date.now`; use the injected RNG from `ApplyActionContext`.
4. The socket handler in `apps/api/src/socket/game.handlers.ts` requires no changes — it validates all actions via `ActionSchema` generically.
5. Wire up the client input in `apps/web` (keyboard binding or UI button) and dispatch via `gameStore`.
6. Verify: `pnpm typecheck && pnpm lint && pnpm test`.

---

## Adding a New UI Feature

1. Check `apps/web/src/components/` for existing components before creating new ones. All UI must use the shared Tailwind token system — see `.cursor/rules/design-system.mdc`.
2. If the feature needs server-derived data, add a TanStack Query hook in the relevant `features/<name>/` directory.
3. If the feature needs local UI state beyond what TanStack Query provides, add it to a Zustand store under `features/<name>/`.
4. Non-world UI: React + Tailwind only. In-world rendering (dungeon, sprites, animations): Phaser only.
5. If the feature exposes a new modal, follow the existing pattern (`Modal` wrapper component, toggled via store state).
6. Verify: `pnpm typecheck && pnpm lint`.
