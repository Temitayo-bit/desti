"use client";

import { Mail, ShieldCheck, Save } from "lucide-react";

interface ProfileHeaderProps {
    name: string;
    email: string;
    verifiedStudent: boolean;
    isDirty: boolean;
    onSave: () => void;
}

export function ProfileHeader({ name, email, verifiedStudent, isDirty, onSave }: ProfileHeaderProps) {
    return (
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
                <h1 className="text-4xl font-extrabold tracking-tight text-zinc-900 md:text-5xl">
                    {name}
                </h1>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-700 px-3.5 py-1.5 text-xs font-semibold text-white">
                        <Mail size={14} />
                        {email}
                    </span>
                    {verifiedStudent && (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-zinc-700">
                            <ShieldCheck size={14} className="text-emerald-600" />
                            Verified Student
                        </span>
                    )}
                </div>
            </div>

            <button
                type="button"
                onClick={onSave}
                className={`inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold shadow-md transition-all active:scale-[0.97] ${
                    isDirty
                        ? "bg-emerald-700 text-white hover:bg-emerald-800"
                        : "bg-emerald-700/80 text-white/90 cursor-default"
                }`}
            >
                <Save size={16} />
                Save Changes
            </button>
        </div>
    );
}
