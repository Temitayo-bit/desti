"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import type { OnboardingGenderValue, OnboardingYearValue } from "@/lib/onboarding-form";
import {
    ONBOARDING_GENDER_OPTIONS,
    ONBOARDING_MAX_AGE,
    ONBOARDING_MIN_AGE,
    ONBOARDING_YEAR_OPTIONS,
} from "@/lib/onboarding-form";
import { ProfilePictureUpload } from "./ProfilePictureUpload";

const PROFILE_BIO_MAX_LENGTH = 500;

export interface EditProfileModalInitial {
    name: string;
    age: number | null;
    yearAtStetson: OnboardingYearValue | null;
    gender: OnboardingGenderValue | null;
    bio: string | null;
    profilePictureUrl: string | null;
}

interface EditProfileModalProps {
    open: boolean;
    onClose: () => void;
    initial: EditProfileModalInitial;
}

export function EditProfileModal({ open, onClose, initial }: EditProfileModalProps) {
    const router = useRouter();
    const [name, setName] = useState(initial.name);
    const [age, setAge] = useState(
        typeof initial.age === "number" ? String(initial.age) : ""
    );
    const [yearAtStetson, setYearAtStetson] = useState<OnboardingYearValue | "">(
        initial.yearAtStetson ?? ""
    );
    const [gender, setGender] = useState<OnboardingGenderValue | "">(
        initial.gender ?? ""
    );
    const [bio, setBio] = useState(initial.bio ?? "");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!open) return;
        setName(initial.name);
        setAge(typeof initial.age === "number" ? String(initial.age) : "");
        setYearAtStetson(initial.yearAtStetson ?? "");
        setGender(initial.gender ?? "");
        setBio(initial.bio ?? "");
        setError(null);
    }, [open, initial]);

    useEffect(() => {
        if (!open) return;
        function onKey(e: KeyboardEvent) {
            if (e.key === "Escape") onClose();
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);

        const trimmedName = name.trim();
        const ageNum = Number.parseInt(age, 10);
        if (trimmedName.length < 2 || trimmedName.length > 80) {
            setError("Name must be between 2 and 80 characters.");
            return;
        }
        if (
            !Number.isInteger(ageNum) ||
            ageNum < ONBOARDING_MIN_AGE ||
            ageNum > ONBOARDING_MAX_AGE
        ) {
            setError(`Age must be between ${ONBOARDING_MIN_AGE} and ${ONBOARDING_MAX_AGE}.`);
            return;
        }
        if (!yearAtStetson || !gender) {
            setError("Please select your year and gender.");
            return;
        }
        const bioTrimmed = bio.trim();
        if (bioTrimmed.length > PROFILE_BIO_MAX_LENGTH) {
            setError(`Bio must be ${PROFILE_BIO_MAX_LENGTH} characters or fewer.`);
            return;
        }

        try {
            setSubmitting(true);
            const res = await fetch("/api/user/profile", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: trimmedName,
                    age: ageNum,
                    yearAtStetson,
                    gender,
                    bio: bioTrimmed.length > 0 ? bioTrimmed : null,
                }),
            });

            const data = await res.json().catch(() => null);
            if (!res.ok) {
                const msg =
                    typeof data?.message === "string"
                        ? data.message
                        : "Could not save your profile.";
                setError(msg);
                return;
            }

            router.refresh();
            onClose();
        } catch {
            setError("Something went wrong. Try again.");
        } finally {
            setSubmitting(false);
        }
    }

    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
            role="presentation"
            onClick={onClose}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="edit-profile-title"
                className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-zinc-200 bg-white shadow-xl sm:rounded-2xl"
                onClick={(ev) => ev.stopPropagation()}
            >
                <div className="sticky top-0 flex items-center justify-between border-b border-zinc-100 bg-white px-5 py-4">
                    <h2
                        id="edit-profile-title"
                        className="text-lg font-bold tracking-tight text-zinc-900"
                    >
                        Edit profile
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
                        aria-label="Close"
                    >
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5 px-5 py-5">
                    <div>
                        <p className="text-sm font-medium text-zinc-700">Profile photo</p>
                        <div className="mt-2 rounded-xl border border-zinc-100 bg-zinc-50/80 px-4 py-3">
                            <ProfilePictureUpload currentUrl={initial.profilePictureUrl} />
                        </div>
                    </div>

                    <div>
                        <label htmlFor="edit-name" className="text-sm font-medium text-zinc-700">
                            Full name
                        </label>
                        <input
                            id="edit-name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="mt-1.5 w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm text-zinc-900 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/25"
                            autoComplete="name"
                            maxLength={80}
                        />
                    </div>

                    <div>
                        <label htmlFor="edit-bio" className="text-sm font-medium text-zinc-700">
                            Bio / tagline
                        </label>
                        <textarea
                            id="edit-bio"
                            value={bio}
                            onChange={(e) => setBio(e.target.value)}
                            placeholder="A short line about you — routes you often take, clubs, or how you like to ride."
                            rows={3}
                            maxLength={PROFILE_BIO_MAX_LENGTH}
                            className="mt-1.5 w-full resize-y rounded-xl border border-zinc-200 px-3 py-2.5 text-sm text-zinc-900 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/25"
                        />
                        <p className="mt-1 text-xs text-zinc-400 tabular-nums">
                            {bio.trim().length}/{PROFILE_BIO_MAX_LENGTH}
                        </p>
                    </div>

                    <div>
                        <label htmlFor="edit-year" className="text-sm font-medium text-zinc-700">
                            Academic year
                        </label>
                        <select
                            id="edit-year"
                            value={yearAtStetson}
                            onChange={(e) =>
                                setYearAtStetson(e.target.value as OnboardingYearValue | "")
                            }
                            className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/25"
                        >
                            <option value="">Select year</option>
                            {ONBOARDING_YEAR_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <label htmlFor="edit-age" className="text-sm font-medium text-zinc-700">
                                Age
                            </label>
                            <input
                                id="edit-age"
                                type="number"
                                min={ONBOARDING_MIN_AGE}
                                max={ONBOARDING_MAX_AGE}
                                value={age}
                                onChange={(e) => setAge(e.target.value)}
                                className="mt-1.5 w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm text-zinc-900 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/25"
                            />
                        </div>
                        <div>
                            <label
                                htmlFor="edit-gender"
                                className="text-sm font-medium text-zinc-700"
                            >
                                Gender
                            </label>
                            <select
                                id="edit-gender"
                                value={gender}
                                onChange={(e) =>
                                    setGender(e.target.value as OnboardingGenderValue | "")
                                }
                                className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/25"
                            >
                                <option value="">Select</option>
                                {ONBOARDING_GENDER_OPTIONS.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {error ? (
                        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                            {error}
                        </p>
                    ) : null}

                    <div className="flex flex-col-reverse gap-2 border-t border-zinc-100 pt-4 sm:flex-row sm:justify-end">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="rounded-xl bg-[#0d3d2e] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0a3026] disabled:opacity-50"
                        >
                            {submitting ? "Saving…" : "Save changes"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
