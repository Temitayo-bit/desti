"use client";

import { type ChangeEvent, type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
    buildOnboardingPayload,
    canSubmitOnboarding,
    EMPTY_ONBOARDING_FORM_VALUES,
    ONBOARDING_GENDER_OPTIONS,
    ONBOARDING_YEAR_OPTIONS,
    toInitialOnboardingFormValues,
    type OnboardingFieldErrors,
    type OnboardingFormValues,
    type OnboardingGenderValue,
    type OnboardingYearValue,
} from "@/lib/onboarding-form";

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
        <section className="w-full max-w-xl rounded-[2rem] border border-zinc-200 bg-white p-8 shadow-sm">
            <div className="space-y-3">
                <div className="h-5 w-32 animate-pulse rounded-full bg-zinc-100" />
                <div className="h-10 w-3/4 animate-pulse rounded-2xl bg-zinc-100" />
                <div className="h-4 w-full animate-pulse rounded-full bg-zinc-100" />
                <div className="h-4 w-5/6 animate-pulse rounded-full bg-zinc-100" />
            </div>
            <div className="mt-8 space-y-4">
                <div className="h-14 animate-pulse rounded-2xl bg-zinc-100" />
                <div className="h-14 animate-pulse rounded-2xl bg-zinc-100" />
                <div className="h-14 animate-pulse rounded-2xl bg-zinc-100" />
                <div className="h-14 animate-pulse rounded-2xl bg-zinc-100" />
            </div>
        </section>
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

        return "Complete onboarding";
    }, [isSubmitting]);

    const canSubmit = !isSubmitting && !isUploading;

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
        const combinedErrors = { ...buildResult.fieldErrors };

        setFieldErrors(combinedErrors);

        if (!buildResult.payload) {
            setSubmitError(
                buildResult.submitError ?? "Please fix the highlighted fields and try again."
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
        <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.16),_transparent_40%),linear-gradient(180deg,_#f8fafc_0%,_#eef6f1_100%)] px-4 py-8 md:px-6 md:py-12">
            <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl items-center justify-center">
                <AnimatePresence mode="wait">
                    {isSuccess ? (
                        <motion.section
                            key="onboarding-success"
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.98 }}
                            className="w-full max-w-xl rounded-[2rem] border border-zinc-200 bg-white p-10 text-center shadow-sm"
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
                            <h1 className="mt-6 text-3xl font-bold tracking-tight text-zinc-900">
                                You&apos;re all set
                            </h1>
                            <p className="mt-3 text-zinc-500">
                                Finishing your Desti setup now. Redirecting you to the dashboard...
                            </p>
                        </motion.section>
                    ) : isBootstrapping ? (
                        <motion.div
                            key="onboarding-loading"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                        >
                            <LoadingCard />
                        </motion.div>
                    ) : (
                        <motion.section
                            key="onboarding-form"
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            className="grid w-full max-w-5xl gap-6 md:grid-cols-[1.05fr_1fr]"
                        >
                            <article className="rounded-[2rem] border border-emerald-100 bg-emerald-950 px-7 py-8 text-white shadow-sm">
                                <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-sm font-medium text-emerald-100">
                                    <span className="flex h-2 w-2 rounded-full bg-emerald-300" />
                                    Desti onboarding
                                </div>
                                <h1 className="mt-6 text-4xl font-bold tracking-tight">
                                    Finish setting up your rider profile
                                </h1>
                                <p className="mt-4 text-base leading-7 text-emerald-50/85">
                                    We only ask for the basics we need to keep Desti limited
                                    to verified Stetson students and make ride coordination
                                    smoother from your first session.
                                </p>

                                <div className="mt-8 rounded-[1.5rem] border border-white/10 bg-white/10 p-5">
                                    <p className="text-sm font-semibold text-emerald-100">
                                        Verified Stetson email
                                    </p>
                                    <p className="mt-2 break-all text-lg font-semibold text-white">
                                        {verifiedEmail}
                                    </p>
                                    <p className="mt-2 text-sm leading-6 text-emerald-50/75">
                                        This email stays tied to your account and is not edited here.
                                    </p>
                                </div>
                            </article>

                            <article className="rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-sm md:p-8">
                                <header>
                                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">
                                        First-time setup
                                    </p>
                                    <h2 className="mt-2 text-3xl font-bold tracking-tight text-zinc-900">
                                        Tell us about yourself
                                    </h2>
                                    <p className="mt-3 text-sm leading-6 text-zinc-500">
                                        These details are required once before you can browse,
                                        post, and message in Desti.
                                    </p>
                                </header>

                                {bootstrapError ? (
                                    <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
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

                                <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
                                    {submitError ? (
                                        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                                            {submitError}
                                        </div>
                                    ) : null}

                                    <div>
                                        <label className="mb-2 block text-sm font-semibold text-emerald-800">
                                            Profile picture <span className="text-red-500">*</span>
                                        </label>
                                        <div className="flex items-center gap-4">
                                            <button
                                                type="button"
                                                onClick={() => fileInputRef.current?.click()}
                                                disabled={isUploading || isSubmitting}
                                                className="group relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-zinc-300 bg-zinc-50 transition-colors hover:border-emerald-400 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
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
                                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                                                                <circle cx="12" cy="13" r="4" />
                                                            </svg>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400 transition-colors group-hover:text-emerald-600">
                                                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                                                        <circle cx="12" cy="13" r="4" />
                                                    </svg>
                                                )}
                                                {isUploading ? (
                                                    <div className="absolute inset-0 flex items-center justify-center bg-white/80">
                                                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
                                                    </div>
                                                ) : null}
                                            </button>
                                            <div className="min-w-0">
                                                <p className="text-sm text-zinc-600">
                                                    {profilePictureUrl
                                                        ? "Photo uploaded. Click to change."
                                                        : "Click to upload a photo."}
                                                </p>
                                                <p className="mt-1 text-xs text-zinc-400">
                                                    JPEG, PNG, or WebP. Max 5 MB.
                                                </p>
                                            </div>
                                        </div>
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept="image/jpeg,image/png,image/webp"
                                            onChange={handleFileSelect}
                                            className="hidden"
                                        />
                                        {uploadError ? (
                                            <p className="mt-1 text-sm text-red-600">{uploadError}</p>
                                        ) : null}
                                        {fieldErrors.profilePicture ? (
                                            <p className="mt-1 text-sm text-red-600">
                                                {fieldErrors.profilePicture}
                                            </p>
                                        ) : null}
                                    </div>

                                    <div>
                                        <label
                                            htmlFor="onboarding-name"
                                            className="mb-2 block text-sm font-semibold text-emerald-800"
                                        >
                                            Full name
                                        </label>
                                        <input
                                            id="onboarding-name"
                                            type="text"
                                            value={formValues.name}
                                            onChange={(event) =>
                                                updateField("name", event.target.value)
                                            }
                                            disabled={isSubmitting}
                                            className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-zinc-900 outline-none transition-colors focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                                            placeholder="Enter your full name"
                                        />
                                        {fieldErrors.name ? (
                                            <p className="mt-1 text-sm text-red-600">
                                                {fieldErrors.name}
                                            </p>
                                        ) : null}
                                    </div>

                                    <div>
                                        <label
                                            htmlFor="onboarding-age"
                                            className="mb-2 block text-sm font-semibold text-emerald-800"
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
                                            className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-zinc-900 outline-none transition-colors focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                                            placeholder="Enter your age"
                                        />
                                        {fieldErrors.age ? (
                                            <p className="mt-1 text-sm text-red-600">
                                                {fieldErrors.age}
                                            </p>
                                        ) : null}
                                    </div>

                                    <div>
                                        <label
                                            htmlFor="onboarding-year"
                                            className="mb-2 block text-sm font-semibold text-emerald-800"
                                        >
                                            Year at Stetson
                                        </label>
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
                                            className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-zinc-900 outline-none transition-colors focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                                        >
                                            <option value="">Select your year</option>
                                            {ONBOARDING_YEAR_OPTIONS.map((option) => (
                                                <option key={option.value} value={option.value}>
                                                    {option.label}
                                                </option>
                                            ))}
                                        </select>
                                        {fieldErrors.yearAtStetson ? (
                                            <p className="mt-1 text-sm text-red-600">
                                                {fieldErrors.yearAtStetson}
                                            </p>
                                        ) : null}
                                    </div>

                                    <div>
                                        <label
                                            htmlFor="onboarding-gender"
                                            className="mb-2 block text-sm font-semibold text-emerald-800"
                                        >
                                            Gender
                                        </label>
                                        <select
                                            id="onboarding-gender"
                                            value={formValues.gender}
                                            onChange={(event) =>
                                                updateField(
                                                    "gender",
                                                    event.target.value as OnboardingFormValues["gender"]
                                                )
                                            }
                                            disabled={isSubmitting}
                                            className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-zinc-900 outline-none transition-colors focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                                        >
                                            <option value="">Select your gender</option>
                                            {ONBOARDING_GENDER_OPTIONS.map((option) => (
                                                <option key={option.value} value={option.value}>
                                                    {option.label}
                                                </option>
                                            ))}
                                        </select>
                                        {fieldErrors.gender ? (
                                            <p className="mt-1 text-sm text-red-600">
                                                {fieldErrors.gender}
                                            </p>
                                        ) : null}
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={!canSubmit}
                                        className="w-full rounded-2xl bg-emerald-600 px-4 py-3 text-base font-semibold text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-zinc-300"
                                    >
                                        {submitButtonLabel}
                                    </button>
                                </form>
                            </article>
                        </motion.section>
                    )}
                </AnimatePresence>
            </div>
        </main>
    );
}
