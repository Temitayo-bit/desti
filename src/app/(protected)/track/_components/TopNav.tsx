"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DestiLogo } from "@/components/DestiLogo";
import { Settings, UserCircle2 } from "lucide-react";

export function TopNav() {
    const pathname = usePathname();

    const navItems = [
        { label: "Home", href: "/dashboard" },
        { label: "Rides", href: "/browse" },
        { label: "Requests", href: "/browse-trip-requests" },
        { label: "Messages", href: "/messages" },
    ];

    return (
        <header className="sticky top-0 z-50 flex h-16 w-full items-center justify-between border-b border-zinc-200 bg-white px-4 md:px-8">
            <div className="flex w-1/3 items-center justify-start">
                <Link href="/dashboard" className="shrink-0">
                    <DestiLogo size="md" />
                </Link>
            </div>

            <nav className="hidden w-1/3 justify-center gap-6 md:flex">
                {navItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex h-full items-center border-b-2 px-1 text-sm font-semibold transition-colors ${
                                isActive
                                    ? "border-emerald-600 text-emerald-700"
                                    : "border-transparent text-zinc-500 hover:text-zinc-900"
                            }`}
                        >
                            {item.label}
                        </Link>
                    );
                })}
            </nav>

            <div className="flex w-1/3 items-center justify-end gap-4 text-zinc-500">
                <button
                    type="button"
                    className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-zinc-100 hover:text-zinc-900"
                    aria-label="Settings"
                >
                    <Settings size={20} />
                </button>
                <Link
                    href="/profile"
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-dashed border-zinc-400 hover:bg-zinc-100 hover:text-zinc-900"
                    aria-label="Profile"
                >
                    <UserCircle2 size={24} />
                </Link>
            </div>
        </header>
    );
}
