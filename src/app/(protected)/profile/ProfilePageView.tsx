"use client";

import { useState } from "react";
import Link from "next/link";
import { SignOutButton } from "@clerk/nextjs";
import { Check, Mail, Phone, Shield } from "lucide-react";
import { UserAvatar } from "@/components/UserAvatar";
import { EditProfileModal, type EditProfileModalInitial } from "./EditProfileModal";

export interface ProfilePageViewProps {
    displayName: string;
    yearLabel: string;
    subtitle: string;
    /** Short tagline / bio shown to other students */
    bio: string | null;
    email: string;
    emailVerified: boolean;
    phoneDisplay: string | null;
    profilePictureUrl: string | null;
    genderLabel: string;
    ageLabel: string;
    ridesGiven: number;
    ridesTaken: number;
    averageRating: number | null;
    ratingCount: number;
    initialEdit: EditProfileModalInitial;
}

export function ProfilePageView({
    displayName,
    yearLabel,
    subtitle,
    bio,
    email,
    emailVerified,
    phoneDisplay,
    profilePictureUrl,
    genderLabel,
    ageLabel,
    ridesGiven,
    ridesTaken,
    averageRating,
    ratingCount,
    initialEdit,
}: ProfilePageViewProps) {
    const [editOpen, setEditOpen] = useState(false);

    return (
        <>
            <div className="grid gap-6 lg:grid-cols-[minmax(0,340px)_1fr] lg:items-start">
                <div className="space-y-5">
                    <article className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
                        <div className="border-b border-zinc-100 bg-gradient-to-b from-emerald-50/40 to-white px-6 pb-6 pt-8 text-center">
                            <div className="mx-auto w-fit rounded-full p-1 ring-2 ring-emerald-600/25 ring-offset-2 ring-offset-white">
                                <UserAvatar
                                    src={profilePictureUrl}
                                    name={displayName}
                                    size="xl"
                                />
                            </div>
                            <h1 className="mt-5 text-2xl font-bold tracking-tight text-zinc-900">
                                {displayName}
                            </h1>
                            <p className="mt-1 text-sm text-zinc-600">{subtitle}</p>
                            {bio ? (
                                <p className="mx-auto mt-4 max-w-md whitespace-pre-wrap text-sm italic leading-relaxed text-zinc-600">
                                    &ldquo;{bio}&rdquo;
                                </p>
                            ) : null}
                            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-200/80 bg-emerald-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-900">
                                <Shield className="h-3.5 w-3.5" strokeWidth={2} />
                                Stetson verified
                            </div>
                            <p className="mt-3 text-sm font-medium text-zinc-700">{yearLabel}</p>
                            <button
                                type="button"
                                onClick={() => setEditOpen(true)}
                                className="mt-5 w-full rounded-xl bg-[#0d3d2e] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0a3026] sm:w-auto"
                            >
                                Edit profile
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-px bg-zinc-100 p-px">
                            <div className="bg-white px-4 py-4 text-center">
                                <p className="text-2xl font-bold tabular-nums text-zinc-900">
                                    {ridesGiven}
                                </p>
                                <p className="mt-1 text-[0.65rem] font-semibold uppercase tracking-wide text-zinc-500">
                                    Rides given
                                </p>
                            </div>
                            <div className="bg-white px-4 py-4 text-center">
                                <p className="text-2xl font-bold tabular-nums text-zinc-900">
                                    {ridesTaken}
                                </p>
                                <p className="mt-1 text-[0.65rem] font-semibold uppercase tracking-wide text-zinc-500">
                                    Rides taken
                                </p>
                            </div>
                            <div className="col-span-2 bg-white px-4 py-4 text-center">
                                <p className="text-2xl font-bold tabular-nums text-zinc-900">
                                    {averageRating != null ? averageRating.toFixed(1) : "—"}
                                    {averageRating != null ? (
                                        <span className="ml-1 text-lg text-amber-500">★</span>
                                    ) : null}
                                </p>
                                <p className="mt-1 text-[0.65rem] font-semibold uppercase tracking-wide text-zinc-500">
                                    Avg. rating
                                    {ratingCount > 0 ? ` · ${ratingCount} reviews` : ""}
                                </p>
                            </div>
                        </div>
                    </article>
                </div>

                <div className="space-y-5">
                    <article className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
                        <div className="border-b border-zinc-100 px-5 py-4">
                            <h2 className="text-base font-semibold tracking-tight text-zinc-900">
                                Profile details
                            </h2>
                            <p className="mt-1 text-sm text-zinc-500">
                                Information shown to other verified students.
                            </p>
                        </div>
                        <dl className="divide-y divide-zinc-100 px-5 py-1">
                            <div className="flex flex-wrap items-baseline justify-between gap-2 py-4">
                                <dt className="text-sm font-medium text-zinc-500">Academic year</dt>
                                <dd className="text-sm font-semibold text-zinc-900">{yearLabel}</dd>
                            </div>
                            <div className="flex flex-wrap items-baseline justify-between gap-2 py-4">
                                <dt className="text-sm font-medium text-zinc-500">Age</dt>
                                <dd className="text-sm font-semibold text-zinc-900">{ageLabel}</dd>
                            </div>
                            <div className="flex flex-wrap items-baseline justify-between gap-2 py-4">
                                <dt className="text-sm font-medium text-zinc-500">Gender</dt>
                                <dd className="text-sm font-semibold text-zinc-900">{genderLabel}</dd>
                            </div>
                        </dl>
                    </article>

                    <article className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
                        <div className="border-b border-zinc-100 px-5 py-4">
                            <h2 className="text-base font-semibold tracking-tight text-zinc-900">
                                Account &amp; security
                            </h2>
                        </div>
                        <div className="divide-y divide-zinc-100">
                            <div className="flex items-start gap-4 px-5 py-4">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-500">
                                    <Mail size={20} strokeWidth={2} />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium text-zinc-500">Email</p>
                                    <p className="mt-0.5 break-all text-sm font-semibold text-zinc-900">
                                        {email}
                                    </p>
                                    <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                                        {emailVerified ? (
                                            <>
                                                <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                                                Verified
                                            </>
                                        ) : (
                                            <span className="text-amber-700">Not verified</span>
                                        )}
                                    </p>
                                </div>
                            </div>
                            {phoneDisplay ? (
                                <div className="flex items-start gap-4 px-5 py-4">
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-500">
                                        <Phone size={20} strokeWidth={2} />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium text-zinc-500">Phone</p>
                                        <p className="mt-0.5 text-sm font-semibold text-zinc-900">
                                            {phoneDisplay}
                                        </p>
                                    </div>
                                </div>
                            ) : null}
                        </div>
                        <div className="flex flex-col gap-2 border-t border-zinc-100 p-4 sm:flex-row sm:justify-end">
                            <SignOutButton redirectUrl="/">
                                <button
                                    type="button"
                                    className="w-full rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 sm:w-auto"
                                >
                                    Sign out
                                </button>
                            </SignOutButton>
                            <button
                                type="button"
                                onClick={() => setEditOpen(true)}
                                className="w-full rounded-xl bg-[#0d3d2e] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0a3026] sm:w-auto"
                            >
                                Edit profile
                            </button>
                        </div>
                    </article>

                    <article className="rounded-2xl border border-emerald-100 bg-emerald-50/35 px-5 py-4">
                        <h3 className="font-semibold text-emerald-950">Ride safely</h3>
                        <p className="mt-2 text-sm leading-relaxed text-emerald-950/85">
                            Meet in public places, confirm trip details in Desti messages, and
                            keep your profile up to date.
                        </p>
                        <Link
                            href="/user-profile"
                            className="mt-3 inline-block text-sm font-semibold text-emerald-900 underline decoration-emerald-900/30 underline-offset-2 hover:decoration-emerald-900"
                        >
                            Open Clerk account settings
                        </Link>
                    </article>
                </div>
            </div>

            <EditProfileModal
                open={editOpen}
                onClose={() => setEditOpen(false)}
                initial={initialEdit}
            />
        </>
    );
}
