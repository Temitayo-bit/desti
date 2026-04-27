import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { LandingPage } from "@/components/landing/LandingPage";
import { evaluateFrontendAccess } from "@/lib/frontend-auth";
import { prisma } from "@/lib/prisma";

async function resolveRootState() {
    const user = await currentUser();

    if (!user) {
        return;
    }

    const access = evaluateFrontendAccess(user);
    if (!access.allowed) {
        const query = new URLSearchParams({ reason: access.reason });
        redirect(`/access-restricted?${query.toString()}`);
    }

    const localUser = await prisma.user.findUnique({
        where: { clerkUserId: user.id },
        select: { onboardingComplete: true },
    });

    if (localUser?.onboardingComplete === true) {
        redirect("/dashboard");
    }

    redirect("/onboarding");
}

export default async function HomePage() {
    await resolveRootState();

    return <LandingPage />;
}
