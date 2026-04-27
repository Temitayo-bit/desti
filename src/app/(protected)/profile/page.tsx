import { currentUser } from "@clerk/nextjs/server";
import type { Gender, YearAtStetson } from "@prisma/client";
import { redirect } from "next/navigation";
import { ProtectedShell } from "../_components/ProtectedShell";
import { prisma } from "@/lib/prisma";
import { getDriverRatingSummary } from "@/services/trust-service";
import { ProfilePageView } from "./ProfilePageView";
import type { OnboardingGenderValue, OnboardingYearValue } from "@/lib/onboarding-form";

function formatYearLabel(yearAtStetson: YearAtStetson | null): string {
    if (yearAtStetson === "FRESHMAN") return "Freshman";
    if (yearAtStetson === "SOPHOMORE") return "Sophomore";
    if (yearAtStetson === "JUNIOR") return "Junior";
    if (yearAtStetson === "SENIOR") return "Senior";
    return "Not specified";
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

export default async function ProfilePage() {
    const user = await currentUser();

    if (!user) {
        redirect("/sign-in");
    }

    const clerkUserId = user.id;

    const localUser = await prisma.user.findUnique({
        where: { clerkUserId },
        select: {
            email: true,
            name: true,
            yearAtStetson: true,
            gender: true,
            age: true,
            bio: true,
            onboardingComplete: true,
            profilePictureUrl: true,
        },
    });

    if (!localUser?.onboardingComplete) {
        redirect("/onboarding");
    }

    const [ridesGiven, ridesTaken, ratingSummary] = await Promise.all([
        prisma.booking.count({
            where: {
                status: "COMPLETED",
                OR: [
                    { driverUserId: clerkUserId },
                    { ride: { driverUserId: clerkUserId } },
                ],
            },
        }),
        prisma.booking.count({
            where: { riderUserId: clerkUserId, status: "COMPLETED" },
        }),
        getDriverRatingSummary(clerkUserId).catch(() => ({
            userId: clerkUserId,
            averageRating: null as number | null,
            ratingCount: 0,
        })),
    ]);

    const displayName = localUser.name?.trim() || "Stetson student";
    const yearLabel = formatYearLabel(localUser.yearAtStetson);
    const subtitle =
        localUser.yearAtStetson !== null
            ? `${yearLabel} · Stetson University`
            : "Stetson University";

    const primaryEmail = user.primaryEmailAddress;
    const emailVerified =
        primaryEmail?.verification?.status === "verified" ||
        user.emailAddresses.some((e) => e.verification?.status === "verified");

    const rawPhone = user.primaryPhoneNumber?.phoneNumber?.trim();
    const phoneDisplay = rawPhone && rawPhone.length > 0 ? rawPhone : null;

    const bioText = localUser.bio?.trim() || null;

    const initialEdit = {
        name: localUser.name?.trim() ?? "",
        age: localUser.age,
        yearAtStetson: (localUser.yearAtStetson ?? null) as OnboardingYearValue | null,
        gender: (localUser.gender ?? null) as OnboardingGenderValue | null,
        bio: bioText,
        profilePictureUrl: localUser.profilePictureUrl,
    };

    return (
        <ProtectedShell
            activeNav="profile"
            layout="topnav"
            topNavActive="profile"
        >
            <div className="space-y-6">
                <header>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-800">
                        Profile
                    </p>
                    <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-900 md:text-3xl">
                        Your Desti profile
                    </h1>
                    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-600">
                        This is how you show up on rides, trip requests, and messages. Keep it
                        accurate so other verified students know who they are meeting.
                    </p>
                </header>

                <ProfilePageView
                    displayName={displayName}
                    yearLabel={yearLabel}
                    subtitle={subtitle}
                    bio={bioText}
                    email={localUser.email}
                    emailVerified={emailVerified}
                    phoneDisplay={phoneDisplay}
                    profilePictureUrl={localUser.profilePictureUrl}
                    genderLabel={formatGenderLabel(localUser.gender)}
                    ageLabel={formatAgeLabel(localUser.age)}
                    ridesGiven={ridesGiven}
                    ridesTaken={ridesTaken}
                    averageRating={ratingSummary.averageRating}
                    ratingCount={ratingSummary.ratingCount}
                    initialEdit={initialEdit}
                />
            </div>
        </ProtectedShell>
    );
}
