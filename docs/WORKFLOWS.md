# Development Workflows

Common step-by-step workflows for this repository. For package responsibilities and constraints see [ARCHITECTURE.md](ARCHITECTURE.md). For content patterns see [PRD.md](PRD.md).

---

## Adding a New NPC

1. Create `packages/content/src/raw/npcs/<name>.json` following the shape defined by `NpcSchema` in `packages/content/src/schemas/npc.ts`. Use an existing file (e.g. `goblin.json`) as a reference. Set `faction` (`"hostile"` or `"player"`) and `role` (`"grunt"`, `"boss"`, `"mercenary"`, or `"vendor"`). Include an `activeSkills` array — use `[]` if the NPC has no active skills, or list skill IDs for NPCs that should use active skills autonomously. Passive skills go in the `passiveSkills` array; they are applied automatically at spawn.
2. Run `pnpm --filter @app/content generate` to regenerate the typed lookup.
3. Add one or more encounter definitions in `packages/content/src/raw/encounters/` that reference the new NPC via `npcId`.
4. Update floor encounter tables in `packages/shared/src/config/map.ts` (`FLOOR_CONFIGS`) to include the new encounter IDs.
5. Verify: `pnpm typecheck && pnpm lint`.

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
2. Define a Zod schema for `ItemDef` following the existing content schema pattern in `packages/content/src/schemas/` (see `npc.ts` or `skill.ts` as examples).
3. Run `pnpm --filter @app/content generate` to regenerate the typed lookup (`itemsById`).
4. Add item stat application logic inside `packages/shared` (e.g. a helper that merges equipped item bonuses into an actor's effective stats at combat resolution time).
5. Add item drop logic to the relevant floor or NPC definition.
6. Wire up inventory management in the shared engine: add an `equip`/`unequip`/`use` action type if needed (see "Adding a New Action" below).
7. Connect to the inventory modal stub in `apps/web/src/components/`.
8. Verify: `pnpm typecheck && pnpm lint && pnpm test`.

---

## Adding a New Skill

Skills are either **active** (hotbar, cooldown, `use_skill`) or **passive** (permanent buff, granted at level-up). Both share the same JSON/content pipeline but differ in their effect schema.

### Active skill

1. Create `packages/content/src/raw/skills/<name>.json`. Use an existing active skill file as a reference.
2. If a new effect type is needed: add its Zod schema to the shared skill schemas (in `packages/shared`), implement a handler under `packages/shared/src/skills/effects/`, and register it in `resolveSkill.ts`. TypeScript types are derived from the schema — no manual interface mirroring is needed. If the skill applies a status that only modifies numeric values (e.g. bonus damage, incoming damage adjustment), define those adjustments inline in the skill JSON — no engine code changes are needed. If the status requires engine-wired behaviour (e.g. damage-over-time, on-expiry side effects), add its ID to `packages/shared/src/config/skills.ts` (`STATUS_HOOKS`) and implement the hook in `activeEffects.ts`.
3. Run `pnpm --filter @app/content generate`.
4. Add the skill id to the relevant consumer:
    - **Hero class skill**: add to the class definition in `packages/content/src/raw/classes/<class>.json`.
    - **NPC skill**: add the skill id to the `activeSkills` array in the NPC's JSON definition in `packages/content/src/raw/npcs/<npc>.json`. The engine initialises cooldown state at spawn and ticks the cooldown each turn automatically.
5. If the skill has a one-shot visual effect, add a handler in `apps/web/src/game/fx/skills/` and register it in the skill animation registry. Handlers receive a `SkillAnimContext` that is actor-agnostic — the same handler works for hero and NPC casters.
6. If the skill applies a buff with a persistent visual (aura, sprite tint), add it to the buff visual registry in `apps/web/src/game/fx/buffVisuals/`. No scene code needs to change.
7. If the skill requires targeting, the hotbar and targeting overlay handle it automatically for standard effect types — no extra client work is needed.

### Passive skill

1. Create `packages/content/src/raw/skills/<name>.json`. Use an existing passive skill file as a reference.
2. If a new passive effect type is needed, add its Zod schema to the shared skill schemas and add a case in `packages/shared/src/skills/applyPassiveEffect.ts`. If the effect is read at combat resolution time (e.g. extra damage dice), add the corresponding field to `Actor` and read it in the relevant combat handler.
3. Run `pnpm --filter @app/content generate`.
4. Add the skill id to the class's `passiveSkillPool` in `packages/content/src/raw/classes/<class>.json`.

### Both types

Verify: `pnpm typecheck && pnpm lint && pnpm test`.

---

## Adding a New Action

1. Define the Zod schema and TypeScript type in `packages/shared/src/game/actions.ts`. Add it to the `ActionSchema` discriminated union.
2. Add a handler case in `applyAction` inside `packages/shared/src/game/engine.ts`. Return `{ ok: true, state, events }` or `{ ok: false, reason }`.
3. Ensure the action is deterministic: no `Math.random` or `Date.now`; use the injected RNG from `ApplyActionContext`.
4. The API socket handler validates all actions generically via `ActionSchema`; no handler changes are needed for the new action type.
5. Wire up the client input in `apps/web` (keyboard binding or UI button) and dispatch via `gameStore`.
6. Verify: `pnpm typecheck && pnpm lint && pnpm test`.

---

## Adding a New AI Strategy

NPC AI has two independent phases — **combat** (what to do when enemies are visible) and **idle** (what to do otherwise). Each phase has its own strategy tag type and registry in `packages/shared/src/game/strategies/`. Decide which phase your strategy belongs to before starting.

### New combat strategy

1. Add the new tag to `CombatStrategyTag` in `packages/shared/src/game/strategies/types.ts`.
2. Create `packages/shared/src/game/strategies/<name>.ts`. Export a function matching the `CombatStrategyFn` signature. When the NPC has nothing to fight, return `{ kind: "idle" }` so the idle layer takes over. Access `ctx.getSkillDef` if the strategy needs to inspect skill range or target type.
3. Register the function in the combat strategy registry in `packages/shared/src/game/strategies/index.ts`. TypeScript will error if any tag is missing, keeping the registry exhaustive.
4. If a status effect should trigger this strategy, add the status ID to `packages/shared/src/config/skills.ts` (`STATUS_HOOKS`) and wire a per-turn override in `processEnemyTurns` following the existing `FRIGHTENED` pattern.
5. Add the new tag to the `NpcAIStateSchema` in `packages/shared/src/game/schemas.ts`.
6. Verify: `pnpm typecheck && pnpm lint`.

### New idle strategy

1. Add the new tag to `IdleStrategyTag` in `packages/shared/src/game/strategies/types.ts`.
2. Create `packages/shared/src/game/strategies/<name>.ts`. Export a function matching the `IdleStrategyFn` signature.
3. Register it in the idle strategy registry in `packages/shared/src/game/strategies/index.ts`.
4. Add the new tag to both the `NpcAIStateSchema` (`packages/shared`) and the NPC content schema (`packages/content`) so content files can reference it.
5. Verify: `pnpm typecheck && pnpm lint`.

---

## Adding a New UI Feature

1. Check `apps/web/src/components/` for existing components before creating new ones. All UI must use the shared Tailwind token system — see `.cursor/rules/design-system.mdc`.
2. If the feature needs server-derived data, add a TanStack Query hook in the relevant `features/<name>/` directory.
3. If the feature needs local UI state beyond what TanStack Query provides, add it to a Zustand store under `features/<name>/`.
4. Non-world UI: React + Tailwind only. In-world rendering (dungeon, sprites, animations): Phaser only.
5. If the feature exposes a new modal, follow the existing pattern (`Modal` wrapper component, toggled via store state).
6. Verify: `pnpm typecheck && pnpm lint`.
