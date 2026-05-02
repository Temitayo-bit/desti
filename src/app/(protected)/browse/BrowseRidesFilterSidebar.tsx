"use client";

import { Car, Map, MapPin } from "lucide-react";
import {
  type BrowseTimeWindow,
  type SidebarApiFilters,
  formatDistanceMilesLabel,
} from "@/lib/browse-ride-filters";

interface BrowseRidesFilterSidebarProps {
  distShort: boolean;
  distMedium: boolean;
  distLong: boolean;
  setDistShort: (v: boolean) => void;
  setDistMedium: (v: boolean) => void;
  setDistLong: (v: boolean) => void;
  timeWindow: BrowseTimeWindow | null;
  setTimeWindow: React.Dispatch<React.SetStateAction<BrowseTimeWindow | null>>;
  sidebarApi: SidebarApiFilters;
  setSidebarApi: React.Dispatch<React.SetStateAction<SidebarApiFilters>>;
}

export function BrowseRidesFilterSidebar({
  distShort,
  distMedium,
  distLong,
  setDistShort,
  setDistMedium,
  setDistLong,
  timeWindow,
  setTimeWindow,
  sidebarApi,
  setSidebarApi,
}: BrowseRidesFilterSidebarProps) {
  return (
    <aside className="min-w-0 space-y-5 lg:col-span-4 xl:col-span-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Distance
        </p>
        <ul className="mt-2 space-y-2">
          {(
            [
              { key: "short" as const, label: "Short", sub: formatDistanceMilesLabel("SHORT") },
              { key: "medium" as const, label: "Medium", sub: formatDistanceMilesLabel("MEDIUM") },
              { key: "long" as const, label: "Long", sub: formatDistanceMilesLabel("LONG") },
            ] as const
          ).map((row) => (
            <li key={row.key}>
              <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm shadow-sm">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-[#006837] focus:ring-[#006837]"
                  checked={row.key === "short" ? distShort : row.key === "medium" ? distMedium : distLong}
                  onChange={(e) => {
                    if (row.key === "short") setDistShort(e.target.checked);
                    if (row.key === "medium") setDistMedium(e.target.checked);
                    if (row.key === "long") setDistLong(e.target.checked);
                  }}
                />
                <span>
                  {row.key === "short" ? (
                    <Car className="mb-0.5 inline h-3.5 w-3.5 text-zinc-500" />
                  ) : row.key === "medium" ? (
                    <MapPin className="mb-0.5 inline h-3.5 w-3.5 text-zinc-500" />
                  ) : (
                    <Map className="mb-0.5 inline h-3.5 w-3.5 text-zinc-500" />
                  )}{" "}
                  <span className="font-medium text-zinc-900">{row.label}</span>
                  <span className="text-zinc-500"> ({row.sub})</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Time window
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {(
            [
              { id: "MORNING" as const, label: "Morning" },
              { id: "AFTERNOON" as const, label: "Afternoon" },
              { id: "EVENING" as const, label: "Evening" },
              { id: "LATE_NIGHT" as const, label: "Late Night" },
            ] as const
          ).map((tw) => (
            <button
              key={tw.id}
              type="button"
              aria-pressed={timeWindow === tw.id}
              onClick={() => setTimeWindow((t) => (t === tw.id ? null : tw.id))}
              className={`rounded-full px-3.5 py-2 text-xs font-semibold transition ${
                timeWindow === tw.id
                  ? "bg-[#006837] text-white"
                  : "border border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300"
              }`}
            >
              {tw.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Ride details
        </p>
        <div className="mt-2 space-y-2">
          <div>
            <label htmlFor="browse-filter-hasAc" className="text-xs text-zinc-600">
              AC
            </label>
            <select
              id="browse-filter-hasAc"
              value={sidebarApi.hasAc}
              onChange={(e) =>
                setSidebarApi((p) => ({ ...p, hasAc: e.target.value }))
              }
              className="mt-0.5 w-full rounded-xl border border-zinc-200 bg-white px-2.5 py-2.5 text-sm"
            >
              <option value="">Any</option>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </div>
          <div>
            <label htmlFor="browse-filter-hasTrunkSpace" className="text-xs text-zinc-600">
              Trunk space
            </label>
            <select
              id="browse-filter-hasTrunkSpace"
              value={sidebarApi.hasTrunkSpace}
              onChange={(e) =>
                setSidebarApi((p) => ({ ...p, hasTrunkSpace: e.target.value }))
              }
              className="mt-0.5 w-full rounded-xl border border-zinc-200 bg-white px-2.5 py-2.5 text-sm"
            >
              <option value="">Any</option>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </div>
          <div>
            <label htmlFor="browse-filter-musicPreference" className="text-xs text-zinc-600">
              Music
            </label>
            <select
              id="browse-filter-musicPreference"
              value={sidebarApi.musicPreference}
              onChange={(e) =>
                setSidebarApi((p) => ({ ...p, musicPreference: e.target.value }))
              }
              className="mt-0.5 w-full rounded-xl border border-zinc-200 bg-white px-2.5 py-2.5 text-sm"
            >
              <option value="">Any</option>
              <option value="MUSIC_ALLOWED">Music allowed</option>
              <option value="NO_MUSIC">No music</option>
            </select>
          </div>
          <div>
            <label htmlFor="browse-filter-vehicleType" className="text-xs text-zinc-600">
              Vehicle
            </label>
            <select
              id="browse-filter-vehicleType"
              value={sidebarApi.vehicleType}
              onChange={(e) =>
                setSidebarApi((p) => ({ ...p, vehicleType: e.target.value }))
              }
              className="mt-0.5 w-full rounded-xl border border-zinc-200 bg-white px-2.5 py-2.5 text-sm"
            >
              <option value="">Any</option>
              <option value="SEDAN">Sedan</option>
              <option value="SUV">SUV</option>
              <option value="TRUCK">Truck</option>
              <option value="VAN">Van</option>
              <option value="COUPE">Coupe</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-[#006837]/20 bg-[#C4E5D4]/50 p-4 text-sm text-[#0d3d2e]">
        <p className="font-semibold">Pro tip</p>
        <p className="mt-2 leading-relaxed">
          Rides with &apos;Stetson Verified&apos; badges are driven by students
          with cleared campus background checks.
        </p>
      </div>
    </aside>
  );
}
