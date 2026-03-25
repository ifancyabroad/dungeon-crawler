# Product Requirements Document

## Vision

A browser-based, server-authoritative roguelike dungeon crawler. Players explore procedurally generated multi-floor dungeons, fight monsters in turn-based combat, and level up a hero — all driven by a deterministic shared game engine that guarantees fair, replayable runs.

<!-- TODO: Describe the target audience / player persona. Who is this built for?
     Example: "Casual roguelike fans who want a quick browser session, no install required." -->

---

## Terminology

| Term       | Definition                                                                                                                                                                                                                                                 |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Run**    | A single hero's attempt at the dungeon, from creation to death or retirement. Each run has its own `gameId`, seed, and action log.                                                                                                                         |
| **Turn**   | One unit of game time. A turn advances when the server successfully applies a player action (`state.turn` increments by 1). All monsters also act within the same turn.                                                                                    |
| **Floor**  | One level of the dungeon. Floors are identified by zero-based index (`heroFloorIndex`). Each floor has an immutable `FloorConfig` (seed-derived layout) and a mutable `FloorState` (actors, explored tiles).                                               |
| **Actor**  | Any entity that occupies a tile and can act — the hero and all NPCs. Identified by a unique `ActorId` string. Position is stored as a flat tile index (`idx`).                                                                                             |
| **Action** | A player intent sent from the client to the server. Currently `move`, `attack` (each with a cardinal direction), `use_skill` (skillId + optional target), `select_skill_choice`, and `reroll_skill_choice`. Actions are the only input the server accepts. |
| **Event**  | A side-effect produced by `applyAction` and broadcast alongside the new state. Used by the client for animations and UI feedback (e.g. `attack`, `death`, `level_up`, `descend`).                                                                          |

---

## Current State (v0.1.0-alpha)

### Core Game Loop

1. **Landing** — new game or continue an active hero. Warns before abandoning a run.
2. **Character creation** — choose a class (Warrior, Mage, Rogue), enter or randomize a hero name.
3. **Dungeon** — navigate a 4-floor dungeon, fight monsters, descend to the next floor via the exit tile.
4. **Death** — hero death ends the run; a death modal is shown and the hero is marked dead in the database.

### Classes

The game currently ships with **three starter classes**. Class definitions (including stats) live in `packages/content/src/raw/classes/`.

### Floors

The dungeon currently has **four floors** with increasing difficulty and different generation styles. Floor progression and generation parameters live in `packages/shared/src/config/map.ts` (e.g. `FLOOR_CONFIGS`).

### Combat

Turn-based melee using D&D-inspired dice rolls — move or attack in a cardinal direction each turn. Monsters act after every player action. Full mechanics (roll formula, crit rules, resistance/immunity math, XP table) are in the Combat section of [docs/ARCHITECTURE.md](ARCHITECTURE.md).

### Skills

Skills are split into two types:

- **Active skills** are used from the hotbar. Each class starts with one active skill; additional skills are acquired through level-up.
- **Passive skills** are granted at level-up and apply permanent buffs to the hero (stat modifiers, extra damage dice, resistances, immunities, etc.). They are listed in the sidebar.

On reaching a new level the game pauses and offers a mixed set of up to 3 skills (actives and passives), including possible upgrades to ranks 2–3 for skills already owned. Per-type caps limit how many distinct actives and passives the hero can learn. The player may reroll the offer before picking. Regular actions are blocked until a skill is chosen.

Skill definitions live in `packages/content/src/raw/skills/` and are data-driven.

### NPCs

The current NPC roster is intentionally small while core systems stabilise. Canonical NPC definitions live in `packages/content/src/raw/npcs/`, with encounters in `packages/content/src/raw/encounters/`. Each NPC definition includes `faction` (combat alignment: `"hostile"` or `"player"`) and `role` (behavioral category: `"grunt"`, `"boss"`, `"mercenary"`, or `"vendor"`).

A boss encounter placeholder is in place on the final floor.

### Persistence

- Each run is an independent hero record.
- State is stored as a snapshot + full action log (enables deterministic replay).
- Snapshots are written periodically and on every floor descent.

### UI / UX (implemented)

- Combat log panel
- Death modal
- Level-up modal
- Character sheet modal
- Fog-of-war (raycasting visibility)
- Damage numbers, health bars, attack animations, death effects
- Skill hotbar (cooldown display, click to activate; DCSS-style targeting overlay for tile/actor selection)

### UI / UX (stubbed — data model exists, UI shell present)

- Inventory modal
- Skills modal (full skill list / descriptions)

---

## Planned Features

Features are listed in priority order. Implementation details below are starting points; update them as design solidifies.

---

### 1. Items & Inventory

**Goal:** Give players gear to find and equip, increasing build diversity and strategic choice.

**Scope:**

- Weapons (melee, ranged), armor, and consumables (potions).
- Items dropped by monsters or found in treasure rooms.
- Equip/unequip from the inventory modal (stub already present in `apps/web`).
- Equipped items modify actor stats at turn resolution time via the shared engine.

<!-- TODO: Define item types and their stat effects in more detail.
     - What slots exist? (weapon, offhand, head, body, feet, …)
     - Should there be item rarity tiers?
     - How are consumables (potions) used — as a dedicated action type?
     - How many items can a floor drop? Any guarantees (e.g. always one weapon per floor)? -->

**Content location:** `packages/content/src/raw/` — add `items/` directory following the existing pattern (JSON → Zod-validated → typed lookup).

---

### 2. Skills & Class Abilities (foundation shipped)

**Goal:** Differentiate classes beyond starting stats. Each class should have a distinct playstyle driven by unique active and/or passive abilities.

**Shipped:** Starting skill per class, passive skill system, level-up mixed pick-from-3 (caps, ranks 1–3, upgrades), skill pools per class, reroll support, and sidebar passive skill listing.

**Remaining scope:**

- Expand skill pools per class (more active and passive options).
- Reroll cost in gold (currently free).
- Full skills modal (currently stubbed) showing all acquired skills with descriptions.

---

### 3. More Monster Types

**Goal:** Increase combat variety across floors. Each floor should feel meaningfully different from the last.

**Shipped:** Rat (melee, poison bite skill) and Goblin Mage (ranged AI, magic arrow + fireball skills) added to floor 1. A `ranged` combat AI strategy is now available for use in future monster definitions. Monsters can use active skills autonomously — skill definitions, cooldown ticking, and resolution all go through the same engine path as hero skills.

**Remaining scope:**

- Additional monster types for floors 2–4 (targeting ~6–8 total at launch).
- Boss on floor 4 replaced with a unique monster and encounter.

<!-- TODO: Define the remaining monster roster.
     - What are the new monster names, stats (HP, AC, XP), and AI strategies for floors 2–4?
     - What should the floor 4 boss look like mechanically? -->

---

### 4. Leaderboard / Run History

**Goal:** Surface completed runs so players can compare scores and revisit past attempts.

**Scope:**

- A leaderboard page accessible from the landing screen.
- Displays completed/dead heroes with: name, class, floors reached, turns survived, monsters killed.

<!-- TODO: Clarify the leaderboard scope.
     - Global ranking (all players) or personal run history only?
     - What is the primary sort metric? (floors reached? monsters killed? turns survived?)
     - Are runs anonymous or tied to a future user account? -->

---

## Out of Scope

The following are explicitly not planned for the current development phase:

- **Multiplayer / co-op** — the authority model supports only one hero per game session.
- **User authentication / accounts** — runs are identified by a cookie-bound game token, not a registered user.
- **Multiple simultaneous save slots** — one active hero per browser session.
- **Non-browser clients** — no native app or mobile target.
