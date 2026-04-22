"use client";

import { SquarePen } from "lucide-react";

interface PersonalInfoCardProps {
    name: string;
    phone: string;
    bio: string;
    onNameChange: (v: string) => void;
    onPhoneChange: (v: string) => void;
    onBioChange: (v: string) => void;
}

export function PersonalInfoCard({
    name,
    phone,
    bio,
    onNameChange,
    onPhoneChange,
    onBioChange,
}: PersonalInfoCardProps) {
    return (
        <article className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold tracking-tight text-zinc-900">
                    Personal Information
                </h2>
                <button
                    type="button"
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
                    aria-label="Edit personal information"
                >
                    <SquarePen size={18} />
                </button>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                    <label htmlFor="profile-name" className="text-sm font-semibold text-zinc-600">
                        Full Name
                    </label>
                    <input
                        id="profile-name"
                        type="text"
                        value={name}
                        onChange={(e) => onNameChange(e.target.value)}
                        className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-base font-medium text-zinc-900 outline-none transition-colors focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                    />
                </div>
                <div className="flex flex-col gap-1.5">
                    <label htmlFor="profile-phone" className="text-sm font-semibold text-zinc-600">
                        Phone Number
                    </label>
                    <input
                        id="profile-phone"
                        type="tel"
                        value={phone}
                        onChange={(e) => onPhoneChange(e.target.value)}
                        className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-base font-medium text-zinc-900 outline-none transition-colors focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                    />
                </div>
            </div>

            <div className="mt-5 flex flex-col gap-1.5">
                <label htmlFor="profile-bio" className="text-sm font-semibold text-zinc-600">
                    Bio
                </label>
                <textarea
                    id="profile-bio"
                    value={bio}
                    onChange={(e) => onBioChange(e.target.value)}
                    rows={3}
                    className="resize-none rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-base font-medium leading-relaxed text-zinc-900 outline-none transition-colors focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                />
            </div>
        </article>
    );
}
