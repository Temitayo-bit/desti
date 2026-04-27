"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CarFront,
  Home,
  LayoutDashboard,
  Menu,
  MessagesSquare,
  Route,
  UserRound,
  X,
} from "lucide-react";
import { DestiLogo } from "@/components/DestiLogo";

type ProtectedNavKey =
  | "dashboard"
  | "browse"
  | "browseTripRequests"
  | "bookings"
  | "messages"
  | "profile";

interface ProtectedShellProps {
  activeNav: ProtectedNavKey;
  children: React.ReactNode;
}

const NAV_ITEMS = [
  { key: null, label: "Home", href: "/?home" },
  { key: "dashboard" as const, label: "Dashboard", href: "/dashboard" },
  { key: "browse" as const, label: "Rides", href: "/browse" },
  { key: "browseTripRequests" as const, label: "Requests", href: "/browse-trip-requests" },
  { key: "messages" as const, label: "Messages", href: "/messages" },
];

export function ProtectedShell({ activeNav, children }: ProtectedShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900 flex flex-col">
      {/* ── Top Navbar ── */}
      <header className="sticky top-0 z-30 w-full border-b border-zinc-200 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-8">
          {/* Left — Logo */}
          <Link href="/dashboard" className="shrink-0">
            <DestiLogo size="sm" />
          </Link>

          {/* Center — Desktop nav links */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map((item) => {
              const isActive = activeNav === item.key;
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className={`relative px-4 py-2 text-sm font-semibold transition-colors rounded-lg ${
                    isActive
                      ? "text-emerald-700"
                      : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100/60"
                  }`}
                >
                  {item.label}
                  {isActive && (
                    <span className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-emerald-600" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Right — Profile + Mobile menu toggle */}
          <div className="flex items-center gap-3">
            <Link
              href="/profile"
              className={`flex h-10 w-10 items-center justify-center rounded-full border transition-colors ${
                activeNav === "profile"
                  ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                  : "border-zinc-200 bg-white text-zinc-500 hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-700"
              }`}
              aria-label="Profile"
            >
              <UserRound size={20} strokeWidth={2} />
            </Link>

            {/* Mobile hamburger */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-nav-dropdown"
              className="flex h-10 w-10 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 md:hidden"
            >
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {/* ── Mobile dropdown menu ── */}
        {mobileMenuOpen && (
          <nav
            id="mobile-nav-dropdown"
            className="border-t border-zinc-100 bg-white px-4 pb-4 pt-2 md:hidden"
          >
            <div className="flex flex-col gap-1">
              {NAV_ITEMS.map((item) => {
                const isActive = activeNav === item.key;
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition-colors ${
                      isActive
                        ? "bg-emerald-50 text-emerald-700"
                        : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                    }`}
                  >
                    {item.key === null && <Home size={18} />}
                    {item.key === "dashboard" && <LayoutDashboard size={18} />}
                    {item.key === "browse" && <CarFront size={18} />}
                    {item.key === "browseTripRequests" && <Route size={18} />}
                    {item.key === "messages" && <MessagesSquare size={18} />}
                    {item.label}
                    {isActive && (
                      <span className="ml-auto h-2 w-2 rounded-full bg-emerald-500" />
                    )}
                  </Link>
                );
              })}
            </div>
          </nav>
        )}
      </header>

      {/* ── Main content — full width below top nav ── */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-8 flex flex-col gap-6 md:gap-8 min-w-0 relative">
        {children}
      </main>
    </div>
  );
}
