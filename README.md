# Dungeon Crawler

A server-authoritative, turn-based dungeon crawler. Explore procedurally generated floors, fight monsters, and level up your hero — all driven by a deterministic shared game engine.

## Documentation

- [Architecture](docs/ARCHITECTURE.md) — system design, authority model, persistence, socket protocol
- [PRD](docs/PRD.md) — product vision, current features, and planned work

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
