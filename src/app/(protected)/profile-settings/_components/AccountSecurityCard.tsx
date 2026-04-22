"use client";

import { Lock, Bell, ChevronRight } from "lucide-react";
import { type NotificationSettings } from "../mockData";

interface AccountSecurityCardProps {
    notifications: NotificationSettings;
    onToggleNotification: (key: keyof NotificationSettings) => void;
}

function ToggleSwitch({
    checked,
    onChange,
    label,
}: {
    checked: boolean;
    onChange: () => void;
    label: string;
}) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={label}
            onClick={onChange}
            className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 ${
                checked ? "bg-emerald-600" : "bg-zinc-300"
            }`}
        >
            <span
                className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-200 ${
                    checked ? "translate-x-6" : "translate-x-1"
                }`}
            />
        </button>
    );
}

const NOTIFICATION_LABELS: Record<keyof NotificationSettings, string> = {
    rideRequests: "Ride Requests",
    chatMessages: "Chat Messages",
    promotions: "Promotions",
};

export function AccountSecurityCard({
    notifications,
    onToggleNotification,
}: AccountSecurityCardProps) {
    return (
        <article className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold tracking-tight text-zinc-900 mb-6">
                Account Security
            </h2>

            {/* Change Password */}
            <button
                type="button"
                className="flex w-full items-center justify-between rounded-xl px-4 py-3.5 text-left transition-colors hover:bg-zinc-50"
            >
                <div className="flex items-center gap-3">
                    <Lock size={18} className="text-zinc-500" />
                    <span className="text-sm font-semibold text-zinc-900">Change Password</span>
                </div>
                <ChevronRight size={18} className="text-zinc-400" />
            </button>

            <div className="my-3 border-t border-zinc-100" />

            {/* Notifications */}
            <div className="px-4">
                <div className="flex items-center gap-2 mb-4">
                    <Bell size={18} className="text-zinc-500" />
                    <span className="text-sm font-semibold text-zinc-900">Notifications</span>
                </div>

                <div className="space-y-4">
                    {(Object.keys(NOTIFICATION_LABELS) as (keyof NotificationSettings)[]).map(
                        (key) => (
                            <div key={key} className="flex items-center justify-between">
                                <span className="text-sm text-zinc-600">
                                    {NOTIFICATION_LABELS[key]}
                                </span>
                                <ToggleSwitch
                                    checked={notifications[key]}
                                    onChange={() => onToggleNotification(key)}
                                    label={`Toggle ${NOTIFICATION_LABELS[key]}`}
                                />
                            </div>
                        )
                    )}
                </div>
            </div>
        </article>
    );
}
