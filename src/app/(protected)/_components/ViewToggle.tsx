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
    return "rounded-xl bg-emerald-800 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors";
  }

  return "rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900";
}

export function ViewToggle<T extends string>({
  activeView,
  options,
}: ViewToggleProps<T>) {
  return (
    <div className="mb-5 -mx-1 px-1 overflow-x-auto">
      <div className="inline-flex min-w-max gap-2 rounded-2xl border border-zinc-200 bg-white p-1 shadow-sm">
        {options.map((option) => (
          <Link
            key={option.value}
            href={option.href}
            className={toggleLinkClass(activeView === option.value)}
          >
            {option.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
