# Browsing API Contract (MVP 1)

**Status:** DRAFT  
**Author:** Claude Opus 4.6 (Senior SWE I)  
**Date:** 2026-02-13  
**Target:** `GET /api/rides` and `GET /api/trip-requests`

This document defines the strict implementation blueprint for the browsing endpoints. It covers query validation, cursor-based pagination, deterministic sorting, and Prisma query construction.

---

## 1. Query Parameter Specification

All query parameters are optional strings. The handler must parse and validate them strictly. Invalid parameters (e.g., malformed dates, negative limits) must return **400 Bad Request**.

### Common Parameters (Both Endpoints)

| Parameter | Type | Default | Validated As |
|---|---|---|---|
| `limit` | int | `20` | Integer 1–50. |
| `cursor` | string | `undefined` | Base64 JSON (id + timestamp). |
| `distanceCategory` | enum | `undefined` | `SHORT`, `MEDIUM`, or `LONG`. |

#### Validation Detail

- **limit**: Strict integer parse. Min 1, max 50. Defaults to 20 if missing. Invalid or out-of-range -> **400**.
- **cursor**: base64-encoded string decoding to `{ id: string, timestamp: string (ISO) }`. Malformed/invalid json -> **400**.
- **distanceCategory**: Must match `DistanceCategory` enum exactly. Invalid -> **400**.

### Rides-Specific Parameters (`GET /api/rides`)

| Parameter | Type | Validation Rules |
|---|---|---|
| `includeFull` | boolean | `false` (default). If `false`, filter excludes rides where `seatsAvailable < 1`. If `true`, returns all rides regardless of availability. |
| `earliestAfter` | ISO Date | Filter rides where `earliestDepartAt >= value`. Defaults to `NOW()` if missing. Invalid date -> 400. |
| `latestBefore` | ISO Date | Filter rides where `latestDepartAt <= value`. Invalid date -> 400. |
| `seatsMin` | int | Filter rides where `seatsAvailable >= value`. Min 1. Invalid -> 400. |

### Trip Requests-Specific Parameters (`GET /api/trip-requests`)

| Parameter | Type | Validation Rules |
|---|---|---|
| `earliestAfter` | ISO Date | Filter requests where `earliestDesiredAt >= value`. Invalid date -> 400. |
| `latestBefore` | ISO Date | Filter requests where `latestDesiredAt <= value`. Invalid date -> 400. |
| `seatsMax` | int | Filter requests where `seatsNeeded <= value`. Min 1. Invalid -> 400. |

---

## 2. Cursor Contract

We use **Keyset Pagination** (Cursor-based) for O(1) database performance. Offset pagination (`skip: N`) is **strictly forbidden**.

### Encoding

The cursor is a Base64-encoded JSON string containing the last record's sort values.
Format: `base64(JSON.stringify({ id: "uuid", timestamp: "value" }))`

#### Rides Cursor

```json
{
  "id": "ride-uuid-123",
  "timestamp": "2026-03-15T10:00:00.000Z"
}
```

#### Trip Requests Cursor

```json
{
  "id": "trip-req-uuid-456",
  "timestamp": "2026-03-15T10:00:00.000Z"
}
```

### Deterministic Sorting

To ensure stable pagination, we sort by the primary timestamp (ASC) and break ties with the ID (ASC).

**Rides Sort:**

1. `earliestDepartAt` ASC (primary)
2. `id` ASC (secondary, unique tie-breaker)

**Trip Requests Sort:**

1. `earliestDesiredAt` ASC (primary)
2. `id` ASC (secondary, unique tie-breaker)

---

## 3. Prisma Query Shape

The handler must construct the Prisma query carefully to apply the cursor predicate directly in the `where` clause (or use Prisma's `cursor` API if it supports multi-field robustly, but strict equivalent logic is preferred for clarity).

### Base Filters (AND logic)

All conditions are combined with `AND`.

**Rides Example:**

```typescript
const where: Prisma.RideWhereInput = {
  status: "ACTIVE", // ALWAYS applied
  // earliestDepartAt: { gt: new Date() }, // Applied by default if `earliestAfter` is missing
  // ... other filters map directly
};

if (distanceCategory) where.distanceCategory = distanceCategory;
if (seatsMin) where.seatsAvailable = { gte: seatsMin };
// etc.
```

### Applying the Cursor (The "Strictly After" Predicate)

If a cursor is provided, decode it to get `cursorId` and `cursorTimestamp`. The query must fetch records **strictly after** this point in the sort order.

**Logic:**

```sql
WHERE ... AND (
  (earliestDepartAt > cursorTimestamp)
  OR
  (earliestDepartAt = cursorTimestamp AND id > cursorId)
)
```

**Prisma Implementation:**

```typescript
if (decodedCursor) {
  where.OR = [
    { earliestDepartAt: { gt: decodedCursor.timestamp } },
    {
      earliestDepartAt: decodedCursor.timestamp,
      id: { gt: decodedCursor.id }
    }
  ];
}
```

This approach ensures no skipped records and handles duplicate timestamps correctly.

### Fetching

```typescript
const rides = await prisma.ride.findMany({
  where,
  take: limit + 1, // Fetch one extra to determine if there's a next page
  orderBy: [
    { earliestDepartAt: "asc" },
    { id: "asc" }
  ],
  // include: { driver: true } // Potentially need driver info? Protocol doesn't specify default includes.
});
```

### Pagination Response Construction

1. Check if `rides.length > limit`.
2. If yes:
   - `hasNextPage = true`
   - Pop the last item (do not return it).
   - `nextCursor` = encode start values of the *new* last item (the `limit`-th item).
3. If no:
   - `hasNextPage = false`
   - `nextCursor = null`

---

## 4. Response Format

```json
{
  "data": [ ... array of Ride or TripRequest objects ... ],
  "meta": {
    "nextCursor": "ey..." // or null
  }
}
```

---

## 5. Indexing Recommendations

For optimal performance, the database should have composite indexes matching the sort order and common filters.

**Rides Table:**

- `@@index([earliestDepartAt, id])` (Essential for cursor sort)
- `@@index([status, earliestDepartAt])` (Common active check)
- `@@index([distanceCategory, earliestDepartAt])` (If filtering by category)

**Trip Requests Table:**

- `@@index([earliestDesiredAt, id])`
- `@@index([status, earliestDesiredAt])`

*(Note: Add these to `schema.prisma` in a future migration if performance requires it. For MVP 1, standard PK and existing indexes may suffice for small datasets, but the compound index is recommended.)*

---

## 6. Testing Blueprint

The implementation must include **extensive integration tests** covering:

1. **Basic Listing:**
   - Fetch page 1 (limit 20), verify sorted by date ASC.
2. **Pagination Cycle:**
   - Create 5 records.
   - Fetch limit 2.
   - Use returned cursor to fetch next 2.
   - Use returned cursor to fetch last 1.
   - Verify all IDs and order match simple fetch-all.
3. **Filtering:**
   - Create records with mixed `distanceCategory`. Filter by one, ensure strict subset returned.
   - Filter by `seatsMin` / `includeFull`.
4. **Validation Errors:**
   - `limit=0` -> 400.
   - `limit=100` -> 400 (or clamped).
   - `cursor=invalidbase64` -> 400.
   - `earliestAfter=notadate` -> 400.
5. **Empty State:**
   - Fetch with valid filters matching nothing -> `data: [], meta: { nextCursor: null }`.
6. **Concurrent Safety (Mocked):**
   - Ensure the query logic handles "records inserted between pages" gracefully (Keyset pagination handles this naturally).

---
