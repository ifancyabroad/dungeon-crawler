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
  content/      Validated JSON content (classes, monsters, encounters, vaults) + generated typed lookups
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

The deterministic game engine. **All authoritative game rules live here** — movement, combat, map generation, monster AI, levelling, and state transitions. Neither `apps/api` nor `apps/web` may re-implement game logic that belongs in this layer.

- Pure functions only: no I/O, no network, no database, no React, no Phaser.
- Exports `applyAction(state, action, context)` as the single entry point for turn resolution.
- Exports all `Action` Zod schemas and the full `GameState` type tree.

### `packages/content`

Static game data as validated JSON. Defines what exists in the game world (classes, monsters, encounters, vaults, skills) but contains no logic.

- Each content type lives under `src/raw/<type>/` as a JSON file validated by a Zod schema.
- A build script generates typed lookup objects (`monstersById`, `encountersById`, `skillsById`, etc.) consumed by `apps/api` and `apps/web`.
- Never hardcode content values in logic files — always source from `@app/content`.

### `apps/api`

Infrastructure and wiring layer. It does not contain game logic.

- Validates all client input with Zod (schemas from `@app/shared`).
- Calls `applyAction` from `@app/shared` to advance state.
- Owns persistence (MongoDB), the in-memory session cache, socket auth, and the action/snapshot write pipeline.
- Applies side effects that require infrastructure context (e.g. spawning monsters on floor descent).

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

### GameState

```typescript
interface GameState {
	turn: number;
	heroId: ActorId; // always "hero"
	heroFloorIndex: number;
	seed: number;
	mapGenVersion: number;
	floors: Floor[]; // Floor = { config: FloorConfig; state: FloorState }
	rngState: RngState;
}
```

### FloorState (mutable per turn)

```typescript
interface FloorState {
	tileOverrides: Record<string, TileId>;
	actorsById: Record<ActorId, Actor>;
	explored: number[]; // flat fog-of-war mask
	spawnIdx: number;
	exitIdx: number | null;
}
```

### Actor

Every entity on the map (hero and monsters) is an `Actor`. Key fields:

- `idx` — flat tile index (not x/y)
- `def` — `{ type: "hero"; classId }` or `{ type: "monster"; monsterId }`
- `aiState` — present on monsters; drives `MonsterAIState`
- `skills` — map of `skillId → { cooldownRemaining }` for all skills the actor knows
- `statusEffects` — array of active `{ id, remainingTurns }` entries (e.g. `stealth`)

### Actions

```typescript
type Action =
	| { type: "move"; direction: "up" | "down" | "left" | "right" }
	| { type: "attack"; direction: "up" | "down" | "left" | "right" }
	| { type: "use_skill"; skillId: string; targetTileIdx?: number; targetActorId?: string };
```

All actions have Zod schemas exported from `@app/shared`.

### Events

`applyAction` returns events alongside the new state:

```typescript
type GameEvent =
	| { type: "attack"; attackerId; defenderId; result: AttackResult }
	| { type: "skill_hit"; attackerId; defenderId; skillId; result: AttackResult } // physical skill hit (e.g. Charge); ignored by bump animator
	| {
			type: "area_hit";
			attackerId;
			defenderId;
			skillId;
			damage: number; // total effective damage after resistances/immunities
			damagePackets: { damageType: string; rawAmount: number; effectiveAmount: number }[]; // per-type breakdown
	  } // AoE damage (e.g. Fireball); no to-hit roll
	| { type: "skill_used"; actorId; skillId; targetTileIdx?; targetActorId? }
	| { type: "status_applied"; actorId; statusId; durationTurns }
	| { type: "death"; actorId }
	| { type: "level_up"; actorId; newLevel; hpGained }
	| { type: "descend"; fromFloor; toFloor };
```

---

## Map Generation

Maps are generated deterministically from `seed + floorIndex`. Four floors of increasing size:

| Floor | Theme         | Algorithm | Size  |
| ----- | ------------- | --------- | ----- |
| 0     | green_forest  | cave      | 50×50 |
| 1     | orange_forest | bsp       | 55×55 |
| 2     | yellow_forest | hybrid    | 60×60 |
| 3     | dark_forest   | bsp       | 65×65 |

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

Turn-based melee. After every player action, all living monsters on the current floor take a turn in deterministic order (sorted by actor ID).

- Attack roll: d20 + STR modifier vs. target AC.
- Natural 20 = critical hit (double damage dice).
- Damage: weapon dice + STR modifier (unarmed = 1d4), minimum 0; then reduced by defender resistances/immunities for each damage type (resistance halves; immunity makes it 0).
- XP on kill feeds a D&D 5e XP table (max level 20).
- Level-up: roll hit die + CON modifier HP gain (minimum 1).

### Skills

Active skills are dispatched as `use_skill` actions. The engine resolves them via `resolveSkill` in `packages/shared/src/skills/`, which dispatches skill-specific effect handlers (e.g. `area_damage`, `apply_status`, `charge_attack`). Damage effects declare D&D damage types in content (`damageType` for `area_damage`, `bonusDamageType` for `charge_attack`) and the shared engine applies defender resistances/immunities per damage packet.

Dice expressions use a consistent `"NdM"` string format (e.g. `"2d6"`), parsed by `parseDice` / `rollDiceExpr` in `packages/shared/src/combat/dice.ts`.

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

```
apps/web/src/
  components/     Design system (Button, Modal, Input, Card, Sidebar, CombatLog, SkillHotbar, …)
  features/
    game/         gameStore (Zustand) — holds GameState, optimistic turn queue
    map/          mapStore
    error/        errorStore
    targeting/    targetingStore — active skill-targeting mode state
  game/           Phaser integration
    scenes/       MainScene (render loop), PreloadScene (asset loading)
    tiles/        tilesetRegistry, mapTileMapping
    fx/           MoveTweenManager, AttackAnimator, HealthBarManager, DeathFxManager, DamageNumberManager
    fx/skills/    Per-skill visual effect handlers (fireball.ts, charge.ts); registry pattern
    skills/       SkillAnimationController — dispatches skill animations by skill ID
    targeting/    TargetingSystem — DCSS-style targeting overlay and pointer input
  pages/          Landing, CharacterCreate, Game, NotFound
  lib/            api helpers (ky), error types, nameGenerator
```

**React + Tailwind** handles all menus, HUD, and non-world UI.  
**Phaser (`MainScene`)** renders the dungeon, tile layers, fog-of-war, sprites, and in-world animations. It does not own game logic.  
**Zustand `gameStore`** is the bridge: receives server state via socket, manages the optimistic action queue, rate-limits key repeat, and drives both the React UI and Phaser scene updates.
