import { redirect } from "next/navigation";

export default function MyRidesRedirectPage() {
    redirect("/browse?view=my");
}
