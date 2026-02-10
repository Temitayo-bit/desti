import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { evaluateFrontendAccess } from "@/lib/frontend-auth";

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

    return <>{children}</>;
}
