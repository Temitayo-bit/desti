import { notFound } from "next/navigation";
import GeocodeMvp2TestClient from "./GeocodeMvp2TestClient";

export default function GeocodeMvp2TestPage() {
  const isExplicitlyEnabled =
    process.env.ENABLE_GEO_MVP2_TEST?.trim().toLowerCase() === "true";

  if (process.env.NODE_ENV === "production" && !isExplicitlyEnabled) {
    notFound();
  }

  return <GeocodeMvp2TestClient />;
}
