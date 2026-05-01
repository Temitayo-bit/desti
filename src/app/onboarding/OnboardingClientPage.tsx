"use client";

import { type ChangeEvent, type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
    buildOnboardingPayload,
    canSubmitOnboarding,
    EMPTY_ONBOARDING_FORM_VALUES,
    ONBOARDING_YEAR_OPTIONS,
    toInitialOnboardingFormValues,
    type OnboardingFieldErrors,
    type OnboardingFormValues,
    type OnboardingGenderValue,
    type OnboardingYearValue,
} from "@/lib/onboarding-form";
import { DestiLogo } from "@/components/DestiLogo";
import { invalidateDestiProfileCache } from "@/hooks/use-desti-profile";

interface OnboardingClientPageProps {
    verifiedEmail: string;
}

interface ApiFieldError {
    field?: string;
    message?: string;
}

interface MeResponse {
    localUser?: {
        name?: string | null;
        age?: number | null;
        yearAtStetson?: OnboardingYearValue | null;
        gender?: OnboardingGenderValue | null;
        profilePictureUrl?: string | null;
        onboardingComplete?: boolean | null;
    };
}

const fieldNameMap: Record<string, keyof OnboardingFieldErrors> = {
    name: "name",
    age: "age",
    yearAtStetson: "yearAtStetson",
    gender: "gender",
    profilePicture: "profilePicture",
};

async function parseOnboardingErrorResponse(
    response: Response
): Promise<{
    fieldErrors: OnboardingFieldErrors;
    message: string;
    code: string | null;
}> {
    let payload: unknown = null;

    try {
        payload = await response.json();
    } catch {
        payload = null;
    }

    const fieldErrors: OnboardingFieldErrors = {};
    let message = "Unable to complete onboarding right now. Please try again.";
    let code: string | null = null;

    if (payload && typeof payload === "object") {
        const maybeMessage = (payload as { message?: unknown }).message;
        if (typeof maybeMessage === "string" && maybeMessage.trim()) {
            message = maybeMessage;
        }

        const maybeCode = (payload as { code?: unknown }).code;
        if (typeof maybeCode === "string" && maybeCode.trim()) {
            code = maybeCode;
        }

        const issues = (payload as { fieldErrors?: unknown }).fieldErrors;
        if (Array.isArray(issues)) {
            issues.forEach((issue) => {
                const typedIssue = issue as ApiFieldError;
                if (
                    typeof typedIssue.field === "string" &&
                    typeof typedIssue.message === "string"
                ) {
                    const mappedField = fieldNameMap[typedIssue.field];
                    if (mappedField && !fieldErrors[mappedField]) {
                        fieldErrors[mappedField] = typedIssue.message;
                    }
                }
            });
        }
    }

    return { fieldErrors, message, code };
}

function LoadingCard() {
    return (
        <div className="w-full max-w-md rounded-[2rem] bg-white p-8 shadow-sm">
            <div className="space-y-3">
                <div className="h-5 w-32 animate-pulse rounded-full bg-zinc-100" />
                <div className="h-10 w-3/4 animate-pulse rounded-2xl bg-zinc-100" />
            </div>
            <div className="mt-8 space-y-4">
                <div className="h-14 animate-pulse rounded-2xl bg-zinc-100" />
                <div className="h-14 animate-pulse rounded-2xl bg-zinc-100" />
                <div className="h-14 animate-pulse rounded-2xl bg-zinc-100" />
            </div>
        </div>
    );
}

export function OnboardingClientPage({
    verifiedEmail,
}: OnboardingClientPageProps) {
    const router = useRouter();
    const [formValues, setFormValues] = useState<OnboardingFormValues>(
        EMPTY_ONBOARDING_FORM_VALUES
    );
    const [fieldErrors, setFieldErrors] = useState<OnboardingFieldErrors>({});
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [bootstrapError, setBootstrapError] = useState<string | null>(null);
    const [isBootstrapping, setIsBootstrapping] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [bootstrapToken, setBootstrapToken] = useState(0);

    const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(null);
    const [profilePicturePreview, setProfilePicturePreview] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!isSuccess) {
            return;
        }

        const timeoutId = window.setTimeout(() => {
            router.replace("/dashboard");
        }, 1600);

        return () => window.clearTimeout(timeoutId);
    }, [isSuccess, router]);

    useEffect(() => {
        const controller = new AbortController();
        let cancelled = false;

        async function loadProfile() {
            setIsBootstrapping(true);
            setBootstrapError(null);

            try {
                const response = await fetch("/api/me", {
                    signal: controller.signal,
                });

                if (!response.ok) {
                    const parsed = await parseOnboardingErrorResponse(response);
                    throw new Error(parsed.message);
                }

                const payload = (await response.json()) as MeResponse;
                if (cancelled) {
                    return;
                }

                if (payload.localUser?.onboardingComplete) {
                    router.replace("/dashboard");
                    return;
                }

                setFormValues(
                    toInitialOnboardingFormValues({
                        name: payload.localUser?.name ?? null,
                        age: payload.localUser?.age ?? null,
                        yearAtStetson: payload.localUser?.yearAtStetson ?? null,
                        gender: payload.localUser?.gender ?? null,
                    })
                );

                if (payload.localUser?.profilePictureUrl) {
                    setProfilePictureUrl(payload.localUser.profilePictureUrl);
                    setProfilePicturePreview(payload.localUser.profilePictureUrl);
                }
            } catch (error: unknown) {
                if (controller.signal.aborted || cancelled) {
                    return;
                }

                const message =
                    error instanceof Error
                        ? error.message
                        : "Unable to load your onboarding profile.";
                setBootstrapError(message);
            } finally {
                if (!cancelled) {
                    setIsBootstrapping(false);
                }
            }
        }

        void loadProfile();

        return () => {
            cancelled = true;
            controller.abort();
        };
    }, [bootstrapToken, router]);

    const submitButtonLabel = useMemo(() => {
        if (isSubmitting) {
            return "Saving...";
        }

        return "Continue \u2192";
    }, [isSubmitting]);

    const canSubmit =
        !isSubmitting && !isUploading && Boolean(profilePictureUrl?.trim());

    const handleFileSelect = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const previewUrl = URL.createObjectURL(file);
        setProfilePicturePreview(previewUrl);
        setUploadError(null);
        setFieldErrors((prev) => ({ ...prev, profilePicture: undefined }));
        setIsUploading(true);

        try {
            const formData = new FormData();
            formData.append("file", file);

            const response = await fetch("/api/user/profile-picture", {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                const data = await response.json().catch(() => null);
                const msg =
                    (data as { message?: string } | null)?.message ??
                    "Failed to upload photo. Please try again.";
                setUploadError(msg);
                setProfilePicturePreview(null);
                URL.revokeObjectURL(previewUrl);
                return;
            }

            const data = (await response.json()) as { profilePictureUrl: string };
            setProfilePictureUrl(data.profilePictureUrl);
            setProfilePicturePreview(data.profilePictureUrl);
            invalidateDestiProfileCache();
            URL.revokeObjectURL(previewUrl);
        } catch {
            setUploadError("Network error while uploading photo.");
            setProfilePicturePreview(null);
            URL.revokeObjectURL(previewUrl);
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
    }, []);

    function updateField<K extends keyof OnboardingFormValues>(
        field: K,
        value: OnboardingFormValues[K]
    ) {
        setFormValues((previous) => ({ ...previous, [field]: value }));
        setFieldErrors((previous) => ({ ...previous, [field]: undefined }));
    }

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (!canSubmitOnboarding(isSubmitting) || isBootstrapping) {
            return;
        }

        setSubmitError(null);
        const buildResult = buildOnboardingPayload(formValues);

        const nextFieldErrors = { ...buildResult.fieldErrors };
        if (!profilePictureUrl?.trim()) {
            nextFieldErrors.profilePicture =
                "A profile photo is required. Upload a clear picture of yourself.";
        }
        setFieldErrors(nextFieldErrors);

        if (!buildResult.payload || Object.keys(nextFieldErrors).length > 0) {
            setSubmitError(
                buildResult.submitError ??
                    "Please fix the highlighted fields and try again."
            );
            return;
        }

        try {
            setIsSubmitting(true);

            const response = await fetch("/api/user/onboarding", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(buildResult.payload),
            });

            if (response.ok) {
                setIsSuccess(true);
                return;
            }

            const parsed = await parseOnboardingErrorResponse(response);
            if (response.status === 409 || parsed.code === "ONBOARDING_ALREADY_COMPLETED") {
                router.replace("/dashboard");
                return;
            }

            setFieldErrors((previous) => ({ ...previous, ...parsed.fieldErrors }));
            setSubmitError(parsed.message);
        } catch (error: unknown) {
            const message =
                error instanceof Error
                    ? error.message
                    : "Network error while completing onboarding.";
            setSubmitError(message);
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.08),_transparent_60%),linear-gradient(180deg,_#f8fafc_0%,_#f1f5f9_100%)] px-4 py-8 md:px-6 md:py-12 font-sans flex flex-col items-center justify-center">
            <div className="mx-auto flex flex-col items-center justify-center w-full max-w-md">
                
                {/* Logo Section */}
                <div className="mb-8 flex flex-col items-center text-center">
                    <div className="mb-3 flex justify-center">
                        <DestiLogo size="lg" variant="moss" />
                    </div>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-zinc-600">
                        Stetson University Ride-Share
                    </p>
                </div>

                <AnimatePresence mode="wait">
                    {isSuccess ? (
                        <motion.section
                            key="onboarding-success"
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.98 }}
                            className="w-full rounded-[2rem] bg-white p-10 text-center shadow-sm"
                        >
                            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                                <svg
                                    width="42"
                                    height="42"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <path d="m5 12 5 5L20 7" />
                                </svg>
                            </div>
                            <h2 className="mt-6 text-3xl font-bold tracking-tight text-zinc-900">
                                You&apos;re all set
                            </h2>
                            <p className="mt-3 text-zinc-500">
                                Redirecting you to the dashboard...
                            </p>
                        </motion.section>
                    ) : isBootstrapping ? (
                        <motion.div
                            key="onboarding-loading"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="w-full"
                        >
                            <LoadingCard />
                        </motion.div>
                    ) : (
                        <motion.section
                            key="onboarding-form"
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            className="w-full rounded-[2.5rem] bg-white p-8 md:p-10 shadow-sm"
                        >
                            <header className="mb-8">
                                <h2 className="text-2xl font-bold tracking-tight text-zinc-900">
                                    Create your profile
                                </h2>
                                <p className="mt-2 text-sm text-zinc-600 leading-relaxed">
                                    Join the Hatter commute. We just need a few details to get you
                                    started.
                                </p>
                            </header>

                            {bootstrapError ? (
                                <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
                                    <p>{bootstrapError}</p>
                                    <button
                                        type="button"
                                        onClick={() => setBootstrapToken((value) => value + 1)}
                                        className="mt-3 rounded-full border border-red-200 bg-white px-4 py-2 font-semibold text-red-700 transition-colors hover:bg-red-100"
                                    >
                                        Retry
                                    </button>
                                </div>
                            ) : null}

                            <form onSubmit={handleSubmit} className="space-y-6">
                                {submitError ? (
                                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                                        {submitError}
                                    </div>
                                ) : null}

                                {/* Profile photo — required */}
                                <div className="flex flex-col items-center pb-2">
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={isUploading || isSubmitting}
                                        className="group relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-zinc-200 bg-zinc-50 transition-colors hover:border-[#146c43] hover:bg-emerald-50/50 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {profilePicturePreview ? (
                                            <>
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img
                                                    src={profilePicturePreview}
                                                    alt="Profile preview"
                                                    className="h-full w-full object-cover"
                                                />
                                                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                                                        <circle cx="12" cy="13" r="4" />
                                                    </svg>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="flex flex-col items-center text-zinc-400 group-hover:text-[#146c43] transition-colors">
                                                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                                                    <circle cx="12" cy="13" r="4" />
                                                </svg>
                                            </div>
                                        )}
                                        {isUploading ? (
                                            <div className="absolute inset-0 flex items-center justify-center bg-white/80">
                                                <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#146c43] border-t-transparent" />
                                            </div>
                                        ) : null}
                                    </button>
                                    <span className="mt-2 text-xs font-medium uppercase tracking-wider text-zinc-600">
                                        Profile photo — required
                                    </span>
                                    <span className="mt-1 max-w-[260px] text-center text-[0.7rem] leading-snug text-zinc-500">
                                        Take a clear, recent photo of yourself. Other students see
                                        this on rides and messages.
                                    </span>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*"
                                        capture="environment"
                                        onChange={handleFileSelect}
                                        className="hidden"
                                    />
                                    {uploadError ? (
                                        <p className="mt-2 text-xs text-red-600">{uploadError}</p>
                                    ) : null}
                                    {fieldErrors.profilePicture ? (
                                        <p className="mt-2 text-xs text-red-600">
                                            {fieldErrors.profilePicture}
                                        </p>
                                    ) : null}
                                </div>

                                <div>
                                    <label
                                        htmlFor="onboarding-name"
                                        className="mb-1.5 block text-xs font-bold tracking-wider text-zinc-800 uppercase"
                                    >
                                        Full Name
                                    </label>
                                    <div className="relative">
                                        <input
                                            id="onboarding-name"
                                            type="text"
                                            value={formValues.name}
                                            onChange={(event) =>
                                                updateField("name", event.target.value)
                                            }
                                            disabled={isSubmitting}
                                            className="w-full rounded-xl bg-zinc-50 px-4 py-3.5 pr-10 text-sm text-zinc-900 border-none ring-1 ring-inset ring-zinc-200 outline-none transition-all focus:bg-white focus:ring-2 focus:ring-inset focus:ring-[#146c43]"
                                            placeholder="John Hatter"
                                        />
                                        <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-zinc-300">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                                            </svg>
                                        </div>
                                    </div>
                                    {fieldErrors.name ? (
                                        <p className="mt-1.5 text-xs text-red-600">
                                            {fieldErrors.name}
                                        </p>
                                    ) : null}
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label
                                            htmlFor="onboarding-year"
                                            className="mb-1.5 block text-xs font-bold tracking-wider text-zinc-800 uppercase"
                                        >
                                            Academic Year
                                        </label>
                                        <div className="relative">
                                            <select
                                                id="onboarding-year"
                                                value={formValues.yearAtStetson}
                                                onChange={(event) =>
                                                    updateField(
                                                        "yearAtStetson",
                                                        event.target.value as OnboardingFormValues["yearAtStetson"]
                                                    )
                                                }
                                                disabled={isSubmitting}
                                                className="w-full appearance-none rounded-xl bg-zinc-50 px-4 py-3.5 pr-10 text-sm text-zinc-900 border-none ring-1 ring-inset ring-zinc-200 outline-none transition-all focus:bg-white focus:ring-2 focus:ring-inset focus:ring-[#146c43]"
                                            >
                                                <option value="" disabled>Select</option>
                                                {ONBOARDING_YEAR_OPTIONS.map((option) => (
                                                    <option key={option.value} value={option.value}>
                                                        {option.label}
                                                    </option>
                                                ))}
                                            </select>
                                            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-zinc-400">
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <polyline points="6 9 12 15 18 9"></polyline>
                                                </svg>
                                            </div>
                                        </div>
                                        {fieldErrors.yearAtStetson ? (
                                            <p className="mt-1.5 text-xs text-red-600">
                                                {fieldErrors.yearAtStetson}
                                            </p>
                                        ) : null}
                                    </div>

                                    <div>
                                        <label
                                            htmlFor="onboarding-age"
                                            className="mb-1.5 block text-xs font-bold tracking-wider text-zinc-800 uppercase"
                                        >
                                            Age
                                        </label>
                                        <input
                                            id="onboarding-age"
                                            type="number"
                                            min={16}
                                            max={100}
                                            inputMode="numeric"
                                            value={formValues.age}
                                            onChange={(event) =>
                                                updateField("age", event.target.value)
                                            }
                                            disabled={isSubmitting}
                                            className="w-full rounded-xl bg-zinc-50 px-4 py-3.5 text-sm text-zinc-900 border-none ring-1 ring-inset ring-zinc-200 outline-none transition-all focus:bg-white focus:ring-2 focus:ring-inset focus:ring-[#146c43]"
                                            placeholder="20"
                                        />
                                        {fieldErrors.age ? (
                                            <p className="mt-1.5 text-xs text-red-600">
                                                {fieldErrors.age}
                                            </p>
                                        ) : null}
                                    </div>
                                </div>

                                <div>
                                    <label className="mb-1.5 block text-xs font-bold tracking-wider text-zinc-800 uppercase">
                                        Gender Identity
                                    </label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {[
                                            { value: "MALE", label: "MALE", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="10" cy="14" r="5"/><line x1="13.54" y1="10.46" x2="20" y2="4"/><polyline points="15 4 20 4 20 9"/></svg> },
                                            { value: "FEMALE", label: "FEMALE", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="10" r="5"/><line x1="12" y1="15" x2="12" y2="22"/><line x1="9" y1="19" x2="15" y2="19"/></svg> },
                                            { value: "OTHER", label: "OTHER", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><line x1="12" y1="8" x2="12" y2="3"/><polyline points="15 6 12 3 9 6"/><line x1="8" y1="12" x2="3" y2="12"/><polyline points="6 9 3 12 6 15"/><line x1="12" y1="16" x2="12" y2="21"/><polyline points="9 18 12 21 15 18"/><line x1="16" y1="12" x2="21" y2="12"/><polyline points="18 9 21 12 18 15"/></svg> }
                                        ].map((g) => (
                                            <button
                                                key={g.value}
                                                type="button"
                                                onClick={() => updateField("gender", g.value as OnboardingFormValues["gender"])}
                                                className={`flex flex-col items-center justify-center gap-1.5 rounded-xl py-3 text-xs font-bold transition-all ${
                                                    formValues.gender === g.value
                                                        ? "bg-[#146c43] text-white ring-1 ring-[#146c43]"
                                                        : "bg-zinc-50 text-zinc-500 ring-1 ring-inset ring-zinc-200 hover:bg-zinc-100"
                                                }`}
                                            >
                                                {g.icon}
                                                {g.label}
                                            </button>
                                        ))}
                                    </div>
                                    {fieldErrors.gender ? (
                                        <p className="mt-1.5 text-xs text-red-600">
                                            {fieldErrors.gender}
                                        </p>
                                    ) : null}
                                </div>

                                <button
                                    type="submit"
                                    disabled={!canSubmit}
                                    className="w-full mt-4 rounded-xl bg-[#146c43] px-4 py-3.5 text-sm font-semibold text-white transition-all hover:bg-[#105a36] disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500 flex items-center justify-center gap-2"
                                >
                                    {submitButtonLabel}
                                </button>
                                
                                <p className="mt-4 text-center text-[10px] text-zinc-400">
                                    By continuing, you agree to our <span className="font-semibold text-[#146c43]">Safety Standards</span> and Stetson University&apos;s code of conduct.
                                </p>
                            </form>
                        </motion.section>
                    )}
                </AnimatePresence>
                
                <div className="mt-10 flex items-center gap-4 text-zinc-400 text-[10px] font-bold tracking-[0.2em]">
                    <div className="h-px w-8 bg-zinc-300"></div>
                    <span>PRO DEO ET VERITATE</span>
                    <div className="h-px w-8 bg-zinc-300"></div>
                </div>
            </div>
        </main>
    );
}
