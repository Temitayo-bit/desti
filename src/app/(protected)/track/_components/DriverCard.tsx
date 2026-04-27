/* eslint-disable @next/next/no-img-element */
"use client";

import { Star } from "lucide-react";
import { type MockTripData } from "../mockData";

export function DriverCard({ driver }: { driver: MockTripData["driver"] }) {
    return (
        <article className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-4">
                {/* Avatar Placeholder */}
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-emerald-100 overflow-hidden">
                    {driver.avatarUrl ? (
                        <img src={driver.avatarUrl} alt={driver.name} className="h-full w-full object-cover" />
                    ) : (
                        <div className="flex h-full w-full items-end justify-center pt-2 bg-sky-100">
                             <div className="h-10 w-8 rounded-t-full bg-sky-700/80"></div>
                        </div>
                    )}
                </div>

                <div className="flex flex-col">
                    <h3 className="text-lg font-bold text-zinc-900">{driver.name}</h3>
                    <div className="flex items-center gap-1.5 text-sm text-zinc-600">
                        <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                        <span className="font-semibold">{driver.rating}</span>
                        <span>• Top Rated</span>
                    </div>
                </div>
            </div>

            <div className="flex items-end justify-between border-t border-zinc-100 pt-4">
                <div className="flex flex-col">
                    <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Vehicle</span>
                    <span className="font-medium text-zinc-900">{driver.vehicle}</span>
                </div>
                <div className="flex flex-col items-end">
                    <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">Plate</span>
                    <span className="inline-flex items-center rounded-lg bg-emerald-200/60 px-3 py-1 font-mono text-sm font-bold tracking-widest text-emerald-900">
                        {driver.plate}
                    </span>
                </div>
            </div>
        </article>
    );
}
