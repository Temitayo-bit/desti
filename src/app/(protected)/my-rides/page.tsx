import { redirect } from "next/navigation";
import { getRidesViewHref } from "@/lib/ride-view";

export default function MyRidesRedirectPage() {
    redirect(getRidesViewHref("my"));
}
