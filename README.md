# MERN Phaser Template (Monorepo)

Small starter for a game: **React + Vite + Tailwind v4 + Phaser** (web) and **Express 5 + Mongoose + Zod** (API). Shared types live in `packages/shared`. Fetching uses **TanStack Query** + **ky**.

## Prereqs

- Node 18+ (20+ recommended)
- pnpm 9+

## Quick Start

```bash
pnpm install
pnpm dev          # runs web + api + shared watchers
# Web: http://localhost:5173
# API: http://localhost:4000
```

## Project Layout

```
apps/
  api/    # Express 5 (TS), Helmet, CORS, Compression
  web/    # Vite + React + Tailwind v4 + Phaser
packages/
  shared/ # Zod schemas & TS types
```

## Env Vars

**API** (`apps/api/.env`)

```
PORT=4000
MONGO_URI=mongodb://127.0.0.1:27017/your_game
# WEB_ORIGIN=https://your-site.example  # for CORS in prod (optional)
```

**Web** (`apps/web/.env.example`)

```
VITE_API_BASE_URL=/api
```

## Notes

- Vite dev proxy forwards `/api` → `http://localhost:4000`.
- With **ky** and `prefixUrl`, **do not** start paths with `/`:
    ```ts
    api.get("health").json(); // correct (not '/health')
    ```

## Common Scripts

```bash
pnpm lint         # ESLint v9 flat config (root)
pnpm format       # Prettier
pnpm typecheck    # tsc in each package
pnpm build        # build all packages
pnpm --filter @app/api start     # run API from dist
pnpm --filter @app/web preview   # preview web build
```
