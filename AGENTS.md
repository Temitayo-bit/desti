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

## Continuous Learning & Code Review Rules

This section is used to persist **high-signal, reusable engineering rules** discovered during:
- CodeRabbit reviews
- debugging
- implementation edge cases

### What MUST be stored

Only persist rules that:

- prevent bugs from reoccurring
- enforce correctness or invariants
- improve reliability or consistency
- apply across multiple features (not one-off fixes)

Examples:
- validation rules
- race condition protections
- API consistency rules
- data integrity constraints
- performance safeguards

---

### What MUST NOT be stored

DO NOT store:

- one-off bug fixes
- temporary hacks
- feature-specific logic
- opinions or vague suggestions
- anything not broadly reusable

---

### Rule format (STRICT)

Each entry MUST follow this format:

- **Rule**: clear, one-line statement
- **Context**: where/why it applies
- **Enforcement**: how it should be implemented or checked

Example:

- Rule: All write operations must fail if required external data resolution fails
  Context: Prevents partial writes during geocoding or external API dependency failures
  Enforcement: Validate external responses before DB writes; never write fallback values

---

### When to update this section

After CodeRabbit review:

- Identify only high-value, reusable insights
- Convert them into structured rules
- Add them to this section

DO NOT blindly copy CodeRabbit output.

---

### Constraints

- Keep this section concise
- Avoid duplicates
- Prefer updating an existing rule over adding a new one
- Maximum clarity > maximum coverage

### Recorded Rules

- Rule: Normalize mixed-unit scoring inputs before applying weights
  Context: Backend ranking often combines distance and time; unnormalized units can silently skew quality and ranking behavior.
  Enforcement: Convert each metric to a bounded normalized value (for example, metric/threshold clamped to `[0,1]`) before computing weighted scores.

- Rule: Tests for capped result sets must derive expectations from the same exported limit constants used in production logic
  Context: Hardcoded expected IDs/counts become brittle when backend caps are tuned for quality or demo behavior.
  Enforcement: Build expected result lists programmatically from exported constants (for example, `MAX_MATCH_RESULTS`) rather than hardcoded lengths or identifiers.

## Backend Architecture Rules (MVP 2)

### 1) Location Core (CRITICAL)

- Geocoding is implemented using **OSM / Nominatim**, not Mapbox.
- This is a class demo decision to allow storing coordinates without paid APIs.
- All `Ride` and `TripRequest` records must store:
  - `originText`
  - `originResolvedAddress`
  - `originLatitude`
  - `originLongitude`
  - `destinationText`
  - `destinationResolvedAddress`
  - `destinationLatitude`
  - `destinationLongitude`
- Geocoding runs only on create and on update when location fields change.
- Geocoding behavior must be:
  - Nominatim search endpoint
  - US-only results (`countrycodes=us`)
  - top result only (`limit=1`)
  - no autocomplete
  - no multi-result selection
- Requests to Nominatim must include:
  - a proper `User-Agent`
  - optional contact email if configured
- If geocoding fails, the request must fail with no partial writes.
- Do not:
  - store only raw text without coordinates
  - call geocoding during read flows
  - add caching layers
  - introduce background jobs

### 2) Location Data Modeling Rules

- Store location fields directly on `Ride` and `TripRequest`.
- Do not create a separate `Location` table.
- Do not introduce route geometry or waypoints.
- Keep schema flat and simple.

### 3) External API Usage Rules

- Public Nominatim is used for demo purposes only.
- Keep request volume low:
  - no per-keystroke calls
  - no batch processing
  - no retry loops
- All external API calls must:
  - be wrapped in a shared service
  - be mockable in tests

### 4) Backend Scope Enforcement

Agents must not implement the following unless explicitly instructed:

- proximity filtering
- match suggestion engine
- route overlap logic
- map rendering
- frontend changes
- realtime location tracking
- background workers / queues

### 5) Invariants (MUST NOT BREAK)

Reinforce existing invariants:

- no overselling seats
- no self-booking
- editing blocked after confirmed booking
- cancellation only before ride window starts
- accepting an `Offer` must be atomic
- onboarding gate must remain enforced
- no `Ride` or `TripRequest` can exist without valid coordinates

### 6) Implementation Discipline

All future agents must:

- work backend only
- use REST APIs only
- avoid scope creep
- keep implementations minimal and focused
- follow existing patterns in the codebase
- open a PR and stop (no direct merges)
- update `code_explanation` with:
  - files changed
  - what changed
  - why
