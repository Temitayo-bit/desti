import { SignUp } from "@clerk/nextjs";

//This is the sign-up page for the application. It uses the SignUp component from Clerk to handle user registration.
export default function SignUpPage() {
    return (
        <div style={{ display: "flex", justifyContent: "center", marginTop: "4rem" }}>
            <SignUp />
        </div>
    );
}
