import { notFound } from "next/navigation";
import RideOffersMvp2TestClient from "./RideOffersMvp2TestClient";

export default function RideOffersMvp2TestPage() {
  const isExplicitlyEnabled =
    process.env.ENABLE_RIDE_OFFERS_MVP2_TEST?.trim().toLowerCase() === "true";

  if (process.env.NODE_ENV === "production" && !isExplicitlyEnabled) {
    notFound();
  }

  return <RideOffersMvp2TestClient />;
}
