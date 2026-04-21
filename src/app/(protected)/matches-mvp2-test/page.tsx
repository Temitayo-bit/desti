import { notFound } from "next/navigation";
import MatchesMvp2TestClient from "./MatchesMvp2TestClient";

export default function MatchesMvp2TestPage() {
    const isExplicitlyEnabled =
        process.env.ENABLE_MATCHES_MVP2_TEST?.trim().toLowerCase() === "true";

    if (process.env.NODE_ENV === "production" && !isExplicitlyEnabled) {
        notFound();
    }

    return <MatchesMvp2TestClient />;
}
