# Testing Strategy

This document defines how tests are organized, what we prioritize, and which legacy tests should be kept, rewritten, replaced, or removed.

## Principles

- Prefer deterministic assertions over timing-sensitive event-count assertions.
- Test behavior and invariants, not internal implementation details.
- Keep tests colocated with the module they protect.
- Prioritize engine and server-authoritative correctness over broad UI coverage.

## File And Naming Conventions

- Name files `*.test.ts` (or `*.test.tsx` for React component tests).
- Place tests under `src/` next to the related module (no `__tests__` directory).
- Group tests by behavior in `describe` blocks and keep one clear expectation per `it`.
- Use Arrange-Act-Assert flow; avoid mixing setup and assertions.

## Ownership And Placement Rules

- `packages/shared/src/<domain>/...`
    - Owns deterministic engine logic tests (combat, map, game state transitions, skills, rng).
    - Tests must be colocated in the relevant subdirectory, not dumped at `packages/shared/src/`.
- `apps/api/src/<domain>/...`
    - Owns API wiring tests only (routes, socket handlers, middleware, model/persistence wiring, auth/cookies, server bootstrap).
    - Do not place pure shared-engine behavior tests here.
- `apps/web/src/<domain>/...`
    - Owns client UI/store/scene/input/fx behavior tests.
    - Keep scene pipeline tests under `apps/web/src/game/scenes/main/` with the modules they validate.

## Async And Flake Policy

- Do not assert exact totals of asynchronous socket events unless protocol guarantees that count.
- Avoid arbitrary waits/sleeps; prefer invariant-based polling with bounded timeout.
- Always clean up sockets/listeners/servers in `afterEach` to avoid hook timeouts.
- Treat flaky tests as defects: rewrite or replace them before adding new coverage.

## Mocking Policy

- Prefer boundary mocks (DB/network/process boundaries), not deep internal behavior mocks.
- Assert externally observable outcomes (state turn progression, persistence calls, error reasons).
- Keep mock setup local to the suite that needs it.

## Current Test Layout

### `packages/shared` (engine/domain logic)

- `packages/shared/src/combat/resolveAttack.test.ts`
- `packages/shared/src/combat/savingThrows.test.ts`
- `packages/shared/src/map/generate.test.ts`
- `packages/shared/src/map/visibility.test.ts`
- `packages/shared/src/map/walkableMask.test.ts`
- `packages/shared/src/game/engine.determinism.test.ts`
- `packages/shared/src/game/engine.invariants.test.ts`
- `packages/shared/src/game/replay.test.ts`
- `packages/shared/src/skills/applyPassiveEffect.test.ts`
- `packages/shared/src/skills/skillChoiceActions.test.ts`
- `packages/shared/src/skills/skillSystem.determinism.test.ts`

### `apps/api` (API wiring/contracts)

- `apps/api/src/routes/game.routes.test.ts`
- `apps/api/src/socket/game.socket.test.ts`
- `apps/api/src/services/gameState.concurrency.test.ts`
- `apps/api/src/services/snapshotValidation.test.ts`
- `apps/api/src/lib/gameToken.test.ts`
- `apps/api/src/lib/mapGeneration.hardening.test.ts`

### `apps/web` (client/store/scene behavior)

- `apps/web/src/components/ErrorFallback.test.tsx`
- `apps/web/src/features/map/mapStore.test.ts`
- `apps/web/src/features/game/gameStore.serverSync.test.ts`
- `apps/web/src/features/game/gameStore.actions.test.ts`
- `apps/web/src/game/scenes/main/inputBindings.test.ts`
- `apps/web/src/game/scenes/main/turnUpdatePipeline.test.ts`
- `apps/web/src/game/scenes/main/fxOrchestrator.test.ts`

## Current Audit Status

- Shared-engine tests that were previously in `apps/api/src/services/` have been relocated to `packages/shared/src/<domain>/`.
- API tests are now focused on API contracts/wiring, with one integration-style map hardening test kept under `apps/api/src/lib/`.
- Web tests are split and colocated by feature/scene module instead of monolithic files.

## High-Value Additions

- Add direct tests to `packages/shared` for deterministic engine invariants.
- Keep coverage focused on:
    - action turn progression,
    - replay equivalence,
    - movement validity outcomes,
    - deterministic outcomes for identical seed + action sequences.

## Validation

Before completing testing work:

- `pnpm test`
- `pnpm typecheck`
- `pnpm lint`
