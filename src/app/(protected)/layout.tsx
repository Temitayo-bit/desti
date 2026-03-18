import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { evaluateFrontendAccess } from "@/lib/frontend-auth";
import { prisma } from "@/lib/prisma";

export default async function ProtectedLayout({
    children,
}: Readonly<{ children: React.ReactNode }>) {
    const user = await currentUser();

    if (!user) {
        redirect("/sign-in");
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

    if (localUser?.onboardingComplete !== true) {
        redirect("/onboarding");
    }

    return <>{children}</>;
}
