"use client";

import { motion } from "framer-motion";
import { MessageSquare, PhoneCall, AlertTriangle, CheckCircle2, RotateCcw } from "lucide-react";
import { DriverCard } from "./DriverCard";
import { type TripData } from "../types";

export function TripSidebar({
    trip,
    onRetry,
}: {
    trip: TripData;
    onRetry?: () => void;
}) {
    /* ── LOADING state ── */
    if (trip.status === "LOADING") {
        return (
            <aside className="flex h-full w-full flex-col bg-[#F9F7F4] p-6 md:w-[400px] lg:w-[440px] md:overflow-y-auto hide-scrollbar">
                <div className="mb-6 flex">
                    <div className="h-7 w-28 animate-pulse rounded-full bg-zinc-200" />
                </div>
                <div className="mb-8 space-y-3">
                    <div className="h-10 w-3/4 animate-pulse rounded-xl bg-zinc-200" />
                    <div className="h-10 w-1/2 animate-pulse rounded-xl bg-zinc-200" />
                </div>
                <div className="mb-8 h-32 animate-pulse rounded-2xl bg-zinc-200" />
                <div className="mb-8 space-y-6">
                    <div className="h-6 w-1/3 animate-pulse rounded-lg bg-zinc-200" />
                    <div className="h-6 w-2/3 animate-pulse rounded-lg bg-zinc-200" />
                </div>
                <div className="mt-auto space-y-3 pt-4">
                    <div className="h-14 animate-pulse rounded-2xl bg-zinc-200" />
                    <div className="h-12 animate-pulse rounded-2xl bg-zinc-200" />
                </div>
            </aside>
        );
    }

    /* ── ERROR state ── */
    if (trip.status === "ERROR") {
        return (
            <aside className="flex h-full w-full flex-col items-center justify-center bg-[#F9F7F4] p-6 md:w-[400px] lg:w-[440px]">
                <div className="flex flex-col items-center gap-4 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                        <AlertTriangle className="h-8 w-8 text-red-600" />
                    </div>
                    <h2 className="text-xl font-bold text-zinc-900">Unable to load trip</h2>
                    <p className="max-w-xs text-sm text-zinc-500">
                        {trip.errorMessage ?? "Something went wrong. Please try again."}
                    </p>
                    {onRetry ? (
                        <button
                            type="button"
                            onClick={onRetry}
                            className="mt-2 flex items-center gap-2 rounded-2xl bg-[#1A593A] px-6 py-3 font-semibold text-white shadow-md transition hover:bg-[#124129] active:scale-[0.98]"
                        >
                            <RotateCcw size={18} />
                            Retry
                        </button>
                    ) : null}
                </div>
            </aside>
        );
    }

    /* ── COMPLETED state ── */
    if (trip.status === "COMPLETED") {
        return (
            <aside className="flex h-full w-full flex-col bg-[#F9F7F4] p-6 md:w-[400px] lg:w-[440px] md:overflow-y-auto hide-scrollbar">
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-6 flex"
                >
                    <div className="inline-flex items-center gap-2 rounded-full bg-blue-100/80 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-blue-800">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Trip Completed
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 }}
                    className="mb-8"
                >
                    <h1 className="text-4xl font-bold tracking-tight text-zinc-900 leading-tight">
                        You&apos;ve arrived at<br />
                        <span className="text-emerald-700">{trip.locations.destination}</span>
                    </h1>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="mb-8"
                >
                    <DriverCard driver={trip.driver} />
                </motion.div>

                {/* Route summary */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="mb-8 flex-1"
                >
                    <div className="relative pl-6">
                        <div className="absolute left-[11px] top-4 bottom-4 w-0.5 bg-emerald-400" />

                        <div className="relative mb-8 flex flex-col">
                            <div className="absolute -left-6 top-1 h-4 w-4 rounded-full border-4 border-emerald-600 bg-white" />
                            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Pickup</span>
                            <span className="text-lg font-medium text-zinc-900">{trip.locations.pickup}</span>
                        </div>

                        <div className="relative flex flex-col">
                            <div className="absolute -left-6 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600">
                                <div className="h-1.5 w-1.5 rounded-full bg-white" />
                            </div>
                            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Destination</span>
                            <span className="text-lg font-medium text-zinc-900">{trip.locations.destination}</span>
                        </div>
                    </div>
                </motion.div>
            </aside>
        );
    }

    /* ── ARRIVED state ── */
    if (trip.status === "ARRIVED") {
        return (
            <aside className="flex h-full w-full flex-col bg-[#F9F7F4] p-6 md:w-[400px] lg:w-[440px] md:overflow-y-auto hide-scrollbar">
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-6 flex"
                >
                    <div className="inline-flex items-center gap-2 rounded-full bg-amber-100/80 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-amber-800">
                        <div className="h-2 w-2 rounded-full bg-amber-600 animate-pulse" />
                        Driver Arrived
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 }}
                    className="mb-8"
                >
                    <h1 className="text-4xl font-bold tracking-tight text-zinc-900 leading-tight">
                        Your driver is<br />
                        <span className="text-amber-600">waiting for you</span>
                    </h1>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="mb-8"
                >
                    <DriverCard driver={trip.driver} />
                </motion.div>

                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="mb-8 flex-1"
                >
                    <div className="relative pl-6">
                        <div className="absolute left-[11px] top-4 bottom-4 w-0.5 bg-zinc-200" />
                        <div className="relative mb-8 flex flex-col">
                            <div className="absolute -left-6 top-1 h-4 w-4 rounded-full border-4 border-amber-500 bg-white" />
                            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Pickup</span>
                            <span className="text-lg font-medium text-zinc-900">{trip.locations.pickup}</span>
                        </div>
                        <div className="relative flex flex-col">
                            <div className="absolute -left-6 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-zinc-800">
                                <div className="h-1.5 w-1.5 rounded-full bg-white" />
                            </div>
                            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Destination</span>
                            <span className="text-lg font-medium text-zinc-900">{trip.locations.destination}</span>
                        </div>
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="mt-auto pt-4 flex flex-col gap-3"
                >
                    <button className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#1A593A] px-6 py-4 font-semibold text-white shadow-md transition hover:bg-[#124129] active:scale-[0.98]">
                        <MessageSquare size={20} />
                        Message Driver
                    </button>
                    <button className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-6 py-3 font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50 active:scale-[0.98] border border-zinc-200">
                        <PhoneCall size={18} className="text-zinc-500" />
                        Call Driver
                    </button>
                </motion.div>
            </aside>
        );
    }

    /* ── ACTIVE state (default) ── */
    return (
        <aside className="flex h-full w-full flex-col bg-[#F9F7F4] p-6 md:w-[400px] lg:w-[440px] md:overflow-y-auto hide-scrollbar">
            {/* Status Pill */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 flex"
            >
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100/80 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-emerald-800">
                    <div className="h-2 w-2 rounded-full bg-emerald-600 animate-pulse" />
                    Ride Active
                </div>
            </motion.div>

            {/* ETA Headline */}
            <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="mb-8"
            >
                <h1 className="text-4xl font-bold tracking-tight text-zinc-900 leading-tight">
                    Your driver is<br />
                    <span className="text-emerald-700">{trip.eta.minutes} mins away</span>
                </h1>
            </motion.div>

            {/* Driver Info */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="mb-8"
            >
                <DriverCard driver={trip.driver} />
            </motion.div>

            {/* Location Progress */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="mb-8 flex-1"
            >
                <div className="relative pl-6">
                    {/* Vertical Line */}
                    <div className="absolute left-[11px] top-4 bottom-4 w-0.5 bg-zinc-200" />

                    {/* Progress Fill */}
                    <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: "30%" }}
                        transition={{ delay: 1, duration: 1.5, ease: "easeInOut" }}
                        className="absolute left-[11px] top-4 w-0.5 bg-emerald-500 origin-top"
                    />

                    {/* Pickup */}
                    <div className="relative mb-8 flex flex-col">
                        <div className="absolute -left-6 top-1 h-4 w-4 rounded-full border-4 border-emerald-600 bg-white" />
                        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Pickup</span>
                        <span className="text-lg font-medium text-zinc-900">{trip.locations.pickup}</span>
                    </div>

                    {/* Destination */}
                    <div className="relative flex flex-col">
                        <div className="absolute -left-6 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-zinc-800">
                             <div className="h-1.5 w-1.5 rounded-full bg-white" />
                        </div>
                        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Destination</span>
                        <span className="text-lg font-medium text-zinc-900">{trip.locations.destination}</span>
                    </div>
                </div>
            </motion.div>

            {/* Actions */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="mt-auto pt-4 flex flex-col gap-3"
            >
                <button className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#1A593A] px-6 py-4 font-semibold text-white shadow-md transition hover:bg-[#124129] active:scale-[0.98]">
                    <MessageSquare size={20} />
                    Message Driver
                </button>
                <button className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-6 py-3 font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50 active:scale-[0.98] border border-zinc-200">
                    <PhoneCall size={18} className="text-zinc-500" />
                    Call Driver
                </button>
            </motion.div>
        </aside>
    );
}
