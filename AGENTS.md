# AGENTS.md

## Cursor Cloud specific instructions

### Overview

Desti is a single Next.js 16 application (not a monorepo) — a campus ride-sharing platform for Stetson University students. All backend logic lives in Next.js API route handlers under `src/app/api/`. See `README.md` for full tech-stack details.

### Prerequisites

- **Node.js 20.x** (the Dockerfile targets `node:20-bookworm-slim`)
- **PostgreSQL 16** running locally on port 5432
- A `.env` file at the root (copy from `.env.example`); at minimum set `DATABASE_URL`

### Quick reference

| Action | Command |
|---|---|
| Install deps | `npm install` (runs `prisma generate` via postinstall) |
| Run migrations | `npx prisma migrate deploy` |
| Dev server | `npm run dev` (port 3000) |
| Lint | `npm run lint` |
| Tests | `npm run test` (vitest, no DB or external services needed — tests mock deps) |
| Build | `npm run build` |

### Gotchas

- **Clerk keys required at runtime**: Every HTTP request goes through Clerk middleware. Without valid `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`, the dev server returns 500 on all routes. Tests do not require Clerk keys (they mock auth).
- **`npm install` requires `DATABASE_URL`**: The postinstall hook runs `prisma generate`, which loads `prisma.config.ts` and reads `DATABASE_URL` from the environment. Ensure `.env` exists with a valid `DATABASE_URL` before running `npm install`, or the install will fail.
- **PostgreSQL setup**: The local database must have a `desti` database created (`CREATE DATABASE desti;`) with the postgres user password set to `postgres` (or whatever matches your `DATABASE_URL`). Run `npx prisma migrate deploy` after install.
- **ESLint has pre-existing `no-explicit-any` and `no-unused-vars` warnings/errors** in several files. These are in the existing codebase and are not blockers.
- **Gemini API key is optional** — only needed for the AI chat widget (`POST /api/chat`). Core functionality works without it (endpoint returns 503 gracefully).
