# Agent Guidelines

This file provides instructions for AI coding agents working in this repository.

Before making changes, read the relevant documentation:

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — system design, authority model, package boundaries, persistence, socket protocol
- [docs/PRD.md](docs/PRD.md) — product vision, current features, planned work, and domain terminology
- [docs/WORKFLOWS.md](docs/WORKFLOWS.md) — step-by-step checklists for common implementation tasks

---

## Project at a Glance

A server-authoritative, turn-based roguelike dungeon crawler. The server owns canonical game state; the client sends player intent. A deterministic shared engine in `packages/shared` runs on both sides. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full technical picture and [docs/PRD.md](docs/PRD.md) for domain terminology and product scope.

---

## Package Ownership

Before writing any code, identify which package owns the change.

| Package            | Owns                                                                                         |
| ------------------ | -------------------------------------------------------------------------------------------- |
| `packages/shared`  | Game engine, `GameState`, `Action` union, Zod schemas, map generation, combat, RNG           |
| `packages/content` | JSON definitions for classes, monsters, encounters, vaults — and the generated typed lookups |
| `apps/api`         | HTTP routes, socket handlers, MongoDB persistence, session cache, business logic wiring      |
| `apps/web`         | React UI, Phaser rendering, Zustand stores, TanStack Query hooks                             |

If a change touches multiple packages, outline a short plan before editing.

---

## Code Quality Principles

### Single Responsibility

Each function, module, and file should do one thing. If a function is doing two distinct things, split it.

- Prefer small, named functions over large anonymous callbacks.
- Extract logic from socket/route handlers into `services/` or `lib/` files.
- Keep Phaser scene methods focused on rendering; push logic into stores or shared engine.

### Modularity

- Co-locate related code: a feature's store, hook, and types belong together under `features/<name>/`.
- New content types (monsters, items, encounters) go in `packages/content/src/raw/` as JSON, not hardcoded in logic files.
- New shared engine behaviour belongs in `packages/shared`, not duplicated in `apps/api` and `apps/web`.

### Readability

- Use descriptive names. Avoid abbreviations unless they are domain-standard (`hp`, `ac`, `rng`, `idx`).
- Do not add comments that restate what the code does. Comments should explain non-obvious intent, trade-offs, or constraints.
- Prefer explicit early returns over deeply nested conditionals.
- Keep functions short enough to understand without scrolling.

---

## Hard Constraints

These rules are always enforced, regardless of the task:

1. **Server is authoritative.** Never compute game outcomes on the client only. The client may optimistically apply actions using `applyAction` from `@app/shared`, but the server result is always authoritative.

2. **Determinism.** No `Math.random`, `Date.now`, or environment reads inside `packages/shared`. RNG is always injected via `ApplyActionContext`. State must remain JSON-serializable.

3. **Locked stack.** Do not substitute core technologies. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full stack. In brief: React + Vite + Tailwind + Phaser on the client; Express + MongoDB/Mongoose on the server; Zustand for UI state; TanStack Query for server state; ky for HTTP; Zod for validation.

4. **Zod validation on every API/socket input.** Prefer schemas from `@app/shared`. Never trust client-computed results or client-provided RNG seeds.

5. **Persist every action.** Every player action must be appended to `gameactionlogs` and an authoritative state returned. Do not silently drop actions.

---

## Making Changes

### Minimal Diffs

- Only change what is required to complete the task.
- Do not refactor unrelated files or rename things outside the scope of the task.
- Do not reformat files that are not being edited.

### Common Workflows

Detailed checklists for adding monsters, items, actions, and UI features are in [docs/WORKFLOWS.md](docs/WORKFLOWS.md).

---

## Validation Checklist

Before finishing a task, verify:

```bash
pnpm typecheck   # must pass across all packages
pnpm lint        # no new lint errors
pnpm test        # no regressions
```

For changes to `packages/shared`, confirm the engine is still deterministic: same seed + same actions must always produce the same state.
