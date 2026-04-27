"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { SignOutButton } from "@clerk/nextjs";
import { UserAvatar } from "@/components/UserAvatar";
import { useDestiProfile } from "@/hooks/use-desti-profile";

/**
 * Replaces Clerk UserButton: shows Desti DB profile image (or initials / default icon) and
 * account actions. Clerk remains the auth provider; only the avatar source is from Desti.
 */
export function DestiNavProfileMenu() {
  const { profilePictureUrl, displayName } = useDestiProfile();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        close();
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-8 w-8 items-center justify-center rounded-full ring-1 ring-zinc-200/80 transition hover:ring-zinc-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
        aria-label="Account menu"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <UserAvatar
          src={profilePictureUrl}
          name={displayName}
          size="sm"
          className="h-8 w-8"
        />
      </button>

      {open ? (
        <div
          className="absolute right-0 z-50 mt-1.5 min-w-[11rem] rounded-xl border border-zinc-200 bg-white py-1 shadow-lg"
          role="menu"
        >
          <Link
            href="/profile"
            className="block px-3 py-2 text-sm text-zinc-800 hover:bg-zinc-50"
            role="menuitem"
            onClick={close}
          >
            Profile
          </Link>
          <div className="border-t border-zinc-100 px-3 py-2">
            <SignOutButton redirectUrl="/">
              <button
                type="button"
                className="w-full rounded-lg text-left text-sm text-zinc-800 hover:text-zinc-950"
                role="menuitem"
              >
                Sign out
              </button>
            </SignOutButton>
          </div>
        </div>
      ) : null}
    </div>
  );
}
