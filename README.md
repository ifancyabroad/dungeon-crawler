# MERN Phaser Template (Monorepo)

A starter template for building games with **React 19 + Vite + Tailwind v4 + Phaser 3** (web) and **Express 5 + Mongoose 9 + Zod** (API). Shared types live in `packages/shared`. Data fetching uses **TanStack Query** + **ky**.

## Tech Stack

| Layer           | Technologies                                                        |
| --------------- | ------------------------------------------------------------------- |
| Frontend        | React 19, Vite 7, Tailwind CSS 4, Phaser 3, TanStack Query, Zustand |
| Backend         | Express 5, Mongoose 9, Zod validation                               |
| Tooling         | TypeScript 5.9, ESLint 9, Prettier, Vitest, Husky                   |
| Package Manager | pnpm workspaces                                                     |

## Prerequisites

- Node.js 18+ (20+ recommended)
- pnpm 10+
- MongoDB instance (local or Atlas)

## Quick Start

```bash
pnpm install
pnpm dev          # runs web + api + shared watchers in parallel
# Web: http://localhost:5173
# API: http://localhost:4000
```

## Project Layout

```
apps/
  api/           # Express 5 API with Mongoose, Helmet, CORS, Compression
  web/           # Vite + React + Tailwind v4 + Phaser game
packages/
  shared/        # Shared Zod schemas & TypeScript types
```

## Environment Variables

**API** (`apps/api/.env`)

```env
PORT=4000
MONGO_URI=mongodb://127.0.0.1:27017/your_game
# WEB_ORIGIN=https://your-site.example  # CORS origin for production
```

**Web** (`apps/web/.env`) - optional

```env
VITE_API_BASE_URL=/api
```

## Shared Types

The `@app/shared` package exports types used by both apps:

```ts
import { ScoreSchema, ScoreInput, ScoreResponse, HealthResponse } from "@app/shared";
```

## Scripts

```bash
# Development
pnpm dev              # Run all apps in watch mode

# Quality
pnpm typecheck        # Type check all packages
pnpm lint             # ESLint (v9 flat config)
pnpm format           # Prettier

# Testing
pnpm test             # Run all tests (Vitest)
pnpm --filter @app/web test:watch   # Watch mode for web tests

# Build & Production
pnpm build            # Build all packages
pnpm --filter @app/api start        # Run API from dist/
pnpm --filter @app/web preview      # Preview web build
```

## Notes

- Vite dev server proxies `/api` requests to `http://localhost:4000`
- When using **ky**, omit the leading `/` in paths:
    ```ts
    api.get("health").json(); // ✓ correct
    api.get("/health").json(); // ✗ incorrect
    ```
- The web app includes an `ErrorBoundary` using [react-error-boundary](https://github.com/bvaughn/react-error-boundary)
- Pre-commit hooks run ESLint and Prettier via Husky + lint-staged
