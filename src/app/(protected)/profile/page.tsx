import { SignOutButton } from "@clerk/nextjs";
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { ProtectedShell } from "../_components/ProtectedShell";
import { prisma } from "@/lib/prisma";
import { UserAvatar } from "@/components/UserAvatar";
import { EditProfileButton } from "./EditProfileButton";
import { ClerkProfileManager } from "./ClerkProfileManager";

export const metadata = {
    title: "Profile | Desti",
    description: "Manage your Desti profile and account settings.",
};

function formatYearLabel(yearAtStetson: string | null): string {
    if (yearAtStetson === "FRESHMAN") return "Freshman (2025)";
    if (yearAtStetson === "SOPHOMORE") return "Sophomore (2025)";
    if (yearAtStetson === "JUNIOR") return "Junior (2025)";
    if (yearAtStetson === "SENIOR") return "Senior (2025)";
    return "Stetson student";
}

function formatGenderLabel(gender: string | null): string {
    if (gender === "MALE") return "Male";
    if (gender === "FEMALE") return "Female";
    if (gender === "OTHER") return "Other";
    if (gender === "PREFER_NOT_TO_SAY") return "Prefer not to say";
    return "Not provided";
}

export default async function ProfilePage() {
    const user = await currentUser();

    if (!user) {
        redirect("/sign-in");
    }

    const localUser = await prisma.user.findUnique({
        where: { clerkUserId: user.id },
    });

    if (!localUser?.onboardingComplete) {
        redirect("/onboarding");
    }

    const displayName = localUser.name?.trim() || "Stetson student";
    const yearLabel = formatYearLabel(localUser.yearAtStetson);
    const profileEmail = localUser.email;
    const bio = localUser.bio?.trim() || null;

    // Stats — count completed bookings only
    // ridesGiven: bookings on rides this user drove, via the ride relation
    const ridesGiven = await prisma.booking.count({
        where: {
            status: "COMPLETED",
            ride: { driverUserId: user.id },
        },
    });
    const ridesTaken = await prisma.booking.count({
        where: { riderUserId: user.id, status: "COMPLETED" },
    });
    const ratingsResult = await prisma.rating.aggregate({
        _avg: { score: true },
        _count: { id: true },
        where: { rateeUserId: user.id },
    });
    const ratingCount = ratingsResult._count.id;
    const ratingAvg = ratingsResult._avg.score
        ? Number(ratingsResult._avg.score.toFixed(1))
        : 0;

    return (
        <ProtectedShell
            activeNav="profile"
            layout="topnav"
            topNavActive="profile"
        >
            <div className="grid gap-5 lg:grid-cols-[300px_1fr] lg:items-start">

                {/* ── Left column ─────────────────────────────────────── */}
                <div className="space-y-5">

                    {/* Profile header card */}
                    <article className="relative rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-zinc-900/[0.04]">
                        <EditProfileButton user={localUser} />

                        {/* Avatar with verification badge */}
                        <div className="relative mx-auto h-28 w-28">
                            <div className="h-28 w-28 overflow-hidden rounded-full border-4 border-[#0d3d2e]">
                                <UserAvatar
                                    src={localUser.profilePictureUrl}
                                    name={localUser.name}
                                    size="xl"
                                />
                            </div>
                            <span className="absolute bottom-1 right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-[#0d3d2e]">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12" />
                                </svg>
                            </span>
                        </div>

                        <h1 className="mt-4 text-xl font-bold tracking-tight text-zinc-900">
                            {displayName}
                        </h1>

                        {bio && (
                            <p className="mt-1.5 text-sm italic text-zinc-500">
                                &ldquo;{bio}&rdquo;
                            </p>
                        )}

                        <div className="mt-3 flex justify-center">
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-[0.65rem] font-bold tracking-wider text-emerald-800 uppercase">
                                Stetson Verified Student
                            </span>
                        </div>

                        {/* Info grid */}
                        <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 border-t border-zinc-100 pt-5 text-left">
                            <div>
                                <p className="text-[0.6rem] font-bold uppercase tracking-widest text-zinc-400">Year</p>
                                <p className="mt-0.5 text-sm font-semibold text-zinc-900">{yearLabel}</p>
                            </div>
                            <div>
                                <p className="text-[0.6rem] font-bold uppercase tracking-widest text-zinc-400">Gender</p>
                                <p className="mt-0.5 text-sm font-semibold text-zinc-900">{formatGenderLabel(localUser.gender)}</p>
                            </div>
                            <div>
                                <p className="text-[0.6rem] font-bold uppercase tracking-widest text-zinc-400">Age</p>
                                <p className="mt-0.5 text-sm font-semibold text-zinc-900">
                                    {localUser.age ? `${localUser.age} years` : "—"}
                                </p>
                            </div>
                        </div>
                    </article>

                    {/* Experience card */}
                    <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-900/[0.04]">
                        <h2 className="text-base font-bold text-zinc-900">Experience</h2>
                        <div className="mt-3 grid grid-cols-2 gap-3">
                            <div className="rounded-xl bg-zinc-50 p-4 text-center ring-1 ring-zinc-900/[0.04]">
                                <p className="text-3xl font-extrabold tabular-nums text-zinc-900">{ridesGiven}</p>
                                <p className="mt-0.5 text-[0.6rem] font-bold uppercase tracking-widest text-zinc-400">Rides Given</p>
                            </div>
                            <div className="rounded-xl bg-zinc-50 p-4 text-center ring-1 ring-zinc-900/[0.04]">
                                <p className="text-3xl font-extrabold tabular-nums text-zinc-900">{ridesTaken}</p>
                                <p className="mt-0.5 text-[0.6rem] font-bold uppercase tracking-widest text-zinc-400">Rides Taken</p>
                            </div>
                        </div>
                        <div className="mt-3 flex items-center gap-2">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="#0d3d2e" className="shrink-0">
                                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                            </svg>
                            <p className="text-sm text-zinc-600">
                                <span className="font-bold text-zinc-900">{ratingAvg > 0 ? ratingAvg : "—"} Star Rating</span>
                                {ratingCount > 0 ? ` (${ratingCount} reviews)` : " (no reviews yet)"}
                            </p>
                        </div>
                    </article>

                </div>

                {/* ── Right column ────────────────────────────────────── */}
                <div className="space-y-5">

                    {/* Frequent Routes */}
                    <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-900/[0.04]">
                        <div className="flex items-center justify-between">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-100 text-red-600">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                                    <path d="M3 3v5h5"/>
                                </svg>
                            </div>
                            <span className="text-[0.6rem] font-bold uppercase tracking-widest text-zinc-400">Favorites</span>
                        </div>
                        <h3 className="mt-3 text-base font-bold text-zinc-900">Frequent Routes</h3>
                        <ul className="mt-3 space-y-2">
                            <li className="flex items-center gap-2 text-sm text-zinc-700">
                                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-600" />
                                Stetson &rarr; MCO Airport
                            </li>
                            <li className="flex items-center gap-2 text-sm text-zinc-700">
                                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-600" />
                                DeLand &rarr; Winter Park
                            </li>
                        </ul>
                    </article>

                    {/* Account Security */}
                    <article className="rounded-2xl bg-white shadow-sm ring-1 ring-zinc-900/[0.04]">
                        <div className="px-5 py-4 border-b border-zinc-100">
                            <h3 className="text-base font-bold text-zinc-900">Account Security</h3>
                        </div>

                        <div className="divide-y divide-zinc-100">
                            {/* Email */}
                            <div className="flex items-center justify-between px-5 py-4">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-50 text-zinc-500">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <rect width="20" height="16" x="2" y="4" rx="2"/>
                                            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                                        </svg>
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-zinc-900">Email Verification</p>
                                        <p className="text-xs text-zinc-400">{profileEmail}</p>
                                    </div>
                                </div>
                                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0d3d2e]">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="20 6 9 17 4 12"/>
                                    </svg>
                                </span>
                            </div>

                            {/* Phone + Password via Clerk */}
                            <ClerkProfileManager />
                        </div>
                    </article>

                    {/* Actions row */}
                    <div className="flex items-center justify-between">
                        <SignOutButton redirectUrl="/">
                            <button
                                type="button"
                                className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-100"
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="m16 17 5-5-5-5"/>
                                    <path d="M21 12H9"/>
                                    <path d="M13 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8"/>
                                </svg>
                                Sign Out
                            </button>
                        </SignOutButton>

                        <EditProfileButton user={localUser} variant="footer" />
                    </div>

                </div>

            </div>
        </ProtectedShell>
    );
}
