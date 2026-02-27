# Dungeon Crawler

A dungeon crawler game (server-authoritative, turn-based). Monorepo: React + Phaser (web), Express + MongoDB (API), shared game engine in `packages/shared`.

## Tech Stack

| Layer    | Technologies                                       |
| -------- | -------------------------------------------------- |
| Frontend | React, TypeScript, Vite, Tailwind, Phaser, Zustand |
| Backend  | Node.js, Express, Mongoose, Zod                    |
| Tooling  | TypeScript, ESLint, Prettier, Vitest, Husky        |
| Package  | pnpm workspaces                                    |

## Prerequisites

- Node.js 18+ (20+ recommended)
- pnpm 10+
- MongoDB (local or Atlas)

## Quick Start

```bash
pnpm install
pnpm dev
# Web: http://localhost:5173
# API: http://localhost:4000
```

## Project Layout

```
apps/
  api/      # Express API + persistence
  web/      # React + Phaser client
packages/
  shared/   # Deterministic game engine + shared schemas
```

## Environment

**API** (`apps/api/.env`)

```env
PORT=4000
MONGO_URI=mongodb://127.0.0.1:27017/dungeon_crawler
```

**Web** (`apps/web/.env`) — optional

```env
VITE_API_BASE_URL=/api
```

## Scripts

| Command          | Description            |
| ---------------- | ---------------------- |
| `pnpm dev`       | Run web + API in watch |
| `pnpm build`     | Build all packages     |
| `pnpm typecheck` | Type check all         |
| `pnpm lint`      | ESLint                 |
| `pnpm test`      | Vitest                 |
| `pnpm format`    | Prettier               |

Production: `pnpm --filter @app/api start` | `pnpm --filter @app/web preview`
