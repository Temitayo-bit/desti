import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
    return (
        <div style={{ display: "flex", justifyContent: "center", marginTop: "4rem" }}>
            <SignIn
                fallbackRedirectUrl="/dashboard"
                forceRedirectUrl="/dashboard"
                signUpUrl="/sign-up"
            />
        </div>
    );
}
