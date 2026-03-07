import { redirect } from "next/navigation";

export default function MyTripRequestsRedirectPage() {
    redirect("/browse-trip-requests?view=my");
}
