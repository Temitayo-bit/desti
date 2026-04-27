"use client";

import { useState } from "react";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import {
  CarFront,
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
  | "messages"
  | "profile";

type TopNavKey = "browse" | "postRide" | "requests" | "messages" | "profile";

interface ProtectedShellProps {
  activeNav: ProtectedNavKey;
  children: React.ReactNode;
  /** Default: sidebar. Use `topnav` for the home dashboard to match the marketing-style top bar. */
  layout?: "sidebar" | "topnav";
  /** Active item when `layout` is `topnav` (e.g. highlight Profile). */
  topNavActive?: TopNavKey | null;
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

function topNavLinkClass(isActive: boolean): string {
  if (isActive) {
    return "text-sm font-medium text-[#0d3d2e] border-b-2 border-[#0d3d2e] pb-0.5 -mb-0.5";
  }
  return "text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors";
}

export function ProtectedShell({
  activeNav,
  children,
  layout = "sidebar",
  topNavActive = null,
}: ProtectedShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (layout === "topnav") {
    return (
      <div className="min-h-screen flex flex-col bg-zinc-100 font-sans text-zinc-900">
        <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/95 backdrop-blur-sm">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 md:px-6">
            <Link href="/dashboard" className="shrink-0 text-lg font-extrabold tracking-tight text-[#0d3d2e]">
              Destination
            </Link>
            <nav className="hidden flex-1 items-center justify-center gap-5 lg:gap-8 md:flex" aria-label="Main">
              <Link className={topNavLinkClass(topNavActive === "browse")} href="/browse">
                Browse Rides
              </Link>
              <Link className={topNavLinkClass(topNavActive === "postRide")} href="/post-ride">
                Post Ride
              </Link>
              <Link
                className={topNavLinkClass(topNavActive === "requests")}
                href="/browse-trip-requests"
              >
                Requests
              </Link>
              <Link className={topNavLinkClass(topNavActive === "messages")} href="/messages">
                Messages
              </Link>
              <Link className={topNavLinkClass(topNavActive === "profile")} href="/profile">
                Profile
              </Link>
            </nav>
            <div className="flex items-center gap-2 md:gap-3">
              <div className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-[#0d3d2e]/20 bg-white px-2.5 py-1.5 text-xs font-semibold text-[#0d3d2e]">
                <span className="text-[#0d3d2e]">&#10003;</span>
                STETSON VERIFIED
              </div>
              <div className="h-8 w-8 shrink-0">
                <UserButton />
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen((o) => !o)}
                aria-label="Menu"
                className="p-2 text-zinc-600 md:hidden"
              >
                {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
              </button>
            </div>
          </div>
          {mobileMenuOpen ? (
            <div className="border-t border-zinc-200 px-4 py-3 md:hidden">
              <div className="mb-2 flex sm:hidden">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#0d3d2e]/20 bg-white px-2.5 py-1.5 text-xs font-semibold text-[#0d3d2e]">
                  <span className="text-[#0d3d2e]">&#10003;</span>
                  STETSON VERIFIED
                </span>
              </div>
              <div className="flex flex-col gap-2">
                <Link className="py-1 text-sm font-medium" href="/browse" onClick={() => setMobileMenuOpen(false)}>
                  Browse Rides
                </Link>
                <Link
                  className="py-1 text-sm font-medium"
                  href="/post-ride"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Post Ride
                </Link>
                <Link
                  className="py-1 text-sm font-medium"
                  href="/browse-trip-requests"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Requests
                </Link>
                <Link className="py-1 text-sm font-medium" href="/messages" onClick={() => setMobileMenuOpen(false)}>
                  Messages
                </Link>
                <Link className="py-1 text-sm font-medium" href="/profile" onClick={() => setMobileMenuOpen(false)}>
                  Profile
                </Link>
              </div>
            </div>
          ) : null}
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-6 md:py-8 min-w-0">
          {children}
        </main>
      </div>
    );
  }

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
