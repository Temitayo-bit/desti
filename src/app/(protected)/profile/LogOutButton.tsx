"use client";

import { useClerk } from "@clerk/nextjs";

export function LogOutButton() {
    const { signOut } = useClerk();

    return (
        <button
            type="button"
            onClick={() => void signOut({ redirectUrl: "/" })}
            className="flex w-full items-center justify-center gap-3 rounded-xl px-4 py-4 text-base font-semibold text-red-600 transition-colors hover:bg-red-50"
        >
            <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path d="m16 17 5-5-5-5" />
                <path d="M21 12H9" />
                <path d="M13 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8" />
            </svg>
            Log Out
        </button>
    );
}
