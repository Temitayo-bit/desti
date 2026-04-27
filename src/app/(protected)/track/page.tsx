import { redirect } from "next/navigation";
import { TopNav } from "./_components/TopNav";
import { TripSidebar } from "./_components/TripSidebar";
import { MapArea } from "./_components/MapArea";
import { MOCK_TRIP } from "./mockData";

const isDemoEnabled =
    process.env.NEXT_PUBLIC_DEMO_TRACK === "true" ||
    process.env.NODE_ENV !== "production";

export default function TrackRidePage() {
    if (!isDemoEnabled) {
        redirect("/dashboard");
    }

    return (
        <div className="flex min-h-screen w-full flex-col bg-white font-sans md:h-screen md:overflow-hidden">
            <TopNav />

            {/* Demo mode banner */}
            <div className="flex items-center justify-center gap-2 bg-amber-50 border-b border-amber-200 px-4 py-2 text-sm font-medium text-amber-800">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                Demo Mode — Showing mock trip data
            </div>

            <main className="flex flex-1 flex-col overflow-y-auto md:flex-row md:overflow-hidden relative">
                <div className="h-auto flex-shrink-0 z-10 border-b md:border-b-0 md:border-r border-zinc-200 shadow-xl md:h-full md:w-auto">
                    <TripSidebar trip={MOCK_TRIP} />
                </div>

                <div className="flex-1 relative min-h-[400px]">
                    <MapArea trip={MOCK_TRIP} />
                </div>
            </main>
        </div>
    );
}
