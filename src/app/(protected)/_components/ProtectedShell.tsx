"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CalendarCheck,
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

function navLinkClass(isActive: boolean): string {
  if (isActive) {
    return "flex items-center gap-3 px-3 py-3 bg-emerald-50 text-emerald-700 rounded-2xl font-medium transition-colors";
  }

  return "flex items-center gap-3 px-3 py-3 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100/80 rounded-2xl font-medium transition-colors";
}

function navIconWrapClass(isActive: boolean): string {
  if (isActive) {
    return "flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700";
  }

  return "flex h-10 w-10 items-center justify-center rounded-xl bg-white text-zinc-500 ring-1 ring-zinc-200 transition-colors group-hover:bg-zinc-50 group-hover:text-zinc-700";
}

export function ProtectedShell({ activeNav, children }: ProtectedShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900 flex flex-col md:flex-row">
      <div className="md:hidden flex items-center justify-between p-4 bg-white border-b border-zinc-200 sticky top-0 z-20">
        <Link href="/dashboard" className="shrink-0">
          <DestiLogo size="sm" />
        </Link>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label={mobileMenuOpen ? "Close mobile menu" : "Open mobile menu"}
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-navigation-menu"
          className="p-2 -mr-2 text-zinc-600 hover:text-zinc-900"
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      <div
        id="mobile-navigation-menu"
        className={`
          fixed inset-y-0 left-0 z-30 w-64 bg-white border-r border-zinc-200 transform transition-transform duration-300 ease-in-out
          md:relative md:translate-x-0
          ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <div className="p-6 h-full flex flex-col">
          <Link href="/dashboard" className="mb-10 hidden md:flex w-fit">
            <DestiLogo size="md" />
          </Link>

          <nav className="flex-1 space-y-2">
            <Link
              href="/?home"
              className={`${navLinkClass(false)} group`}
            >
              <span className={navIconWrapClass(false)}>
                <Home size={20} strokeWidth={2.1} />
              </span>
              Home
            </Link>
            <Link
              href="/dashboard"
              className={`${navLinkClass(activeNav === "dashboard")} group`}
            >
              <span className={navIconWrapClass(activeNav === "dashboard")}>
                <LayoutDashboard size={20} strokeWidth={2.1} />
              </span>
              Dashboard
            </Link>
            <Link
              href="/browse"
              className={`${navLinkClass(activeNav === "browse")} group`}
            >
              <span className={navIconWrapClass(activeNav === "browse")}>
                <CarFront size={20} strokeWidth={2.1} />
              </span>
              Rides
            </Link>
            <Link
              href="/browse-trip-requests"
              className={`${navLinkClass(activeNav === "browseTripRequests")} group`}
            >
              <span className={navIconWrapClass(activeNav === "browseTripRequests")}>
                <Route size={20} strokeWidth={2.1} />
              </span>
              Trip Requests
            </Link>
            <Link
              href="/bookings"
              className={`${navLinkClass(activeNav === "bookings")} group`}
            >
              <span className={navIconWrapClass(activeNav === "bookings")}>
                <CalendarCheck size={20} strokeWidth={2.1} />
              </span>
              My Trips
            </Link>
            <Link
              href="/messages"
              className={`${navLinkClass(activeNav === "messages")} group`}
            >
              <span className={navIconWrapClass(activeNav === "messages")}>
                <MessagesSquare size={20} strokeWidth={2.1} />
              </span>
              Messages
            </Link>
            <Link
              href="/profile"
              className={`${navLinkClass(activeNav === "profile")} group`}
            >
              <span className={navIconWrapClass(activeNav === "profile")}>
                <UserRound size={20} strokeWidth={2.1} />
              </span>
              Profile
            </Link>
          </nav>

          <div className="mt-8 pt-6 border-t border-zinc-100">
            <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium w-fit">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none" className="text-blue-600">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              Stetson Verified
            </div>
          </div>
        </div>
      </div>

      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-20 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <main className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-8 flex flex-col gap-6 md:gap-8 min-w-0 relative">
        {children}
      </main>
    </div>
  );
}
