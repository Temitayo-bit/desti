import { TopNav } from "./_components/TopNav";
import { TripSidebar } from "./_components/TripSidebar";
import { MapArea } from "./_components/MapArea";
import { MOCK_TRIP } from "./mockData";

export default function TrackRidePage() {
    return (
        <div className="flex min-h-screen w-full flex-col bg-white font-sans md:h-screen md:overflow-hidden">
            <TopNav />
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
