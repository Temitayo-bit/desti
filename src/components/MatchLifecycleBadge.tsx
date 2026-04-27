import type { MatchLifecycleState } from "@/lib/match-lifecycle-partition";

const BADGE: Record<
  MatchLifecycleState,
  { label: string; className: string }
> = {
  SUGGESTED: {
    label: "Suggested",
    className:
      "bg-sky-100 text-sky-900 ring-1 ring-sky-200/80",
  },
  ACCEPTED: {
    label: "Accepted",
    className:
      "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-200/80",
  },
  REJECTED: {
    label: "Rejected",
    className:
      "bg-zinc-200 text-zinc-700 ring-1 ring-zinc-300/80",
  },
  EXPIRED: {
    label: "Expired",
    className:
      "bg-amber-100 text-amber-900 ring-1 ring-amber-200/80",
  },
};

export function MatchLifecycleBadge({
  state,
  className = "",
}: {
  state: string;
  className?: string;
}) {
  const key = state as MatchLifecycleState;
  const cfg = BADGE[key];
  if (!cfg) {
    return (
      <span
        className={`inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-700 ring-1 ring-zinc-200/80 ${className}`}
      >
        {state}
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${cfg.className} ${className}`}
    >
      {cfg.label}
    </span>
  );
}
