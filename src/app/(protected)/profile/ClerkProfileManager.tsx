"use client";

import { useClerk } from "@clerk/nextjs";

export function ClerkProfileManager() {
    const { openUserProfile } = useClerk();

    return (
        <>
            <button
                onClick={() => openUserProfile()}
                className="group flex w-full items-center justify-between py-4 transition-colors hover:bg-zinc-50 rounded-lg px-2 -mx-2"
            >
                <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-50 text-zinc-500">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/></svg>
                    </div>
                    <div className="text-left">
                        <p className="text-sm font-semibold text-zinc-900">Phone Number</p>
                        <p className="text-xs text-zinc-500">Manage in Clerk</p>
                    </div>
                </div>
                <div className="text-zinc-400 group-hover:text-zinc-600 group-hover:translate-x-0.5 transition-all">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                </div>
            </button>

            <button
                onClick={() => openUserProfile()}
                className="group flex w-full items-center justify-between py-4 transition-colors hover:bg-zinc-50 rounded-lg px-2 -mx-2"
            >
                <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-50 text-zinc-500">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    </div>
                    <div className="text-left">
                        <p className="text-sm font-semibold text-zinc-900">Change Password</p>
                        <p className="text-xs text-zinc-500">Manage in Clerk</p>
                    </div>
                </div>
                <div className="text-zinc-400 group-hover:text-zinc-600 group-hover:translate-x-0.5 transition-all">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                </div>
            </button>
        </>
    );
}
