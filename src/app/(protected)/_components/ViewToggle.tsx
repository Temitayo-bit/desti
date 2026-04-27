"use client";

import Link from "next/link";

export interface ViewToggleOption<T extends string> {
  href: string;
  label: string;
  value: T;
}

interface ViewToggleProps<T extends string> {
  activeView: T;
  options: ReadonlyArray<ViewToggleOption<T>>;
}

function toggleLinkClass(isActive: boolean): string {
  if (isActive) {
    return [
      "rounded-xl bg-[#006837] px-4 py-2.5 text-sm font-semibold text-white shadow-sm",
      "transition-colors hover:bg-[#0d3d2e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#006837]/40 focus-visible:ring-offset-2",
    ].join(" ");
  }

  return [
    "rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-600",
    "transition-colors hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#006837]/25 focus-visible:ring-offset-2",
  ].join(" ");
}

export function ViewToggle<T extends string>({
  activeView,
  options,
}: ViewToggleProps<T>) {
  return (
    <div className="mb-5 -mx-1 px-1 overflow-x-auto">
      <div
        className="inline-flex min-w-max gap-1 rounded-2xl border border-zinc-200 bg-zinc-50 p-1 shadow-sm"
        role="tablist"
        aria-label="View"
      >
        {options.map((option) => (
          <Link
            key={option.value}
            href={option.href}
            className={toggleLinkClass(activeView === option.value)}
            aria-current={activeView === option.value ? "page" : undefined}
            role="tab"
            aria-selected={activeView === option.value}
          >
            {option.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
