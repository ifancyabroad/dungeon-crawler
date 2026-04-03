# Architecture

## Overview

Dungeon Crawler is a **server-authoritative, turn-based roguelike**. The server owns the canonical game state; the client sends player intent and renders the result. A deterministic shared engine in `packages/shared` runs on both sides, enabling optimistic updates on the client while guaranteeing correctness on the server.

---

## Monorepo Structure

```
apps/
  api/          Express API + Socket.IO + MongoDB persistence
  web/          React + Phaser client
packages/
  shared/       Deterministic game engine + Zod schemas (imported as @app/shared)
  content/      Validated JSON content (classes, npcs, encounters, vaults) + generated typed lookups
```

### Dependency Rules

| Package        | May import from                                             |
| -------------- | ----------------------------------------------------------- |
| `@app/shared`  | Nothing (no React, Phaser, Express, Mongoose, or Node APIs) |
| `@app/content` | `@app/shared`                                               |
| `apps/api`     | `@app/shared`, `@app/content`                               |
| `apps/web`     | `@app/shared`, `@app/content`                               |

---

## System Boundaries

Each package has a strict, non-overlapping responsibility. Put code in the package that owns it.

### `packages/shared`

The deterministic game engine. **All authoritative game rules live here** — movement, combat, map generation, NPC AI, levelling, and state transitions. Neither `apps/api` nor `apps/web` may re-implement game logic that belongs in this layer.

- Pure functions only: no I/O, no network, no database, no React, no Phaser.
- Exports `applyAction(state, action, context)` as the single entry point for turn resolution.
- Exports all `Action` Zod schemas and the full `GameState` type tree.

### `packages/content`

Static game data as validated JSON. Defines what exists in the game world (classes, npcs, encounters, vaults, skills, items, affixes) but contains no logic.

- Each content type lives under `src/raw/<type>/` as a JSON file validated by a Zod schema.
- A build script generates typed lookup objects (`npcsById`, `encountersById`, `skillsById`, `itemsById`, `affixesById`, etc.) consumed by `apps/api` and `apps/web`.
- Never hardcode content values in logic files — always source from `@app/content`.

### `apps/api`

Infrastructure and wiring layer. It does not contain game logic.

- Validates all client input with Zod (schemas from `@app/shared`).
- Calls `applyAction` from `@app/shared` to advance state.
- Owns persistence (MongoDB), the in-memory session cache, socket auth, and the action/snapshot write pipeline.
- Applies side effects that require infrastructure context (e.g. spawning NPCs on floor descent).

### `apps/web`

Presentation and input layer. It does not own game state.

- React + Tailwind: all menus, HUD, and non-world UI.
- Phaser: rendering only — tile layers, sprites, fog-of-war, animations. No game logic.
- Zustand `gameStore`: bridges socket state to React and Phaser. Manages the optimistic action queue.
- May call `applyAction` from `@app/shared` for optimistic updates, but the server result always wins.

---

## Tech Stack

| Concern                      | Technology                                 |
| ---------------------------- | ------------------------------------------ |
| Frontend UI                  | React + TypeScript + Vite + Tailwind       |
| UI state                     | Zustand                                    |
| Server state / data fetching | TanStack Query                             |
| HTTP client                  | ky                                         |
| Game rendering               | Phaser (world and in-world animation only) |
| Real-time                    | Socket.IO                                  |
| Backend                      | Node.js + Express                          |
| Database                     | MongoDB via Mongoose                       |
| Validation                   | Zod                                        |

---

## Authority Model

```
Client                           Server
  │                                │
  │── socket "action" ────────────▶│
  │   { gameId, action, expectedTurn }
  │                                │  1. Zod-parse action
  │                                │  2. Verify expectedTurn == state.turn
  │                                │  3. applyAction(state, action, context)
  │                                │  4. applyDescendSideEffects (if descend)
  │                                │  5. Persist action log + snapshot
  │                                │  6. Broadcast new state + events
  │◀── socket "state" ─────────────│
  │   { gameId, turn, state, events }
```

1. The server runs the authoritative simulation.
2. The client sends **player actions only** — intent, never outcomes.
3. One valid action advances exactly one turn.
4. The client must never be the source of truth for game state.

### Optimistic Updates

The client applies actions immediately using the same shared engine (`applyAction`) to avoid input lag. On receiving a `state` broadcast from the server it reconciles: if the server state differs, pending optimistic turns are replayed on top of the authoritative state. On error the client rolls back to the last confirmed state.

---

## Determinism

The shared engine must be deterministic. Given the same initial state, RNG seed, and ordered action list, the result is always identical.

Rules that must never be broken:

- No `Math.random`, `Date.now`, or environment reads inside `packages/shared`.
- RNG is injected via `ApplyActionContext` and must be seedable.
- All state is JSON-serializable.

This enables full replay: any game can be reconstructed from its initial snapshot + action log.

---

## Persistence Model

```
MongoDB collections:

  heroes            one per run; tracks name, classId, status (active | dead | retired)
  gamesessions      session metadata + immutable floorConfigs + latestSnapshotTurn
  gamesnapshots     periodic state snapshots (written every 50 turns or on floor descend)
  gameactionlogs    every player action { gameId, turn, action }
```

### State Reconstruction

When a session is not in memory (e.g. server restart):

1. Load `gamesessions` to get `floorConfigs`, `seed`, `mapGenVersion`, and `latestSnapshotTurn`.
2. Load the `gamesnapshot` at `latestSnapshotTurn`.
3. Load all `gameactionlogs` with `turn > latestSnapshotTurn`.
4. Replay each action through `applyAction` in turn order.
5. Cache the reconstructed `GameState` in the in-memory session store.

### In-Memory Session Cache

`gameState.service.ts` maintains a `sessionStore` (Map keyed by `gameId`) holding:

- `state` — the current `GameState`
- `walkableByFloor` — per-floor walkability masks (recomputed on each state update)
- `opacityByFloor` — per-floor opacity masks (computed once; immutable for a run)
- `baseLayers` — generated tile layers (computed once; immutable for a run)

A per-game async lock (`withGameLock`) serialises concurrent action handling for the same game.

---

## Domain Model

All core types are defined in `packages/shared/src/game/types.ts` and `packages/shared/src/game/actions.ts`.

### GameState

`GameState` is the top-level serializable snapshot of a run. It holds the turn counter, the hero's current floor index, RNG state, and an array of `Floor` objects — each pairing an immutable `FloorConfig` with a mutable `FloorState`.

When `pendingInteraction` is non-null the game is paused: `move`, `attack`, and `use_skill` actions are rejected by the engine until the interaction is resolved. Current interaction types: `skill_choice` (level-up offer) and `loot_pickup` (item pile). This is the general mechanism for any future blocking interaction (shrines, NPC dialogue, etc.).

### FloorState

`FloorState` is the mutable per-turn state of one floor: the actors map, fog-of-war exploration mask, tile overrides, loot piles (`lootByIdx`), spawn position, and exit position. It changes on every turn; `FloorConfig` does not.

### Actor

Every entity on the map (hero and NPCs) is an `Actor`. Position is stored as a flat tile index (`idx`), not x/y coordinates. Each actor carries its definition ref (`def`), current stats, skill cooldowns, passive damage bonuses applied by passive skills at combat resolution time, status immunities, a `faction` tag (`"player"` | `"hostile"`) used for AI targeting, a list of timed active effects (buffs and conditions share the same structure — data-driven effects carry their numeric adjustments inline on the effect instance; ID-driven effects, such as DoT conditions and stealth, are wired to engine hooks registered in `packages/shared/src/config/skills.ts` (`STATUS_HOOKS`)), and a map of named numeric resources for state that changes independently of turn counting (e.g. shield absorption HP).

### Actions

Actions represent player intent only — never outcomes. The `Action` discriminated union covers movement, attacks, skill use, and level-up skill selection. All variants have co-located Zod schemas in `packages/shared/src/game/actions.ts` and are exported from `@app/shared`.

### Events

`applyAction` returns a `GameEvent[]` alongside the new state. Events describe side-effects (attacks, deaths, level-ups, floor descents, status applications) and are used by the client for animations and UI feedback. See `GameEvent` in `packages/shared/src/game/types.ts`.

---

## Map Generation

Maps are generated deterministically from `seed + floorIndex`. Generation parameters, biome themes, and algorithm selection for each floor live in `packages/shared/src/config/map.ts`.

The pipeline:

1. **Algorithm** generates a raw tile grid (`cave`, `bsp`, `hybrid`, or `arena`).
2. **Room analysis** tags rooms (`start`, `exit`, `boss`, `treasure`, `corridor`, `chamber`, `alcove`, `generic`).
3. **Vault injector** stamps ASCII-layout vaults into eligible rooms (vault definitions are validated; stamps must fit within the target room footprint).
4. **Base layers** (ground, wall, decoration) are computed and cached server-side.
5. **Spawn + exit placement**:
    - spawn is relocated if it lands on a blocked collision tile
    - exit selection is based on _reachable_ path distance from spawn (not Euclidean distance)
6. **Final validation/sanity pass** (hard guarantee):
    - recomputes reachability from spawn using the final walkability mask
    - prunes unreachable walkable tiles (so “walkable but unreachable” can’t survive)
7. **Fog-of-war** uses raycasting visibility; explored state is stored in `FloorState.explored`.

## Content Contract: Vault Entrances

Vaults are stamped as authored ASCII layouts. To ensure the resulting vault is navigable (and not sealed off by its own walls), vault JSON layouts must include at least one perimeter opening/walkable cell that allows connectivity into the stamped interior.
In other words: a vault layout made of walls on its entire boundary may become inaccessible once stamped.

---

## Combat

Turn-based melee. After every player action, all living NPCs on the current floor take a turn in deterministic order (sorted by actor ID). Stunned actors (hero or NPC) skip their entire turn.

- **Attack roll**: `d20 + STR modifier + flat attack bonus (passive skills) + flat attack bonus (equipped items) + dice bonus/penalty (status effects)` vs. effective target AC (target's base AC ± AC adjustments from active effects and equipped items). Advantage (roll 2d20, take higher) and disadvantage (take lower) from active status effects are resolved first; they cancel each other out if both apply.
- **Critical hit**: natural roll ≥ crit threshold (default 20, can be lowered by passive skills) — double damage dice.
- **Damage**: weapon dice + STR modifier (unarmed = 1d4), minimum 0; then reduced by defender resistances/immunities for each damage type (resistance halves; immunity makes it 0).
- **Saving throws**: `d20 + save ability modifier (+ proficiency bonus if proficient) + dice bonus/penalty (status effects)`, with natural 20 auto-success and natural 1 auto-fail.
- **Spell/skill save DC** (save-enabled effects): `DC = 8 + caster proficiency bonus + caster ability modifier`.
- **XP on kill** feeds a D&D 5e XP table (max level 20).
- **Level-up**: roll hit die + CON modifier HP gain (minimum 1).

### Skills

Skills are split into two types, both defined in `packages/content/src/raw/skills/`:

**Active skills** are dispatched as `use_skill` actions. The engine resolves them via `resolveSkill` in `packages/shared/src/skills/`, dispatching typed effect handlers defined in `packages/shared/src/skills/effects/`. Resolution uses the caster's per-skill **rank** (1–3) to select the matching tier from the skill definition's `effectsByRank`. They appear on the hotbar and have cooldowns.

Skill effect descriptor schemas are defined in `packages/shared` and are the single source of truth; `packages/content` re-exports them for JSON validation. TypeScript types are derived from those schemas — no manual interface mirroring is needed.

Active status effects fall into two categories. **Data-driven** effects define their numeric adjustments (e.g. bonus damage, AC adjustment, attack roll dice bonus/penalty, saving throw dice bonus/penalty, advantage/disadvantage flags) inline in the skill JSON via `CombatAdjustments`; the engine reads those values directly from the active effect at resolution time — no engine code is needed for new numeric modifiers. **ID-driven** effects require engine-wired behaviour at a specific lifecycle moment; these are registered in `packages/shared/src/config/skills.ts` (`STATUS_HOOKS`). Currently registered hooks include: `POISONED` (DoT), `REGENERATING` (HoT), `STEALTH` (NPC vision suppression), `STUNNED` (skip turn), `CHARMED` (flip faction so NPCs attack their former allies and follow the hero when idle), and `FRIGHTENED` (override combat behaviour so the NPC flees from visible enemies).

Active skill attacks (`single_target_damage`, `multi_strike`) support an optional `onHitStatus` field. When set, the named status is applied to the target on every successful hit — regardless of whether damage was dealt (e.g. a hit that was fully resisted still triggers the status).

**Passive skills** are granted at level-up (or applied to NPCs at spawn) and apply permanent buffs (`applyPassiveSkill`). They never appear on the hotbar; hero passives are listed in the sidebar. Passive effects include stat modifiers, AC changes, damage resistances/immunities, extra damage dice on qualifying attacks, and status immunities.

**Level-up acquisition**: on level-up the engine generates a deterministic mixed offer of up to 3 skills from the class pools (`generateSkillOffers` in `packages/shared/src/game/engineLevelUp.ts`). Offers can be new skills (bounded by per-type caps on how many actives and passives the hero may hold) or upgrades to an owned skill's rank (max 3). When both pools have candidates, the offer includes at least one active and one passive; the third slot is weighted toward the type the hero has fewer of. The player picks one via `select_skill_choice` (`skillId` only; rank is taken from the matching entry in `pendingInteraction.offers`). Rerolling is supported via `reroll_skill_choice`. This sets `pendingInteraction` on `GameState` until resolved.

Dice expressions use a consistent `"NdM"` string format (e.g. `"2d6"`), parsed by `rollDiceExpr` in `packages/shared/src/combat/dice.ts`.

---

## NPC AI

Each NPC carries a small AI state object (`NpcAIState`) alongside its actor data. It records two independent strategy tags — one governing **combat behaviour** (what to do when enemies are visible) and one governing **idle behaviour** (what to do otherwise) — plus any transient memory the active strategy needs (e.g. last known enemy position, follow target).

Every turn the engine runs a **two-phase dispatch**: the combat strategy runs first; if it has nothing to do it hands off to the idle strategy. Both phases are pure functions registered in `packages/shared/src/game/strategies/index.ts`. Adding a new strategy is a matter of creating a file under `packages/shared/src/game/strategies/`, adding the tag to the relevant union in `types.ts`, and registering the function — no other engine files need to change.

**NPC skills**: NPCs can use active skills just as the hero can. Each NPC definition carries `activeSkills` and `passiveSkills` as arrays of `{ id, rank }` objects; the engine initialises per-skill rank and cooldown state at spawn, applies passives at spawn, and ticks all actor cooldowns (not just the hero's) at the end of every player turn. AI strategies receive a `getSkillDef` callback via `AIContext` to inspect range, target type, and other skill metadata when deciding whether to use a skill this turn. Skill resolution goes through the same `resolveSkill` path regardless of whether the caster is the hero or an NPC.

**Faction-aware targeting**: before the AI loop the engine builds a transient faction map that incorporates any active status effects (e.g. CHARMED flips an NPC's effective faction so it attacks its former allies). Strategies read from this map rather than the stored faction field, so all faction logic is centralised in one place and strategies remain unaware of specific status effects.

**Per-turn strategy overrides**: status effects that alter behaviour (e.g. FRIGHTENED, CHARMED) inject temporary overrides into the AI context rather than mutating persisted state. After each turn the engine restores the original values, so status effects cannot corrupt saved AI state.

---

## Socket Protocol

| Event (client → server) | Payload                            | Description                                            |
| ----------------------- | ---------------------------------- | ------------------------------------------------------ |
| `join`                  | `{ gameId }`                       | Authenticate and load state; server emits `state` back |
| `action`                | `{ gameId, action, expectedTurn }` | Submit a player action                                 |

| Event (server → client) | Payload                           | Description                                          |
| ----------------------- | --------------------------------- | ---------------------------------------------------- |
| `state`                 | `{ gameId, turn, state, events }` | Authoritative state broadcast                        |
| `error`                 | `{ reason, currentTurn? }`        | Structured error (e.g. `turn_mismatch`, `forbidden`) |

Authentication uses an HttpOnly `game_token` cookie verified against `session.tokenHash` on `join`. The resulting auth context is stored on the socket for subsequent `action` events.

---

## Client Architecture

The client source under `apps/web/src/` is organised into four layers:

- `components/` — shared design-system components (buttons, modals, inputs, panels, and game HUD elements like the combat log and skill hotbar).
- `features/` — co-located Zustand stores and TanStack Query hooks, one subdirectory per feature (`game`, `map`, `error`, `targeting`).
- `game/` — Phaser integration: scenes, tile rendering, visual effect managers, per-skill animation handlers (registry pattern), the DCSS-style targeting overlay, and persistent buff visuals (overlay effects and sprite tints driven by actor state, managed via a registry so adding a new visual requires no changes to the scene).
- `pages/` — top-level route components.

**React + Tailwind** handles all menus, HUD, and non-world UI.  
**Phaser (`MainScene`)** renders the dungeon, tile layers, fog-of-war, sprites, and in-world animations. It does not own game logic.  
**Zustand `gameStore`** is the bridge: receives server state via socket, manages the optimistic action queue, rate-limits key repeat, and drives both the React UI and Phaser scene updates.
