"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

type ProtectedNavKey = "dashboard" | "browse" | "myRides" | "postRide" | "postTripRequest" | "myTripRequests" | "messages" | "profile";

interface ProtectedShellProps {
  activeNav: ProtectedNavKey;
  children: React.ReactNode;
}

function navLinkClass(isActive: boolean): string {
  if (isActive) {
    return "flex items-center gap-3 px-4 py-3 bg-emerald-50 text-emerald-700 rounded-xl font-medium transition-colors";
  }

  return "flex items-center gap-3 px-4 py-3 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100/80 rounded-xl font-medium transition-colors";
}

function placeholderNavLinkClass(): string {
  return "flex items-center gap-3 px-4 py-3 text-zinc-500 bg-zinc-50 rounded-xl font-medium transition-colors pointer-events-none opacity-70";
}

export function ProtectedShell({ activeNav, children }: ProtectedShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900 flex flex-col md:flex-row">
      <div className="md:hidden flex items-center justify-between p-4 bg-white border-b border-zinc-200 sticky top-0 z-20">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-emerald-700 text-white rounded-md flex items-center justify-center font-bold text-lg">
            D
          </div>
          <span className="font-bold text-xl">Desti</span>
        </div>
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
          <div className="hidden md:flex items-center gap-3 mb-10">
            <div className="w-10 h-10 bg-emerald-700 text-white rounded-lg flex items-center justify-center font-bold text-xl shadow-sm">
              D
            </div>
            <span className="font-bold text-2xl tracking-tight">Desti</span>
          </div>

          <nav className="flex-1 space-y-2">
            <Link
              href="/"
              className={navLinkClass(activeNav === "dashboard")}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="18" x="3" y="3" rx="2" />
                <path d="M3 9h18" />
                <path d="M9 21V9" />
              </svg>
              Dashboard
            </Link>
            <Link href="/browse" className={navLinkClass(activeNav === "browse")}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              Browse Rides
            </Link>
            <div className={placeholderNavLinkClass()} tabIndex={-1} aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3v18" />
                <path d="M3 12h18" />
              </svg>
              My Rides
            </div>
            <Link href="/post-ride" className={navLinkClass(activeNav === "postRide")}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="16" />
                <line x1="8" y1="12" x2="16" y2="12" />
              </svg>
              Post Rides
            </Link>
            <div className={placeholderNavLinkClass()} tabIndex={-1} aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
              Post TripRequest
            </div>
            <div className={placeholderNavLinkClass()} tabIndex={-1} aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 2v4" />
                <path d="M16 2v4" />
                <rect width="18" height="18" x="3" y="4" rx="2" />
                <path d="M3 10h18" />
                <path d="M8 14h8" />
              </svg>
              My TripRequests
            </div>
            <div className={placeholderNavLinkClass()} tabIndex={-1} aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              Messages
            </div>
            <div className={placeholderNavLinkClass()} tabIndex={-1} aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              Profile
            </div>
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
