import { notFound } from "next/navigation";
import StopRequestsMvp2TestClient from "./StopRequestsMvp2TestClient";

export default function StopRequestsMvp2TestPage() {
  const isExplicitlyEnabled =
    process.env.ENABLE_STOP_REQUESTS_MVP2_TEST?.trim().toLowerCase() === "true";

  if (process.env.NODE_ENV === "production" && !isExplicitlyEnabled) {
    notFound();
  }

  return <StopRequestsMvp2TestClient />;
}
