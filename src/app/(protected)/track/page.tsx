import { TopNav } from "./_components/TopNav";
import { TripSidebar } from "./_components/TripSidebar";
import { MapArea } from "./_components/MapArea";
import { MOCK_TRIP } from "./mockData";

export default function TrackRidePage() {
    return (
        <div className="flex h-screen w-full flex-col overflow-hidden bg-white font-sans">
            <TopNav />
            <main className="flex flex-1 flex-col md:flex-row overflow-hidden relative">
                <div className="md:h-full md:w-auto h-auto flex-shrink-0 z-10 border-b md:border-b-0 md:border-r border-zinc-200 shadow-xl">
                    <TripSidebar trip={MOCK_TRIP} />
                </div>
                
                <div className="flex-1 relative min-h-[400px]">
                    <MapArea trip={MOCK_TRIP} />
                </div>
            </main>
        </div>
    );
}
