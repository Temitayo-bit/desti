"use client";

import { useState, useRef, type ChangeEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { ONBOARDING_YEAR_OPTIONS } from "@/lib/onboarding-form";

export function EditProfileButton({ user, variant = "icon" }: { user: any; variant?: "icon" | "footer" }) {
    const [isOpen, setIsOpen] = useState(false);
    const router = useRouter();

    const [formValues, setFormValues] = useState({
        name: user.name || "",
        bio: user.bio || "",
        yearAtStetson: user.yearAtStetson || "",
        age: user.age?.toString() || "",
        gender: user.gender || "",
    });

    const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(user.profilePictureUrl || null);
    const [profilePicturePreview, setProfilePicturePreview] = useState<string | null>(user.profilePictureUrl || null);
    const [isUploading, setIsUploading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const previewUrl = URL.createObjectURL(file);
        setProfilePicturePreview(previewUrl);
        setIsUploading(true);
        setError(null);

        try {
            const formData = new FormData();
            formData.append("file", file);

            const response = await fetch("/api/user/profile-picture", {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                throw new Error("Failed to upload photo");
            }

            const data = await response.json();
            setProfilePictureUrl(data.profilePictureUrl);
        } catch {
            setError("Failed to upload photo.");
            setProfilePicturePreview(profilePictureUrl);
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);

        try {
            const payload = {
                name: formValues.name,
                bio: formValues.bio.trim() || null,
                yearAtStetson: formValues.yearAtStetson,
                age: parseInt(formValues.age, 10),
                gender: formValues.gender,
            };

            const response = await fetch("/api/user/profile", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.message || "Failed to update profile.");
            }

            setIsOpen(false);
            router.refresh();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            {variant === "footer" ? (
                <button
                    onClick={() => setIsOpen(true)}
                    className="rounded-xl bg-[#0d3d2e] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#0a3026]"
                >
                    Edit Profile Details
                </button>
            ) : (
                <button
                    onClick={() => setIsOpen(true)}
                    className="absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-50 text-[#0d3d2e] transition-colors hover:bg-emerald-50"
                    aria-label="Edit Profile"
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                    </svg>
                </button>
            )}

            <AnimatePresence>
                {isOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsOpen(false)}
                            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl"
                        >
                            <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
                                <h3 className="text-lg font-bold text-zinc-900">Edit Profile Details</h3>
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="p-2 text-zinc-400 hover:text-zinc-600 rounded-full hover:bg-zinc-50"
                                >
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                                </button>
                            </div>
                            
                            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[70vh] space-y-6">
                                {error && (
                                    <div className="p-3 text-sm text-red-700 bg-red-50 rounded-xl border border-red-100">
                                        {error}
                                    </div>
                                )}

                                <div className="flex flex-col items-center gap-4">
                                    <div className="relative">
                                        {profilePicturePreview ? (
                                            <img src={profilePicturePreview} alt="Preview" className="h-24 w-24 rounded-full object-cover border-4 border-white shadow-sm" />
                                        ) : (
                                            <div className="h-24 w-24 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-400">
                                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                                            </div>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={isUploading}
                                            className="absolute bottom-0 right-0 p-1.5 rounded-full bg-emerald-600 text-white shadow-sm border-2 border-white hover:bg-emerald-500 transition-colors"
                                        >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
                                        </button>
                                        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 mb-1.5">Full Name</label>
                                    <input
                                        type="text"
                                        value={formValues.name}
                                        onChange={(e) => setFormValues(prev => ({ ...prev, name: e.target.value }))}
                                        className="w-full rounded-xl bg-zinc-50 border-none px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-600"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 mb-1.5">Bio / Tagline</label>
                                    <input
                                        type="text"
                                        value={formValues.bio}
                                        onChange={(e) => setFormValues(prev => ({ ...prev, bio: e.target.value }))}
                                        maxLength={100}
                                        className="w-full rounded-xl bg-zinc-50 border-none px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-600"
                                        placeholder="e.g. Always looking for a ride to Orlando..."
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 mb-1.5">Year at Stetson</label>
                                        <select
                                            value={formValues.yearAtStetson}
                                            onChange={(e) => setFormValues(prev => ({ ...prev, yearAtStetson: e.target.value }))}
                                            className="w-full rounded-xl bg-zinc-50 border-none px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-600"
                                            required
                                        >
                                            <option value="" disabled>Select</option>
                                            {ONBOARDING_YEAR_OPTIONS.map(opt => (
                                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 mb-1.5">Age</label>
                                        <input
                                            type="number"
                                            min={16}
                                            max={100}
                                            value={formValues.age}
                                            onChange={(e) => setFormValues(prev => ({ ...prev, age: e.target.value }))}
                                            className="w-full rounded-xl bg-zinc-50 border-none px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-600"
                                            required
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 mb-1.5">Gender</label>
                                    <div className="flex gap-2">
                                        {["MALE", "FEMALE", "OTHER"].map((g) => (
                                            <button
                                                key={g}
                                                type="button"
                                                onClick={() => setFormValues(prev => ({ ...prev, gender: g }))}
                                                className={`flex-1 rounded-xl py-2.5 text-xs font-bold ${
                                                    formValues.gender === g
                                                        ? "bg-emerald-600 text-white"
                                                        : "bg-zinc-50 text-zinc-600 hover:bg-zinc-100"
                                                }`}
                                            >
                                                {g}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-zinc-100 flex justify-end gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setIsOpen(false)}
                                        className="px-5 py-2.5 rounded-xl text-sm font-semibold text-zinc-600 hover:bg-zinc-50"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSubmitting || isUploading}
                                        className="px-5 py-2.5 rounded-xl bg-emerald-600 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                                    >
                                        {isSubmitting ? "Saving..." : "Save Changes"}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </>
    );
}
