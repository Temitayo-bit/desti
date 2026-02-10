"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { SignOutButton, SignedIn, SignedOut } from "@clerk/nextjs";
import {
    getRestrictionCopy,
    type RestrictionReason,
} from "@/lib/frontend-auth";

export default function AccessRestrictedPage() {
    const searchParams = useSearchParams();
    const rawReason = searchParams.get("reason");
    const isKnownReason =
        rawReason === "missing_email" ||
        rawReason === "email_not_verified" ||
        rawReason === "non_stetson_domain";
    const reason: RestrictionReason = isKnownReason ? rawReason : "missing_email";
    const reasonCopy = getRestrictionCopy(reason);

    return (
        <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 px-6 py-20">
            <section className="rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
                <h1 className="text-3xl font-semibold text-zinc-900">
                    Access Restricted
                </h1>
                <p className="mt-4 text-sm leading-6 text-zinc-600">
                    This app requires a verified <strong>@stetson.edu</strong>{" "}
                    email address.
                </p>
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                    {reasonCopy}
                </p>

                <div className="mt-6 flex flex-wrap gap-3">
                    <SignedIn>
                        <SignOutButton redirectUrl="/sign-in">
                            <button
                                type="button"
                                className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-100"
                            >
                                Sign out
                            </button>
                        </SignOutButton>
                    </SignedIn>

                    <SignedOut>
                        <Link
                            href="/sign-in"
                            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-100"
                        >
                            Sign in
                        </Link>
                    </SignedOut>

                    <Link
                        href="/sign-in"
                        className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-100"
                    >
                        Switch account
                    </Link>
                    <Link
                        href="/user-profile"
                        className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-100"
                    >
                        Verify email
                    </Link>
                </div>
            </section>
        </main>
    );
}
