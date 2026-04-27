"use client";

import { useUser } from "@clerk/nextjs";
import { format, parseISO } from "date-fns";
import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeftRight,
  Calendar,
  Info,
  MapPin,
  Flag,
  Map,
  ShieldAlert,
  ArrowRight,
  Minus,
  Plus,
  Car
} from "lucide-react";
import { ProtectedShell } from "../_components/ProtectedShell";
import { LocationAutocompleteInput } from "@/components/LocationAutocompleteInput";
import {
  createEmptyLocationField,
  createLocationFieldFromSelection,
  updateLocationFieldInput,
} from "@/lib/location-field";
import {
  type DistanceCategoryOption,
  distanceCategoryFromLocationFields,
  formatPostRideDistanceCategory,
} from "@/lib/distance-category";
import {
  type PostTripRequestFieldErrors,
  type PostTripRequestFormValues,
  buildPostTripRequestPayload,
  canSubmitPostTripRequest,
} from "@/lib/post-trip-request-form";

interface ApiValidationDetail {
  field?: string;
  message?: string;
}

const initialFormValues: PostTripRequestFormValues = {
  origin: createEmptyLocationField(),
  destination: createEmptyLocationField(),
  earliestDesiredAt: "",
  latestDesiredAt: "",
  preferredDepartAt: "",
  seatsNeeded: "1",
  pickupInstructions: "",
  dropoffInstructions: "",
};

const fieldNameMap: Record<string, keyof PostTripRequestFieldErrors> = {
  originText: "originText",
  destinationText: "destinationText",
  earliestDesiredAt: "earliestDesiredAt",
  latestDesiredAt: "latestDesiredAt",
  preferredDepartAt: "preferredDepartAt",
  seatsNeeded: "seatsNeeded",
  distanceCategory: "distanceCategory",
  pickupInstructions: "pickupInstructions",
  dropoffInstructions: "dropoffInstructions",
};

async function parseErrorResponse(
  response: Response,
): Promise<{ fieldErrors: PostTripRequestFieldErrors; message: string }> {
  let payload: unknown = null;

  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  const fieldErrors: PostTripRequestFieldErrors = {};
  let message = "Unable to post trip request right now. Please try again.";

  if (payload && typeof payload === "object") {
    const maybeMessage = (payload as { message?: unknown }).message;
    if (typeof maybeMessage === "string" && maybeMessage.trim()) {
      message = maybeMessage;
    }

    const details = (payload as { details?: unknown }).details;
    if (Array.isArray(details)) {
      details.forEach((detail) => {
        const typedDetail = detail as ApiValidationDetail;
        if (
          typeof typedDetail.field === "string" &&
          typeof typedDetail.message === "string"
        ) {
          const mappedField = fieldNameMap[typedDetail.field];
          if (mappedField && !fieldErrors[mappedField]) {
            fieldErrors[mappedField] = typedDetail.message;
          }
        }
      });
    }
  }

  return { fieldErrors, message };
}

const labelClass =
  "mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-zinc-500";

interface ActiveTripRequestMatch {
  matchId: string;
  rideId: string;
  state: string;
  scoreSnapshot: number;
  originDistanceSnapshot: number;
  destinationDistanceSnapshot: number;
  timeDifferenceSnapshot: number;
  originText: string;
  destinationText: string;
  departureTime: string;
  availableSeats: number;
}

function formatRideTimeWindow(m: ActiveTripRequestMatch): string {
  const startDate = parseISO(m.departureTime);
  return format(startDate, "MMM d, h:mm a");
}

function DistanceCategoryField({
  category,
  error,
}: {
  category: DistanceCategoryOption | null;
  error?: string;
}) {
  return (
    <div>
      <label htmlFor="distanceCategoryDisplay" className={labelClass}>
        Distance Category
      </label>
      <div className="flex flex-wrap gap-2 pointer-events-none opacity-90">
        <div
          className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
            category === "SHORT"
              ? "bg-[#0d3d2e] text-white"
              : "bg-zinc-200/60 text-zinc-600"
          }`}
        >
          Local (&lt;10 mi)
        </div>
        <div
          className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
            category === "MEDIUM"
              ? "bg-[#0d3d2e] text-white"
              : "bg-zinc-200/60 text-zinc-600"
          }`}
        >
          Mid-Range (10-50 mi)
        </div>
        <div
          className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
            category === "LONG"
              ? "bg-[#0d3d2e] text-white"
              : "bg-zinc-200/60 text-zinc-600"
          }`}
        >
          Long Distance (50+ mi)
        </div>
      </div>
      {!category && !error && (
        <p className="mt-2 text-[11px] text-zinc-400 font-medium">Select origin and destination to calculate</p>
      )}
      {error ? <p className="mt-1 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}

export default function PostTripRequestPage() {
  const { user, isLoaded: userLoaded } = useUser();
  const [formValues, setFormValues] = useState<PostTripRequestFormValues>(initialFormValues);
  const [fieldErrors, setFieldErrors] = useState<PostTripRequestFieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [createdTripRequestId, setCreatedTripRequestId] = useState<string | null>(null);
  const [suggestedMatches, setSuggestedMatches] = useState<ActiveTripRequestMatch[]>([]);
  const [suggestedLoad, setSuggestedLoad] = useState<"idle" | "loading" | "ok" | "error">("idle");

  const computedDistanceCategory = useMemo(
    () => distanceCategoryFromLocationFields(formValues.origin, formValues.destination),
    [formValues.origin, formValues.destination],
  );

  useEffect(() => {
    if (!isSuccess || !createdTripRequestId) {
      return;
    }

    let cancelled = false;
    setSuggestedLoad("loading");

    void (async () => {
      try {
        const response = await fetch(
          `/api/trip-requests/${encodeURIComponent(createdTripRequestId)}/matches`,
        );
        if (!response.ok) {
          throw new Error("Failed to load suggested rides");
        }
        const data: unknown = await response.json();
        const items = Array.isArray((data as { items?: unknown }).items)
          ? (data as { items: ActiveTripRequestMatch[] }).items
          : [];
        if (!cancelled) {
          setSuggestedMatches(items);
          setSuggestedLoad("ok");
        }
      } catch {
        if (!cancelled) {
          setSuggestedLoad("error");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isSuccess, createdTripRequestId]);

  const submitButtonLabel = useMemo(() => {
    if (isSubmitting) {
      return "Creating...";
    }
    return "Create Request";
  }, [isSubmitting]);

  type NonLocationField = Exclude<keyof PostTripRequestFormValues, "origin" | "destination">;

  function updateField<K extends NonLocationField>(field: K, value: PostTripRequestFormValues[K]) {
    setFormValues((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => ({
      ...prev,
      [field]: undefined,
    }));
  }

  function updateLocationInput(field: "origin" | "destination", nextValue: string) {
    if (field === "origin") {
      setFormValues((prev) => ({
        ...prev,
        origin: updateLocationFieldInput(prev.origin, nextValue),
      }));
      setFieldErrors((prev) => ({ ...prev, originText: undefined, distanceCategory: undefined }));
      return;
    }

    setFormValues((prev) => ({
      ...prev,
      destination: updateLocationFieldInput(prev.destination, nextValue),
    }));
    setFieldErrors((prev) => ({ ...prev, destinationText: undefined, distanceCategory: undefined }));
  }

  function applyLocationSelection(
    field: "origin" | "destination",
    selection: {
      label: string;
      latitude: number;
      longitude: number;
    },
  ) {
    if (field === "origin") {
      setFormValues((prev) => ({
        ...prev,
        origin: createLocationFieldFromSelection(selection),
      }));
      setFieldErrors((prev) => ({ ...prev, originText: undefined, distanceCategory: undefined }));
      return;
    }

    setFormValues((prev) => ({
      ...prev,
      destination: createLocationFieldFromSelection(selection),
    }));
    setFieldErrors((prev) => ({ ...prev, destinationText: undefined, distanceCategory: undefined }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSubmitPostTripRequest(isSubmitting)) {
      return;
    }

    setSubmitError(null);
    const buildResult = buildPostTripRequestPayload(formValues);
    setFieldErrors(buildResult.fieldErrors);

    if (!buildResult.payload) {
      setSubmitError(buildResult.submitError);
      return;
    }

    try {
      setIsSubmitting(true);

      const response = await fetch("/api/trip-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify(buildResult.payload),
      });

      if (response.ok) {
        const created: unknown = await response.json();
        const id =
          created &&
          typeof created === "object" &&
          "id" in created &&
          typeof (created as { id: unknown }).id === "string"
            ? (created as { id: string }).id
            : null;
        if (id) {
          setCreatedTripRequestId(id);
        }
        setIsSuccess(true);
        return;
      }

      const parsedError = await parseErrorResponse(response);
      setFieldErrors((prev) => ({ ...prev, ...parsedError.fieldErrors }));
      setSubmitError(parsedError.message);
    } catch (error) {
      console.error("Failed to submit trip request:", error);
      setSubmitError("Network error while posting trip request. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleIncrementSeats() {
    const current = Number.parseInt(formValues.seatsNeeded, 10);
    if (!Number.isNaN(current) && current < 8) {
      updateField("seatsNeeded", String(current + 1));
    }
  }

  function handleDecrementSeats() {
    const current = Number.parseInt(formValues.seatsNeeded, 10);
    if (!Number.isNaN(current) && current > 1) {
      updateField("seatsNeeded", String(current - 1));
    }
  }

  return (
    <ProtectedShell
      activeNav="browseTripRequests"
    >
      <div className="min-h-[calc(100vh-4rem)] flex flex-col bg-[#f3f4f6]">
        <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 md:px-6 md:py-10">
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900 md:text-4xl mb-3">
              Request a Ride
            </h1>
            <p className="max-w-2xl text-base text-zinc-600 leading-relaxed">
              Connect with fellow Hatters heading your way. Post your trip details and find a driver within the Stetson community.
            </p>
          </div>

          <AnimatePresence mode="wait">
            {isSuccess ? (
              <motion.div
                key="success-state"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="overflow-hidden rounded-3xl border border-zinc-200/80 bg-white shadow-sm"
              >
                <div className="border-b border-zinc-100 bg-gradient-to-b from-emerald-50/60 to-white px-5 py-7 text-center sm:px-8 sm:py-8">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 220, damping: 16 }}
                    className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 shadow-sm ring-4 ring-white"
                  >
                    <motion.svg
                      width="36"
                      height="36"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.45, delay: 0.12, ease: "easeOut" }}
                    >
                      <motion.polyline points="20 6 9 17 4 12" />
                    </motion.svg>
                  </motion.div>
                  <h2 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
                    Trip request posted successfully
                  </h2>
                  <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-zinc-600">
                    Your request is live. Below are available rides that fit your route from our match system.
                  </p>
                  <Link
                    href="/dashboard"
                    className="mt-5 inline-flex min-h-10 items-center justify-center rounded-xl bg-[#0d3d2e] px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0a3026]"
                  >
                    Go to dashboard
                  </Link>
                </div>

                {createdTripRequestId ? (
                  <div className="px-5 py-6 sm:px-8 sm:py-7">
                    <div className="mb-4 flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                      <h3 className="text-sm font-bold uppercase tracking-wide text-[#0d3d2e]">
                        Suggested Rides
                      </h3>
                      {suggestedLoad === "ok" && suggestedMatches.length > 0 ? (
                        <span className="text-xs font-medium text-zinc-500">
                          {suggestedMatches.length} match
                          {suggestedMatches.length === 1 ? "" : "es"}
                        </span>
                      ) : null}
                    </div>
                    {suggestedLoad === "loading" ? (
                      <div className="flex items-center gap-2 text-sm text-zinc-500">
                        <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-zinc-200 border-t-emerald-700" />
                        Finding suggestions…
                      </div>
                    ) : null}
                    {suggestedLoad === "error" ? (
                      <p className="text-sm text-red-600">
                        Could not load suggestions. You can still find rides on{" "}
                        <Link href="/browse" className="font-medium underline underline-offset-2">
                          Browse
                        </Link>
                        .
                      </p>
                    ) : null}
                    {suggestedLoad === "ok" && suggestedMatches.length === 0 ? (
                      <p className="text-sm text-zinc-600">
                        No suggestions yet.{" "}
                        <Link
                          href="/browse"
                          className="font-semibold text-[#0d3d2e] underline decoration-zinc-300 underline-offset-2 hover:decoration-[#0d3d2e]"
                        >
                          Browse rides
                        </Link>{" "}
                        anytime.
                      </p>
                    ) : null}
                    {suggestedLoad === "ok" && suggestedMatches.length > 0 ? (
                      <ul className="flex flex-col gap-3">
                        {suggestedMatches.map((m) => {
                          const routeTitle = `${m.originText} → ${m.destinationText}`;
                          return (
                            <li
                              key={m.matchId}
                              className="group rounded-2xl border border-zinc-200/90 bg-zinc-50/50 p-4 transition hover:border-zinc-300 hover:bg-white hover:shadow-sm sm:p-5"
                            >
                              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
                                <div className="min-w-0 flex-1 space-y-3 text-left">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span
                                      className="inline-flex items-center rounded-full bg-emerald-100/90 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-900 ring-1 ring-emerald-200/80"
                                      title="Lower scores indicate a stronger match"
                                    >
                                      Match {m.scoreSnapshot.toFixed(3)}
                                    </span>
                                  </div>
                                  <div className="space-y-2.5">
                                    <div>
                                      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                                        From
                                      </p>
                                      <p
                                        className="line-clamp-2 text-sm font-medium leading-snug text-zinc-900"
                                        title={m.originText}
                                      >
                                        {m.originText}
                                      </p>
                                    </div>
                                    <div className="pl-0.5 text-zinc-300" aria-hidden>
                                      <div className="h-px w-4 bg-gradient-to-r from-zinc-300 to-transparent" />
                                    </div>
                                    <div>
                                      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                                        To
                                      </p>
                                      <p
                                        className="line-clamp-2 text-sm font-medium leading-snug text-zinc-900"
                                        title={m.destinationText}
                                      >
                                        {m.destinationText}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-600 sm:text-sm">
                                    <span className="font-medium text-zinc-700">
                                      {formatRideTimeWindow(m)}
                                    </span>
                                    <span className="hidden text-zinc-300 sm:inline" aria-hidden>
                                      ·
                                    </span>
                                    <span>{m.availableSeats} seat{m.availableSeats === 1 ? "" : "s"} available</span>
                                  </div>
                                </div>
                                <div className="flex w-full shrink-0 flex-col gap-2 sm:max-w-[11rem] lg:w-44">
                                  <Link
                                    href={`/browse?rideId=${m.rideId}`}
                                    className="inline-flex h-10 w-full items-center justify-center rounded-xl bg-[#0d3d2e] text-sm font-semibold text-white shadow-sm transition hover:bg-[#0a3026]"
                                  >
                                    View Ride
                                  </Link>
                                </div>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    ) : null}
                  </div>
                ) : null}
              </motion.div>
            ) : (
              <motion.div
                key="post-trip-request-form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start"
              >
                <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                  {submitError ? (
                    <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700 shadow-sm">
                      {submitError}
                    </div>
                  ) : null}

                  {/* Route Details Card */}
                  <section className="bg-white rounded-3xl border border-zinc-200/80 p-6 md:p-8 shadow-sm">
                    <div className="flex items-center gap-2 text-zinc-800 mb-6">
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-[#0d3d2e]">
                        <ArrowLeftRight className="h-4 w-4" strokeWidth={2.5} />
                      </div>
                      <h2 className="text-lg font-bold tracking-tight">Route Details</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
                      <LocationAutocompleteInput
                        id="originText"
                        label="Origin Address"
                        labelClassName={labelClass}
                        placeholder="e.g. Stetson University"
                        locationField={formValues.origin}
                        error={fieldErrors.originText}
                        startAdornment={<MapPin className="h-4 w-4" strokeWidth={2} />}
                        onInputChange={(nextValue) => updateLocationInput("origin", nextValue)}
                        onSuggestionSelect={(selection) => applyLocationSelection("origin", selection)}
                      />

                      <LocationAutocompleteInput
                        id="destinationText"
                        label="Destination Address"
                        labelClassName={labelClass}
                        placeholder="e.g. Orlando International Airport"
                        locationField={formValues.destination}
                        error={fieldErrors.destinationText}
                        startAdornment={<Flag className="h-4 w-4" strokeWidth={2} />}
                        onInputChange={(nextValue) => updateLocationInput("destination", nextValue)}
                        onSuggestionSelect={(selection) => applyLocationSelection("destination", selection)}
                      />
                    </div>
                    
                    <DistanceCategoryField
                      category={computedDistanceCategory}
                      error={fieldErrors.distanceCategory}
                    />
                  </section>

                  {/* Time & Availability Card */}
                  <section className="bg-white rounded-3xl border border-zinc-200/80 p-6 md:p-8 shadow-sm">
                    <div className="flex items-center gap-2 text-zinc-800 mb-6">
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-[#0d3d2e]">
                        <Calendar className="h-4 w-4" strokeWidth={2.5} />
                      </div>
                      <h2 className="text-lg font-bold tracking-tight">Time &amp; Availability</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
                      <div>
                        <label htmlFor="earliestDesiredAt" className={labelClass}>
                          Earliest Departure
                        </label>
                        <input
                          id="earliestDesiredAt"
                          type="datetime-local"
                          value={formValues.earliestDesiredAt}
                          onChange={(e) => updateField("earliestDesiredAt", e.target.value)}
                          className="block w-full min-w-0 rounded-xl bg-zinc-100/80 py-3 px-4 text-sm text-zinc-900 ring-1 ring-inset ring-zinc-200/80 outline-none focus:ring-2 focus:ring-[#0d3d2e]/30 transition-all"
                        />
                        {fieldErrors.earliestDesiredAt ? (
                          <p className="mt-1 text-sm text-red-600">{fieldErrors.earliestDesiredAt}</p>
                        ) : null}
                      </div>
                      <div>
                        <label htmlFor="latestDesiredAt" className={labelClass}>
                          Latest Departure
                        </label>
                        <input
                          id="latestDesiredAt"
                          type="datetime-local"
                          value={formValues.latestDesiredAt}
                          onChange={(e) => updateField("latestDesiredAt", e.target.value)}
                          className="block w-full min-w-0 rounded-xl bg-zinc-100/80 py-3 px-4 text-sm text-zinc-900 ring-1 ring-inset ring-zinc-200/80 outline-none focus:ring-2 focus:ring-[#0d3d2e]/30 transition-all"
                        />
                        {fieldErrors.latestDesiredAt ? (
                          <p className="mt-1 text-sm text-red-600">{fieldErrors.latestDesiredAt}</p>
                        ) : null}
                      </div>
                    </div>

                    <div>
                      <label htmlFor="seatsNeeded" className={labelClass}>
                        Seats Needed
                      </label>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center rounded-xl bg-zinc-100/80 ring-1 ring-inset ring-zinc-200/80 h-12 w-36">
                          <button
                            type="button"
                            onClick={handleDecrementSeats}
                            className="w-12 h-full flex items-center justify-center text-zinc-500 hover:text-zinc-800 transition-colors"
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <input
                            id="seatsNeeded"
                            type="text"
                            readOnly
                            value={formValues.seatsNeeded}
                            className="flex-1 w-full bg-transparent text-center text-base font-semibold text-zinc-900 outline-none pointer-events-none"
                          />
                          <button
                            type="button"
                            onClick={handleIncrementSeats}
                            className="w-12 h-full flex items-center justify-center text-zinc-500 hover:text-zinc-800 transition-colors"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                        <span className="text-sm italic text-zinc-500">Including luggage space</span>
                      </div>
                      {fieldErrors.seatsNeeded ? (
                        <p className="mt-1 text-sm text-red-600">{fieldErrors.seatsNeeded}</p>
                      ) : null}
                    </div>
                  </section>

                  {/* Special Instructions Card */}
                  <section className="bg-white rounded-3xl border border-zinc-200/80 p-6 md:p-8 shadow-sm">
                    <div className="flex items-center gap-2 text-zinc-800 mb-6">
                      <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center text-red-500">
                        <Info className="h-4 w-4" strokeWidth={2.5} />
                      </div>
                      <h2 className="text-lg font-bold tracking-tight">Special Instructions</h2>
                    </div>

                    <div className="space-y-5">
                      <div>
                        <label htmlFor="pickupInstructions" className={labelClass}>
                          Pickup Instructions
                        </label>
                        <textarea
                          id="pickupInstructions"
                          rows={3}
                          value={formValues.pickupInstructions}
                          onChange={(e) => updateField("pickupInstructions", e.target.value)}
                          className="w-full rounded-xl bg-zinc-100/80 py-3 px-4 text-sm text-zinc-900 ring-1 ring-inset ring-zinc-200/80 outline-none focus:ring-2 focus:ring-[#0d3d2e]/30 resize-none transition-all placeholder:text-zinc-400"
                          placeholder="e.g. I'll be waiting in front of the Carlton Union Building with a red backpack."
                        />
                        {fieldErrors.pickupInstructions ? (
                          <p className="mt-1 text-sm text-red-600">{fieldErrors.pickupInstructions}</p>
                        ) : null}
                      </div>

                      <div>
                        <label htmlFor="dropoffInstructions" className={labelClass}>
                          Dropoff Instructions
                        </label>
                        <textarea
                          id="dropoffInstructions"
                          rows={3}
                          value={formValues.dropoffInstructions}
                          onChange={(e) => updateField("dropoffInstructions", e.target.value)}
                          className="w-full rounded-xl bg-zinc-100/80 py-3 px-4 text-sm text-zinc-900 ring-1 ring-inset ring-zinc-200/80 outline-none focus:ring-2 focus:ring-[#0d3d2e]/30 resize-none transition-all placeholder:text-zinc-400"
                          placeholder="e.g. Near Terminal B departures, please."
                        />
                        {fieldErrors.dropoffInstructions ? (
                          <p className="mt-1 text-sm text-red-600">{fieldErrors.dropoffInstructions}</p>
                        ) : null}
                      </div>
                    </div>
                  </section>

                  {/* Submit Area */}
                  <div className="flex flex-col items-center gap-3 mt-2">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full lg:w-auto min-w-[280px] h-14 flex items-center justify-center gap-2 rounded-2xl bg-[#0d3d2e] text-base font-semibold text-white shadow-sm transition hover:bg-[#0a3026] disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      {submitButtonLabel}
                      {!isSubmitting && <ArrowRight className="h-5 w-5" />}
                    </button>
                    <p className="text-[11px] font-bold tracking-[0.2em] text-zinc-400 uppercase">
                      Safe travels, Hatter!
                    </p>
                  </div>
                </form>

                {/* Right Sidebar */}
                <div className="flex flex-col gap-6">
                  {/* How it Works */}
                  <div className="bg-gradient-to-br from-emerald-50 to-teal-50/50 rounded-3xl p-6 border border-emerald-100/50 shadow-sm relative overflow-hidden">
                    <div className="absolute -top-4 -right-4 p-4 opacity-[0.03] pointer-events-none">
                      <Car className="w-32 h-32 text-[#0d3d2e]" />
                    </div>
                    <h3 className="text-[#0d3d2e] font-bold text-sm mb-4 relative z-10">How it works</h3>
                    <ul className="space-y-4 relative z-10">
                      <li className="flex gap-3">
                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-800 text-xs font-bold">1</div>
                        <p className="text-sm text-zinc-700 leading-snug">Post your route and desired departure window.</p>
                      </li>
                      <li className="flex gap-3">
                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-800 text-xs font-bold">2</div>
                        <p className="text-sm text-zinc-700 leading-snug">We'll suggest rides from verified Stetson students.</p>
                      </li>
                      <li className="flex gap-3">
                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-800 text-xs font-bold">3</div>
                        <p className="text-sm text-zinc-700 leading-snug">Message the driver and confirm your trip.</p>
                      </li>
                    </ul>
                  </div>

                  {/* Safety Tip */}
                  <div className="bg-[#9df2b8] rounded-3xl p-6 relative overflow-hidden">
                    <h3 className="text-[#0d3d2e] font-bold text-sm mb-2 relative z-10">Safety Tip</h3>
                    <p className="text-[#0a3026] text-sm leading-relaxed relative z-10">
                      Always verify your driver's identity and vehicle details before entering. Use the built-in messaging for all trip coordination.
                    </p>
                  </div>

                  {/* Recent Requests (Static Mock) */}
                  <div className="bg-white rounded-3xl border border-zinc-200/80 p-6 shadow-sm">
                    <h3 className="text-zinc-900 font-bold text-sm mb-4">Recent Requests</h3>
                    <ul className="space-y-4">
                      <li className="flex items-start gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#0d3d2e] mt-1.5" />
                        <div>
                          <p className="text-sm font-semibold text-zinc-900">To Sanford Airport</p>
                          <p className="text-xs text-zinc-500">Pending approval</p>
                        </div>
                      </li>
                      <li className="flex items-start gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-zinc-300 mt-1.5" />
                        <div>
                          <p className="text-sm font-semibold text-zinc-900">To Daytona Beach</p>
                          <p className="text-xs text-zinc-500">Completed 2d ago</p>
                        </div>
                      </li>
                    </ul>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </ProtectedShell>
  );
}
