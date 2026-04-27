/** UI-only helpers for persisted match records. No scoring or match generation. */

export type MatchLifecycleState =
  | "SUGGESTED"
  | "ACCEPTED"
  | "REJECTED"
  | "EXPIRED";

export function dedupeMatchesById<T extends { id: string }>(matches: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const m of matches) {
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    out.push(m);
  }
  return out;
}

export function dedupeApiMatchesByMatchId<
  T extends { matchId: string; tripRequestId?: string; rideId?: string },
>(items: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const m of items) {
    if (seen.has(m.matchId)) continue;
    seen.add(m.matchId);
    out.push(m);
  }
  return out;
}

/** Keep only rows the API should return as active suggestions; defensive for stale client state. */
export function filterSuggestedApiItems<
  T extends { state?: string; matchId: string },
>(items: T[]): T[] {
  return items.filter((m) => !m.state || m.state === "SUGGESTED");
}

export function partitionPrismaMatches<T extends { id: string; state: string }>(
  matches: T[],
): {
  suggested: T[];
  accepted: T[];
  expired: T[];
} {
  const unique = dedupeMatchesById(matches);
  return {
    suggested: unique.filter((m) => m.state === "SUGGESTED"),
    accepted: unique.filter((m) => m.state === "ACCEPTED"),
    expired: unique.filter((m) => m.state === "EXPIRED"),
  };
}
