import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
    return (
        <div style={{ display: "flex", justifyContent: "center", marginTop: "4rem" }}>
            <SignUp
                fallbackRedirectUrl="/dashboard"
                forceRedirectUrl="/dashboard"
                signInUrl="/sign-in"
            />
        </div>
    );
}
