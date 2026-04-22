"use client";

import { MapPin, X, Plus, Car } from "lucide-react";
import { type VehicleData } from "../mockData";

interface RidesharePreferencesCardProps {
    pickupPoints: string[];
    vehicles: VehicleData[];
    onRemovePickup: (point: string) => void;
    onAddPickup: () => void;
    onAddVehicle: () => void;
}

export function RidesharePreferencesCard({
    pickupPoints,
    vehicles,
    onRemovePickup,
    onAddPickup,
    onAddVehicle,
}: RidesharePreferencesCardProps) {
    return (
        <article className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold tracking-tight text-zinc-900 mb-6">
                Rideshare Preferences
            </h2>

            {/* Pickup Points */}
            <div className="mb-6">
                <h3 className="text-sm font-semibold text-zinc-600 mb-3">
                    Favorite Pickup Points
                </h3>
                <div className="flex flex-wrap items-center gap-2">
                    {pickupPoints.map((point) => (
                        <span
                            key={point}
                            className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3.5 py-2 text-sm font-medium text-zinc-700"
                        >
                            <MapPin size={14} className="text-zinc-400" />
                            {point}
                            <button
                                type="button"
                                onClick={() => onRemovePickup(point)}
                                className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-300 hover:text-zinc-700 transition-colors"
                                aria-label={`Remove ${point}`}
                            >
                                <X size={12} />
                            </button>
                        </span>
                    ))}

                    <button
                        type="button"
                        onClick={onAddPickup}
                        className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-emerald-400 px-3.5 py-2 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-50"
                    >
                        <Plus size={14} />
                        Add Point
                    </button>
                </div>
            </div>

            {/* Vehicles */}
            <div>
                <h3 className="text-sm font-semibold text-zinc-600 mb-3">
                    Vehicle Details (Driver Mode)
                </h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {vehicles.map((v) => (
                        <div
                            key={v.id}
                            className="flex items-center gap-3 rounded-xl bg-zinc-800 px-4 py-3.5 text-white"
                        >
                            <Car size={20} className="shrink-0 text-zinc-300" />
                            <div className="min-w-0">
                                <p className="text-sm font-bold">{v.makeModel}</p>
                                <p className="text-xs text-zinc-400">
                                    {v.color} • {v.plate}
                                </p>
                            </div>
                        </div>
                    ))}

                    <button
                        type="button"
                        onClick={onAddVehicle}
                        className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-200 px-4 py-3.5 text-sm font-medium text-zinc-500 transition-colors hover:border-zinc-400 hover:text-zinc-700"
                    >
                        <Plus size={16} />
                        Add Vehicle
                    </button>
                </div>
            </div>
        </article>
    );
}
