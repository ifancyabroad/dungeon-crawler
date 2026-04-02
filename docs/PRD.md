# Product Requirements Document

## Vision

A browser-based, server-authoritative roguelike dungeon crawler. Players explore procedurally generated multi-floor dungeons, fight monsters in turn-based combat, and level up a hero — all driven by a deterministic shared game engine that guarantees fair, replayable runs.

<!-- TODO: Describe the target audience / player persona. Who is this built for?
     Example: "Casual roguelike fans who want a quick browser session, no install required." -->

---

## Terminology

| Term           | Definition                                                                                                                                                                                                                                                 |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Run**        | A single hero's attempt at the dungeon, from creation to death or retirement. Each run has its own `gameId`, seed, and action log.                                                                                                                         |
| **Turn**       | One unit of game time. A turn advances when the server successfully applies a player action (`state.turn` increments by 1). All monsters also act within the same turn.                                                                                    |
| **Floor**      | One level of the dungeon. Floors are identified by zero-based index (`heroFloorIndex`). Each floor has an immutable `FloorConfig` (seed-derived layout) and a mutable `FloorState` (actors, explored tiles).                                               |
| **Actor**      | Any entity that occupies a tile and can act — the hero and all NPCs. Identified by a unique `ActorId` string. Position is stored as a flat tile index (`idx`).                                                                                             |
| **Action**     | A player intent sent from the client to the server. Currently `move`, `attack` (each with a cardinal direction), `use_skill` (skillId + optional target), `select_skill_choice`, and `reroll_skill_choice`. Actions are the only input the server accepts. |
| **Event**      | A side-effect produced by `applyAction` and broadcast alongside the new state. Used by the client for animations and UI feedback (e.g. `attack`, `death`, `level_up`, `descend`).                                                                          |
| **Item**       | A piece of equipment the hero can pick up and equip during a run. Items are generated procedurally (or hand-crafted for uniques) and exist only within the run they were found in.                                                                         |
| **Affix**      | A randomly selected bonus property attached to an item at generation time (e.g. +10 max HP, +5% crit chance, fire resistance). The number of affixes an item can carry is determined by its rarity.                                                        |
| **Rarity**     | A tier that determines an item's enhancement bonus and affix count: Common, Uncommon, Rare, Epic, or Unique. Higher rarity items are less likely to drop.                                                                                                  |
| **Loot table** | A per-NPC weighted list of possible drops (items and/or gold). Evaluated deterministically using the run seed at the moment of the monster's death.                                                                                                        |
| **Gold**       | A currency dropped by enemies and spent in-run on skill rerolls (and eventually at a merchant). Gold does not persist between runs.                                                                                                                        |

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

**Goal:** Give players gear to find and equip, increasing build diversity and strategic choice across runs.

---

#### Equipment Slots

Each hero has nine equipment slots:

| Slot      | Notes                      |
| --------- | -------------------------- |
| Weapon    | Melee or ranged (bow)      |
| Off-hand  | Shield or off-hand weapon  |
| Head      |                            |
| Body      |                            |
| Hands     |                            |
| Feet      |                            |
| Ring (×2) | Two independent ring slots |
| Amulet    |                            |

Inventory capacity equals exactly what the hero can wear — there is no bag or stash. Picking up a new item immediately prompts a swap decision if the relevant slot is already occupied.

Consumables (potions) are handled by a separate system and do not occupy equipment slots.

---

#### Rarity

Items have one of five rarity tiers. Rarity determines both the enhancement bonus and the number of affixes rolled at generation time.

| Rarity   | Colour | Enhancement bonus | Affix count |
| -------- | ------ | ----------------- | ----------- |
| Common   | White  | None              | 0           |
| Uncommon | Green  | +1                | 1           |
| Rare     | Blue   | +2                | 2           |
| Epic     | Purple | +3                | 3           |
| Unique   | Gold   | +4 or +5          | Fixed       |

The enhancement bonus maps directly to the D&D +N system and applies to the item's core stat (attack bonus for weapons, AC bonus for armour, etc.).

---

#### Procedural Item Generation

All non-unique items are generated at the moment of a loot roll. Generation is fully deterministic — the run seed combined with the turn number produces the same item every time given the same inputs.

**Base items** define the item's type, slot, and core stats (e.g. a Longsword with 1d8 damage, a Leather Armour with AC 11). Base item definitions live in `packages/content/src/raw/items/`.

**Affixes** are randomly drawn from a global affix pool and attached according to rarity. Each affix definition declares which slot types it is eligible for — this constrains which affixes can appear on which items at generation time. Examples of affixes by category:

- Stat bonuses: +max HP, +STR/DEX/INT modifier, +AC — eligible on any slot
- Defensive: resistance or immunity to a damage type (fire, poison, etc.) — eligible on any slot
- Offensive on-hit effects: bonus flat damage of a damage type on hit (e.g. +1d4 fire), chance to apply a status effect on hit (e.g. 20% chance to poison) — **weapons only**
- Recovery: HP regen per turn, life-on-hit — eligible on any slot
- Skill-related: reduced cooldown on a skill category, bonus damage when a status condition is active on the target — eligible on any slot

The affix pool must be large enough that no two runs are likely to produce the same combination of gear. More affix types should be added over time to keep runs feeling distinct.

**Naming** is generated dynamically from the base item name and its affixes (e.g. "Fiery Longsword of the Bear"). Each affix definition declares an optional `namePrefix`, an optional `nameSuffix`, and a numeric `namePriority`. The name composer selects at most one prefix and one suffix: when multiple affixes on the same item compete for the same position, the one with the highest `namePriority` wins. Items with no winning prefix or suffix simply use the bare base item name.

---

#### Unique Items

Uniques are hand-crafted and defined as JSON in `packages/content/src/raw/items/`, alongside base item definitions. They are distinguished by `"rarity": "unique"` in the JSON. They have fully specified, fixed stats — no affix slots, no random rolls — and carry +4 or +5 enhancement bonuses (tiers reserved exclusively for uniques). They are displayed in gold and are rarer than epic items. Uniques can drop from enemies via the standard loot table system.

---

#### Loot Tables

Each NPC definition includes a weighted loot table describing what it can drop on death. A loot roll evaluates:

1. **Drop chance** — probability that anything drops at all.
2. **Gold amount** — optional gold drop range (min/max).
3. **Item drop** — optional weighted list of base item types and rarity weights.

Floor depth influences rarity weights: higher floors bias rolls toward better rarities and higher-tier base items. However, good items can drop on any floor — floor depth affects probability, not hard caps.

---

#### Gold

Gold drops alongside items and accumulates in the hero's run wallet. Current uses:

- **Skill rerolls** — spending gold replaces the current level-up offer with a new set of three choices (currently free; gold cost will be introduced with this system).
- **Merchant** (planned) — a future vendor NPC will offer items and services in exchange for gold.

Gold does not persist between runs.

---

#### Inventory UX

- The inventory modal (stub already present in `apps/web`) shows all nine slots and the hero's currently equipped items.
- Clicking a slot opens an item comparison view if the hero is holding a replacement.
- Equipped items modify actor stats at turn resolution time via the shared engine — the engine must derive effective stats from the equipped item set on every stat read.

---

**Content locations:**

- Item definitions (base items and uniques): `packages/content/src/raw/items/`
- Affix pool: `packages/content/src/raw/affixes/`
- NPC loot tables: extend existing NPC definitions in `packages/content/src/raw/npcs/`

---

### 2. Skills & Class Abilities (foundation shipped)

**Goal:** Differentiate classes beyond starting stats. Each class should have a distinct playstyle driven by unique active and/or passive abilities.

**Shipped:** Starting skill per class, passive skill system, level-up mixed pick-from-3 (caps, ranks 1–3, upgrades), skill pools per class, reroll support, and sidebar passive skill listing.

#### Design Principles

**Class identity**
Each class must feel mechanically distinct from the others. Differences should be felt in moment-to-moment play, not just in stat sheets. This is achieved through:

- Class-exclusive skill pools: no skill is available to more than one class. A player who has seen one class's level-up offers cannot predict another class's options.
- A starting kit that communicates the class fantasy immediately — the first run of a new class should feel like a different game.

**Build diversity within a class**
Each class must support at least two meaningfully different builds by the time the dungeon is complete. A "build" here means a coherent set of actives and passives whose combined effect is greater than the sum of their parts. Build paths should emerge from skill selection, not be prescribed.

Guidelines:

- Offer at least two distinct "axes" of play per class (e.g. Warrior: sustained DPS vs. burst + defensive; Rogue: single-target burst vs. area DoT; Mage: direct damage vs. crowd-control + attrition).
- Items acquired on a run should be able to push a player further down an already-chosen axis or open a hybrid route.
- No build should require a specific skill to be functional; options should feel like meaningful choices rather than mandatory picks.

**Skill synergies**
Synergies are the primary driver of replayability. When two skills interact, the combined effect should be discoverable through play — not explained in a tutorial.

Synergy patterns to encode in skill design:

- **Condition → payoff**: one skill inflicts a status (e.g. Bleed, Stun, Ignite); another skill deals bonus damage or gains bonus effect against targets in that state.
- **Stance / mode toggle**: a passive or active changes the rules for a window of time; other skills should have explicit in-window bonuses.
- **Scaling amplifier**: a passive multiplies the effect of a specific damage type or skill category, making later picks of that category materially stronger.

Each class's skill pool should contain enough synergy pairs that a player will encounter different combinations across runs, with no single "solved" build being clearly dominant.

**Run variance ("no two runs feel the same")**
The level-up offer system (pick-from-3, reroll) is the main engine of run variance. To sustain this:

- A class's total skill pool must be large enough that any two runs are unlikely to see the same offer sequence.
- The interaction between skill choices and item drops on a given run should produce emergent combinations that the player didn't plan for going in.

**Remaining scope:**

- Expand skill pools per class (more active and passive options) — minimum target: ~8–10 distinct skills per class before the pool feels repetitive.
- Define and document all intended synergy pairs per class so they can be validated in content review.
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
