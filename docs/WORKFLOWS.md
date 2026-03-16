# Development Workflows

Common step-by-step workflows for this repository. For package responsibilities and constraints see [ARCHITECTURE.md](ARCHITECTURE.md). For content patterns see [PRD.md](PRD.md).

---

## Adding a New Monster

1. Create `packages/content/src/raw/monsters/<name>.json` following the shape of `goblin.json` (name, hp, ac, xpReward, aiStrategy, hitDie, attributes).
2. Add a Zod schema for the new monster if its shape differs from the existing `MonsterDef` schema; otherwise the existing schema covers it.
3. Run `pnpm --filter @app/content generate` to regenerate the typed lookup.
4. Add one or more encounter definitions in `packages/content/src/raw/encounters/` that reference the new monster.
5. Update floor encounter tables in `packages/shared/src/map/floorConfigs.ts` to include the new encounter IDs.
6. Verify: `pnpm typecheck && pnpm lint`.

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
