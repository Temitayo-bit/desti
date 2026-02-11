import { RedirectToSignIn, SignedIn, SignedOut, UserProfile } from "@clerk/nextjs";

export default function UserProfilePage() {
    return (
        <main className="mx-auto flex min-h-screen max-w-5xl items-center justify-center px-6 py-10">
            <SignedIn>
                <UserProfile routing="path" path="/user-profile" />
            </SignedIn>
            <SignedOut>
                <RedirectToSignIn />
            </SignedOut>
        </main>
    );
}
