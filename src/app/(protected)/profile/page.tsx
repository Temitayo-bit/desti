import Link from "next/link";
import { SignOutButton } from "@clerk/nextjs";
import { currentUser } from "@clerk/nextjs/server";
import type { Gender, YearAtStetson } from "@prisma/client";
import { redirect } from "next/navigation";
import { ProtectedShell } from "../_components/ProtectedShell";
import { prisma } from "@/lib/prisma";
import { UserAvatar } from "@/components/UserAvatar";
import { ProfilePictureUpload } from "./ProfilePictureUpload";

function formatYearLabel(yearAtStetson: YearAtStetson | null): string {
    if (yearAtStetson === "FRESHMAN") return "Freshman";
    if (yearAtStetson === "SOPHOMORE") return "Sophomore";
    if (yearAtStetson === "JUNIOR") return "Junior";
    if (yearAtStetson === "SENIOR") return "Senior";
    return "Stetson student";
}

function formatGenderLabel(gender: Gender | null): string {
    if (gender === "MALE") return "Male";
    if (gender === "FEMALE") return "Female";
    if (gender === "OTHER") return "Other";
    if (gender === "PREFER_NOT_TO_SAY") return "Prefer not to say";
    return "Not provided";
}

function formatAgeLabel(age: number | null): string {
    if (typeof age !== "number") {
        return "Not provided";
    }

    return `${age} years old`;
}

function AccountRow({
    icon,
    label,
    value,
}: {
    icon: React.ReactNode;
    label: string;
    value: string;
}) {
    return (
        <div className="flex items-start gap-4 border-b border-zinc-200 px-5 py-5 last:border-b-0 md:px-6">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-500">
                {icon}
            </div>
            <div className="min-w-0">
                <p className="text-sm font-medium text-zinc-500">{label}</p>
                <p className="mt-1 break-words text-lg font-semibold tracking-tight text-zinc-900">
                    {value}
                </p>
            </div>
        </div>
    );
}

function SettingsRow({
    href,
    title,
    description,
}: {
    href: string;
    title: string;
    description: string;
}) {
    return (
        <Link
            href={href}
            className="group flex items-center justify-between gap-4 border-b border-zinc-200 px-5 py-4 transition-colors hover:bg-zinc-50 last:border-b-0 md:px-6"
        >
            <div>
                <p className="text-base font-semibold tracking-tight text-zinc-900">
                    {title}
                </p>
                <p className="mt-1 text-sm leading-6 text-zinc-500">{description}</p>
            </div>
            <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="shrink-0 text-zinc-400 transition-transform group-hover:translate-x-0.5 group-hover:text-emerald-700"
            >
                <path d="m9 18 6-6-6-6" />
            </svg>
        </Link>
    );
}

export default async function ProfilePage() {
    const user = await currentUser();

    if (!user) {
        redirect("/sign-in");
    }

    const localUser = await prisma.user.findUnique({
        where: { clerkUserId: user.id },
        select: {
            email: true,
            name: true,
            yearAtStetson: true,
            gender: true,
            age: true,
            onboardingComplete: true,
            profilePictureUrl: true,
        },
    });

    if (!localUser?.onboardingComplete) {
        redirect("/onboarding");
    }

    const displayName = localUser.name?.trim() || "Stetson student";
    const yearLabel = formatYearLabel(localUser.yearAtStetson);
    const subtitle =
        localUser.yearAtStetson !== null
            ? `${yearLabel} at Stetson`
            : "Stetson student";
    const profileEmail = localUser.email;

    return (
        <ProtectedShell activeNav="profile">
            <section className="rounded-2xl border border-zinc-200 bg-white px-5 py-5 shadow-sm md:px-6">
                <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                    <div>
                        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-emerald-700">
                            Account
                        </p>
                        <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-900 md:text-3xl">
                            Profile
                        </h1>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
                            View the profile details Desti uses across rides, trip requests,
                            and messaging.
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
                            <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="currentColor"
                                className="text-blue-600"
                            >
                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
                            </svg>
                            Stetson Verified
                        </div>
                        <Link
                            href="/profile-settings"
                            className="inline-flex items-center gap-2 rounded-full bg-emerald-700 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-800"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                                <path d="m15 5 4 4"/>
                            </svg>
                            Edit Profile
                        </Link>
                    </div>
                </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
                <article className="h-fit self-start rounded-2xl border border-zinc-200 bg-white p-6 text-center shadow-sm">
                    <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full shadow-[0_12px_28px_rgba(6,95,70,0.22)]">
                        <UserAvatar
                            src={localUser.profilePictureUrl}
                            name={localUser.name}
                            size="xl"
                        />
                    </div>
                    <ProfilePictureUpload
                        currentUrl={localUser.profilePictureUrl}
                    />
                    <h2 className="mt-6 text-2xl font-bold tracking-tight text-zinc-900">
                        {displayName}
                    </h2>
                    <p className="mt-2 text-base text-zinc-500">{subtitle}</p>
                    <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800">
                        <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M20 13c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V6l8-3 8 3Z" />
                            <path d="m9 12 2 2 4-4" />
                        </svg>
                        Verified Student
                    </div>
                </article>

                <div className="space-y-6">
                    <div>
                        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">
                            Account
                        </p>
                        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
                            <AccountRow
                                label="Email"
                                value={profileEmail}
                                icon={
                                    <svg
                                        width="22"
                                        height="22"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    >
                                        <rect x="3" y="5" width="18" height="14" rx="2" />
                                        <path d="m3 7 9 6 9-6" />
                                    </svg>
                                }
                            />
                            <AccountRow
                                label="Year at Stetson"
                                value={yearLabel}
                                icon={
                                    <svg
                                        width="22"
                                        height="22"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    >
                                        <path d="m22 10-10-5-10 5 10 5 10-5Z" />
                                        <path d="M6 12v5c3 3 9 3 12 0v-5" />
                                    </svg>
                                }
                            />
                            <AccountRow
                                label="Age"
                                value={formatAgeLabel(localUser.age)}
                                icon={
                                    <svg
                                        width="22"
                                        height="22"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    >
                                        <circle cx="12" cy="12" r="9" />
                                        <path d="M12 7v5l3 3" />
                                    </svg>
                                }
                            />
                            <AccountRow
                                label="Gender"
                                value={formatGenderLabel(localUser.gender)}
                                icon={
                                    <svg
                                        width="22"
                                        height="22"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    >
                                        <circle cx="12" cy="8" r="4" />
                                        <path d="M12 12v9" />
                                        <path d="M8 18h8" />
                                    </svg>
                                }
                            />
                        </div>
                    </div>

                    <div>
                        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">
                            Settings
                        </p>
                        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
                            <SettingsRow
                                href="/user-profile"
                                title="Manage account & email"
                                description="Open Clerk account settings to review your email address and session details."
                            />
                            <SettingsRow
                                href="/#faq"
                                title="FAQ"
                                description="Jump to the marketing page FAQ for the main rider and driver guidance."
                            />
                            <SettingsRow
                                href="mailto:support@desti.app"
                                title="Contact support"
                                description="Email support if you need help with access, bookings, or account issues."
                            />
                        </div>
                    </div>

                    <article className="rounded-2xl border border-emerald-200 bg-[linear-gradient(135deg,_rgba(236,253,245,0.95),_rgba(219,234,254,0.45))] p-5 shadow-sm">
                        <div className="flex items-start gap-4">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-700 shadow-sm">
                                <svg
                                    width="22"
                                    height="22"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <path d="M20 13c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V6l8-3 8 3Z" />
                                    <path d="m9 12 2 2 4-4" />
                                </svg>
                            </div>
                            <div>
                                <h3 className="text-xl font-bold tracking-tight text-emerald-950">
                                    Ride safely
                                </h3>
                                <p className="mt-2 text-sm leading-6 text-emerald-900/85">
                                    Meet in public places, confirm trip details in Desti
                                    messages, and keep your Stetson account information current.
                                </p>
                            </div>
                        </div>
                    </article>

                    <div className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm">
                        <SignOutButton redirectUrl="/">
                            <button
                                type="button"
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
                        </SignOutButton>
                    </div>
                </div>
            </section>
        </ProtectedShell>
    );
}
