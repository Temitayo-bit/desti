"use client";

import { motion } from "framer-motion";
import { Crosshair, Layers } from "lucide-react";
import { type MockTripData } from "../mockData";

export function MapArea({ trip }: { trip: MockTripData }) {
    return (
        <section className="relative flex-1 bg-[#4bbda3] overflow-hidden">
            {/* Background Map Placeholder Pattern */}
            <div 
                className="absolute inset-0 opacity-40 mix-blend-multiply"
                style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M10 10c0-5 5-10 10-10h60c5 0 10 5 10 10v60c0 5-5 10-10 10H20c-5 0-10-5-10-10V10zm50 40c0-5 5-10 10-10h10v20H70c-5 0-10-5-10-10z' fill='none' stroke='%23ffffff' stroke-width='0.5' /%3E%3C/svg%3E")`,
                    backgroundSize: '150px'
                }}
            />
            {/* Additional road lines approximation */}
            <div className="absolute inset-0 opacity-20">
                <svg className="h-full w-full" preserveAspectRatio="none">
                    <path d="M0,50 Q200,300 800,100 T1200,800" fill="none" stroke="white" strokeWidth="3" />
                    <path d="M200,0 Q400,400 100,800" fill="none" stroke="white" strokeWidth="2" />
                    <path d="M1200,200 Q800,500 1000,1000" fill="none" stroke="white" strokeWidth="4" />
                    <path d="M0,800 Q500,700 1200,400" fill="none" stroke="white" strokeWidth="1.5" />
                </svg>
            </div>

            {/* Pickup Marker */}
            <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", delay: 0.5 }}
                className="absolute left-1/4 top-1/2 -translate-x-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-lg"
            >
                <div className="h-3 w-3 rounded-full border-2 border-emerald-600 bg-white" />
            </motion.div>

             {/* Destination Marker */}
             <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", delay: 0.6 }}
                className="absolute right-1/4 top-1/3 -translate-x-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 shadow-lg"
            >
                 <div className="h-2 w-2 rounded-full bg-white" />
            </motion.div>

            {/* Driver Marker */}
            <motion.div 
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", delay: 0.8 }}
                className="absolute left-1/3 top-2/5 flex items-center justify-center"
            >
                <div className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-[#124129] shadow-xl border-2 border-white/20">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 16H9m10 0h1l-1.44-4.32A2 2 0 0 0 16.67 10H7.33a2 2 0 0 0-1.89 1.68L4 16h1" />
                        <path d="M5 16v2a1 1 0 0 0 1 1h1" />
                        <path d="M19 16v2a1 1 0 0 1-1 1h-1" />
                        <path d="M9 19h6" />
                        <circle cx="7.5" cy="16.5" r="1.5" />
                        <circle cx="16.5" cy="16.5" r="1.5" />
                    </svg>
                </div>
            </motion.div>

            {/* Floating ETA Card */}
            <motion.div 
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="absolute right-6 top-6 flex items-center gap-4 rounded-2xl bg-white p-3 shadow-lg"
            >
                <div className="flex h-12 items-center justify-center rounded-xl bg-emerald-100 px-3">
                    <span className="text-xl font-bold text-emerald-800">{trip.eta.minutes} <span className="text-sm font-medium">min</span></span>
                </div>
                <div className="pr-4 flex flex-col">
                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Est. Arrival</span>
                    <span className="text-lg font-bold text-zinc-900">{trip.eta.arrivalTime}</span>
                </div>
            </motion.div>

            {/* Floating Map Controls */}
            <motion.div 
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.7 }}
                className="absolute bottom-8 right-6 flex flex-col gap-3"
            >
                <button className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-zinc-700 shadow-lg hover:bg-zinc-50 active:scale-95 transition-all">
                    <Crosshair size={22} />
                </button>
                <button className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-zinc-700 shadow-lg hover:bg-zinc-50 active:scale-95 transition-all">
                    <Layers size={22} />
                </button>
            </motion.div>
            
            {/* Logo/Watermark */}
            <div className="absolute bottom-6 right-24 opacity-60 text-white pointer-events-none text-right">
                <p className="font-bold tracking-widest uppercase text-xl">Campus Map</p>
                <p className="font-medium text-sm">Safe & Secure</p>
            </div>
        </section>
    );
}
