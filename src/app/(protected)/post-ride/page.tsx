"use client";

import { useUser } from "@clerk/nextjs";
import { format, parseISO } from "date-fns";
import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeftRight, Calendar, Car, Check, ChevronDown, Info, MapPin, Flag, X } from "lucide-react";
import { ProtectedShell } from "../_components/ProtectedShell";
import {
  buildOfferPayload,
  type OfferFieldErrors,
  type OfferFormValues,
} from "@/lib/browse-trip-requests";
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
  type PostRideFieldErrors,
  type PostRideFormValues,
  buildPostRidePayload,
  canSubmitPostRide,
} from "@/lib/post-ride-form";

interface ApiValidationDetail {
  field?: string;
  message?: string;
}

const initialFormValues: PostRideFormValues = {
  origin: createEmptyLocationField(),
  destination: createEmptyLocationField(),
  earliestDepartAt: "",
  latestDepartAt: "",
  preferredDepartAt: "",
  seatsTotal: "1",
  priceDollars: "",
  musicPreference: "",
  hasAc: "",
  hasTrunkSpace: "",
  vehicleType: "",
  pickupInstructions: "",
  dropoffInstructions: "",
};

const fieldNameMap: Record<string, keyof PostRideFieldErrors> = {
  originText: "originText",
  destinationText: "destinationText",
  earliestDepartAt: "earliestDepartAt",
  latestDepartAt: "latestDepartAt",
  preferredDepartAt: "preferredDepartAt",
  seatsTotal: "seatsTotal",
  priceCents: "priceDollars",
  distanceCategory: "distanceCategory",
  musicPreference: "musicPreference",
  hasAc: "hasAc",
  hasTrunkSpace: "hasTrunkSpace",
  vehicleType: "vehicleType",
  pickupInstructions: "pickupInstructions",
  dropoffInstructions: "dropoffInstructions",
};

async function parseErrorResponse(
  response: Response,
): Promise<{ fieldErrors: PostRideFieldErrors; message: string }> {
  let payload: unknown = null;

  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  const fieldErrors: PostRideFieldErrors = {};
  let message = "Unable to post ride right now. Please try again.";

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

const initialOfferForm: OfferFormValues = {
  seatsOffered: "1",
  priceDollars: "",
  message: "",
};

interface SuggestedTripRequestMatch {
  matchId: string;
  tripRequestId: string;
  scoreSnapshot: number;
  originText: string;
  destinationText: string;
  earliestDesiredAt: string;
  latestDesiredAt: string;
  preferredDepartAt: string | null;
  seatsNeeded: number;
  originDistanceSnapshot: number;
  destinationDistanceSnapshot: number;
  timeDifferenceSnapshot: number;
  riderName: string | null;
  riderProfilePictureUrl: string | null;
}

function formatRequestTimeWindow(m: SuggestedTripRequestMatch): string {
  const startDate = parseISO(m.earliestDesiredAt);
  const endDate = parseISO(m.latestDesiredAt);
  const sameInstant = startDate.getTime() === endDate.getTime();
  const sameDay = format(startDate, "yyyy-MM-dd") === format(endDate, "yyyy-MM-dd");

  let range: string;
  if (sameInstant) {
    range = format(startDate, "MMM d, h:mm a");
  } else if (sameDay) {
    range = `${format(startDate, "MMM d, h:mm a")} – ${format(endDate, "h:mm a")}`;
  } else {
    range = `${format(startDate, "MMM d, h:mm a")} – ${format(endDate, "MMM d, h:mm a")}`;
  }

  if (m.preferredDepartAt) {
    const pref = format(parseISO(m.preferredDepartAt), "MMM d, h:mm a");
    return `${range} · preferred ${pref}`;
  }
  return range;
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
      <div className="relative">
        <input
          id="distanceCategoryDisplay"
          type="text"
          readOnly
          disabled
          value={
            category
              ? formatPostRideDistanceCategory(category)
              : "Select origin and destination first"
          }
          className="w-full cursor-not-allowed rounded-lg bg-zinc-100 py-2.5 pl-3 pr-3 text-sm text-zinc-800 ring-1 ring-inset ring-zinc-200/80"
        />
      </div>
      {error ? <p className="mt-1 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}

export default function PostRidePage() {
  const { user, isLoaded: userLoaded } = useUser();
  const [formValues, setFormValues] = useState<PostRideFormValues>(initialFormValues);
  const [fieldErrors, setFieldErrors] = useState<PostRideFieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [createdRideId, setCreatedRideId] = useState<string | null>(null);
  const [suggestedMatches, setSuggestedMatches] = useState<SuggestedTripRequestMatch[]>([]);
  const [suggestedLoad, setSuggestedLoad] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [offerTarget, setOfferTarget] = useState<SuggestedTripRequestMatch | null>(null);
  const [offerForm, setOfferForm] = useState<OfferFormValues>(initialOfferForm);
  const [offerFieldErrors, setOfferFieldErrors] = useState<OfferFieldErrors>({});
  const [offerError, setOfferError] = useState<string | null>(null);
  const [offerSubmitting, setOfferSubmitting] = useState(false);

  const computedDistanceCategory = useMemo(
    () => distanceCategoryFromLocationFields(formValues.origin, formValues.destination),
    [formValues.origin, formValues.destination],
  );

  useEffect(() => {
    if (!isSuccess || !createdRideId) {
      return;
    }

    let cancelled = false;
    setSuggestedLoad("loading");

    void (async () => {
      try {
        const response = await fetch(
          `/api/rides/${encodeURIComponent(createdRideId)}/matches`,
        );
        if (!response.ok) {
          throw new Error("Failed to load suggested trip requests");
        }
        const data: unknown = await response.json();
        const items = Array.isArray((data as { items?: unknown }).items)
          ? (data as { items: SuggestedTripRequestMatch[] }).items
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
  }, [isSuccess, createdRideId]);

  const submitButtonLabel = useMemo(() => {
    if (isSubmitting) {
      return "Creating...";
    }

    return "Create Ride";
  }, [isSubmitting]);

  type NonLocationField = Exclude<keyof PostRideFormValues, "origin" | "destination">;

  function updateField<K extends NonLocationField>(field: K, value: PostRideFormValues[K]) {
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

    if (!canSubmitPostRide(isSubmitting)) {
      return;
    }

    setSubmitError(null);
    const buildResult = buildPostRidePayload(formValues);
    setFieldErrors(buildResult.fieldErrors);

    if (!buildResult.payload) {
      setSubmitError(buildResult.submitError);
      return;
    }

    try {
      setIsSubmitting(true);

      const response = await fetch("/api/rides", {
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
          setCreatedRideId(id);
        }
        setIsSuccess(true);
        return;
      }

      const parsedError = await parseErrorResponse(response);
      setFieldErrors((prev) => ({ ...prev, ...parsedError.fieldErrors }));
      setSubmitError(parsedError.message);
    } catch (error) {
      console.error("Failed to submit ride:", error);
      setSubmitError("Network error while posting ride. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function openSendOffer(match: SuggestedTripRequestMatch) {
    const totalSeats = Number.parseInt(formValues.seatsTotal, 10);
    const cap = Math.min(
      Number.isInteger(totalSeats) && totalSeats >= 1 ? totalSeats : 1,
      match.seatsNeeded,
    );
    setOfferForm({
      seatsOffered: String(Math.max(1, cap)),
      priceDollars: formValues.priceDollars,
      message: "",
    });
    setOfferFieldErrors({});
    setOfferError(null);
    setOfferTarget(match);
  }

  function closeSendOffer() {
    setOfferTarget(null);
    setOfferError(null);
    setOfferFieldErrors({});
  }

  async function handleSendOffer() {
    if (!offerTarget || offerSubmitting) {
      return;
    }

    setOfferError(null);
    const build = buildOfferPayload(offerForm);
    setOfferFieldErrors(build.fieldErrors);
    if (!build.payload) {
      setOfferError(build.submitError);
      return;
    }

    const tripRequestId = offerTarget.tripRequestId;
    try {
      setOfferSubmitting(true);
      const response = await fetch(
        `/api/trip-requests/${encodeURIComponent(tripRequestId)}/offers`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": crypto.randomUUID(),
          },
          body: JSON.stringify(build.payload),
        },
      );

      if (response.ok) {
        setSuggestedMatches((prev) =>
          prev.filter((x) => x.tripRequestId !== tripRequestId),
        );
        closeSendOffer();
        return;
      }

      let message = "Unable to send offer.";
      try {
        const payload: unknown = await response.json();
        if (
          payload &&
          typeof payload === "object" &&
          "message" in payload &&
          typeof (payload as { message: unknown }).message === "string"
        ) {
          message = (payload as { message: string }).message;
        }
      } catch {
        // ignore
      }
      setOfferError(message);
    } catch {
      setOfferError("Network error while sending offer.");
    } finally {
      setOfferSubmitting(false);
    }
  }

  const year = new Date().getFullYear();

  return (
    <ProtectedShell
      activeNav="browse"
      layout="topnav"
      topNavActive="rides"
      topNavPrimaryAction={{ label: "Create Ride", href: "/post-ride" }}
    >
      <div className="min-h-[calc(100vh-4rem)] flex flex-col bg-[#f3f4f6]">
        <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 md:px-6 md:py-8">
          <div className="mb-6 flex flex-col gap-4 md:mb-8 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-2xl font-bold tracking-tight text-zinc-900 md:text-3xl">
                Share the Journey.{" "}
                <span className="text-[#0d3d2e]">Post Your Ride.</span>
              </p>
              <p className="mt-2 max-w-xl text-sm text-zinc-600 md:text-base">
                Connect with fellow Hatters and split the cost of your next trip. Precision planning meets
                campus mobility.
              </p>
            </div>
            <div
              className="hidden h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 md:flex"
              aria-hidden
            >
              <Car className="h-8 w-8 text-zinc-900" strokeWidth={1.5} />
            </div>
          </div>

          <AnimatePresence mode="wait">
            {isSuccess ? (
              <motion.div
                key="success-state"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm"
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
                    Ride posted successfully
                  </h2>
                  <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-zinc-600">
                    Your ride is live. Below are trip requests that fit your route from our match system.
                  </p>
                  <Link
                    href="/dashboard"
                    className="mt-5 inline-flex min-h-10 items-center justify-center rounded-xl bg-[#0d3d2e] px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0a3026]"
                  >
                    Go to dashboard
                  </Link>
                </div>

                {createdRideId ? (
                  <div className="px-5 py-6 sm:px-8 sm:py-7">
                    <div className="mb-4 flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                      <h3 className="text-sm font-bold uppercase tracking-wide text-[#0d3d2e]">
                        Suggested trip requests
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
                        Could not load suggestions. You can still find trip requests on{" "}
                        <Link href="/browse-trip-requests" className="font-medium underline underline-offset-2">
                          Browse
                        </Link>
                        .
                      </p>
                    ) : null}
                    {suggestedLoad === "ok" && suggestedMatches.length === 0 ? (
                      <p className="text-sm text-zinc-600">
                        No suggestions yet.{" "}
                        <Link
                          href="/browse-trip-requests"
                          className="font-semibold text-[#0d3d2e] underline decoration-zinc-300 underline-offset-2 hover:decoration-[#0d3d2e]"
                        >
                          Browse trip requests
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
                              className="group rounded-xl border border-zinc-200/90 bg-zinc-50/50 p-4 transition hover:border-zinc-300 hover:bg-white hover:shadow-sm sm:p-5"
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
                                      {formatRequestTimeWindow(m)}
                                    </span>
                                    <span className="hidden text-zinc-300 sm:inline" aria-hidden>
                                      ·
                                    </span>
                                    <span>{m.seatsNeeded} seat{m.seatsNeeded === 1 ? "" : "s"} needed</span>
                                    {m.riderName ? (
                                      <>
                                        <span className="hidden text-zinc-300 sm:inline" aria-hidden>
                                          ·
                                        </span>
                                        <span className="text-zinc-700">
                                          <span className="text-zinc-500">Rider</span> {m.riderName}
                                        </span>
                                      </>
                                    ) : null}
                                  </div>
                                </div>
                                <div className="flex w-full shrink-0 flex-col gap-2 sm:max-w-[11rem] lg:w-44">
                                  <Link
                                    href="/browse-trip-requests"
                                    className="inline-flex h-10 w-full items-center justify-center rounded-lg border border-zinc-200 bg-white text-sm font-semibold text-zinc-800 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50"
                                    title={routeTitle}
                                  >
                                    View request
                                  </Link>
                                  <button
                                    type="button"
                                    onClick={() => openSendOffer(m)}
                                    className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-[#0d3d2e] text-sm font-semibold text-white shadow-sm transition hover:bg-[#0a3026]"
                                  >
                                    Send offer
                                  </button>
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
              <motion.form
                key="post-ride-form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onSubmit={handleSubmit}
                className="overflow-x-hidden rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm md:p-8 md:pt-7"
              >
                {submitError ? (
                  <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {submitError}
                  </div>
                ) : null}

                <section className="mb-8">
                  <div className="mb-4 flex items-center gap-2 text-[#0d3d2e]">
                    <ArrowLeftRight className="h-5 w-5 shrink-0" strokeWidth={2.25} />
                    <h2 className="text-base font-bold tracking-tight">Route Details</h2>
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5">
                    <LocationAutocompleteInput
                      id="originText"
                      label="Origin Point"
                      labelClassName={labelClass}
                      placeholder="e.g. Elizabeth Hall"
                      locationField={formValues.origin}
                      error={fieldErrors.originText}
                      startAdornment={<MapPin className="h-4 w-4" strokeWidth={2} />}
                      onInputChange={(nextValue) => updateLocationInput("origin", nextValue)}
                      onSuggestionSelect={(selection) => applyLocationSelection("origin", selection)}
                    />

                    <LocationAutocompleteInput
                      id="destinationText"
                      label="Destination Point"
                      labelClassName={labelClass}
                      placeholder="e.g. Orlando International (MCO)"
                      locationField={formValues.destination}
                      error={fieldErrors.destinationText}
                      startAdornment={<Flag className="h-4 w-4" strokeWidth={2} />}
                      onInputChange={(nextValue) => updateLocationInput("destination", nextValue)}
                      onSuggestionSelect={(selection) => applyLocationSelection("destination", selection)}
                    />
                  </div>
                </section>

                <section className="mb-8">
                  <div className="mb-4 flex items-center gap-2 text-[#0d3d2e]">
                    <Calendar className="h-5 w-5 shrink-0" strokeWidth={2.25} />
                    <h2 className="text-base font-bold tracking-tight">Scheduling Window</h2>
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5">
                    <div>
                      <label htmlFor="earliestDepartAt" className={labelClass}>
                        Earliest Departure
                      </label>
                      <input
                        id="earliestDepartAt"
                        type="datetime-local"
                        value={formValues.earliestDepartAt}
                        onChange={(e) => updateField("earliestDepartAt", e.target.value)}
                        className="block w-full min-w-0 rounded-lg bg-zinc-100 py-2.5 px-3 text-sm text-zinc-900 ring-1 ring-inset ring-zinc-200/80 outline-none focus:ring-2 focus:ring-[#0d3d2e]/30"
                      />
                      {fieldErrors.earliestDepartAt ? (
                        <p className="mt-1 text-sm text-red-600">{fieldErrors.earliestDepartAt}</p>
                      ) : null}
                    </div>
                    <div>
                      <label htmlFor="latestDepartAt" className={labelClass}>
                        Latest Departure
                      </label>
                      <input
                        id="latestDepartAt"
                        type="datetime-local"
                        value={formValues.latestDepartAt}
                        onChange={(e) => updateField("latestDepartAt", e.target.value)}
                        className="block w-full min-w-0 rounded-lg bg-zinc-100 py-2.5 px-3 text-sm text-zinc-900 ring-1 ring-inset ring-zinc-200/80 outline-none focus:ring-2 focus:ring-[#0d3d2e]/30"
                      />
                      {fieldErrors.latestDepartAt ? (
                        <p className="mt-1 text-sm text-red-600">{fieldErrors.latestDepartAt}</p>
                      ) : null}
                    </div>
                  </div>
                  <details className="mt-4 rounded-lg border border-zinc-100 bg-zinc-50/80 px-3 py-2 text-sm text-zinc-600">
                    <summary className="cursor-pointer list-none font-medium text-zinc-700 [&::-webkit-details-marker]:hidden">
                      <span className="inline-flex items-center gap-1">
                        Optional: preferred departure
                        <ChevronDown className="h-4 w-4" />
                      </span>
                    </summary>
                    <div className="mt-3">
                      <label htmlFor="preferredDepartAt" className={labelClass}>
                        Preferred time (within window)
                      </label>
                      <input
                        id="preferredDepartAt"
                        type="datetime-local"
                        value={formValues.preferredDepartAt}
                        onChange={(e) => updateField("preferredDepartAt", e.target.value)}
                        className="block w-full min-w-0 max-w-md rounded-lg bg-white py-2.5 px-3 text-sm text-zinc-900 ring-1 ring-inset ring-zinc-200/80 outline-none focus:ring-2 focus:ring-[#0d3d2e]/30"
                      />
                      {fieldErrors.preferredDepartAt ? (
                        <p className="mt-1 text-sm text-red-600">{fieldErrors.preferredDepartAt}</p>
                      ) : null}
                    </div>
                  </details>
                </section>

                <section className="mb-6">
                  <div className="mb-4 flex items-center gap-2 text-[#0d3d2e]">
                    <Info className="h-5 w-5 shrink-0" strokeWidth={2.25} />
                    <h2 className="text-base font-bold tracking-tight">Capacity &amp; Pricing</h2>
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-4">
                    <DistanceCategoryField
                      category={computedDistanceCategory}
                      error={fieldErrors.distanceCategory}
                    />
                    <div>
                      <label htmlFor="seatsTotal" className={labelClass}>
                        Seats Available
                      </label>
                      <input
                        id="seatsTotal"
                        type="number"
                        min="1"
                        max="8"
                        step="1"
                        value={formValues.seatsTotal}
                        onChange={(e) => updateField("seatsTotal", e.target.value)}
                        className="w-full rounded-lg bg-zinc-100 py-2.5 px-3 text-sm text-zinc-900 ring-1 ring-inset ring-zinc-200/80 outline-none focus:ring-2 focus:ring-[#0d3d2e]/30"
                      />
                      {fieldErrors.seatsTotal ? (
                        <p className="mt-1 text-sm text-red-600">{fieldErrors.seatsTotal}</p>
                      ) : null}
                    </div>
                    <div>
                      <label htmlFor="priceDollars" className={labelClass}>
                        Price Per Seat
                      </label>
                      <div className="flex w-full items-center gap-0 rounded-lg bg-zinc-100 ring-1 ring-inset ring-zinc-200/80 focus-within:ring-2 focus-within:ring-[#0d3d2e]/30">
                        <span className="pl-3 text-sm text-zinc-500">$</span>
                        <input
                          id="priceDollars"
                          type="number"
                          min="0"
                          step="0.01"
                          value={formValues.priceDollars}
                          onChange={(e) => updateField("priceDollars", e.target.value)}
                          className="min-w-0 flex-1 border-0 bg-transparent py-2.5 pr-3 text-sm text-zinc-900 outline-none"
                          placeholder="0.00"
                        />
                      </div>
                      {fieldErrors.priceDollars ? (
                        <p className="mt-1 text-sm text-red-600">{fieldErrors.priceDollars}</p>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-4">
                    <div>
                      <label htmlFor="pickupInstructions" className={labelClass}>
                        Pickup Instructions
                      </label>
                      <textarea
                        id="pickupInstructions"
                        rows={3}
                        value={formValues.pickupInstructions}
                        onChange={(e) => updateField("pickupInstructions", e.target.value)}
                        className="w-full rounded-lg bg-zinc-100 px-3 py-2.5 text-sm text-zinc-900 ring-1 ring-inset ring-zinc-200/80 outline-none focus:ring-2 focus:ring-[#0d3d2e]/30"
                        placeholder="Where exactly should they meet you? e.g. Side entrance of the CUB"
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
                        className="w-full rounded-lg bg-zinc-100 px-3 py-2.5 text-sm text-zinc-900 ring-1 ring-inset ring-zinc-200/80 outline-none focus:ring-2 focus:ring-[#0d3d2e]/30"
                        placeholder="Details about the destination dropoff point..."
                      />
                      {fieldErrors.dropoffInstructions ? (
                        <p className="mt-1 text-sm text-red-600">{fieldErrors.dropoffInstructions}</p>
                      ) : null}
                    </div>
                  </div>
                </section>

                <section className="mb-8 border-t border-zinc-100 pt-6">
                  <h3 className="mb-3 text-sm font-bold text-[#0d3d2e]">Ride preferences (optional)</h3>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <label htmlFor="musicPreference" className={labelClass}>
                        Music
                      </label>
                      <select
                        id="musicPreference"
                        value={formValues.musicPreference}
                        onChange={(e) =>
                          updateField("musicPreference", e.target.value as PostRideFormValues["musicPreference"])
                        }
                        className="w-full rounded-lg bg-zinc-100 py-2.5 pl-2 pr-2 text-sm text-zinc-900 ring-1 ring-inset ring-zinc-200/80"
                      >
                        <option value="">Unspecified</option>
                        <option value="MUSIC_ALLOWED">Music allowed</option>
                        <option value="NO_MUSIC">No music</option>
                      </select>
                      {fieldErrors.musicPreference ? (
                        <p className="mt-1 text-xs text-red-600">{fieldErrors.musicPreference}</p>
                      ) : null}
                    </div>
                    <div>
                      <label htmlFor="hasAc" className={labelClass}>
                        AC
                      </label>
                      <select
                        id="hasAc"
                        value={formValues.hasAc}
                        onChange={(e) =>
                          updateField("hasAc", e.target.value as PostRideFormValues["hasAc"])
                        }
                        className="w-full rounded-lg bg-zinc-100 py-2.5 pl-2 pr-2 text-sm text-zinc-900 ring-1 ring-inset ring-zinc-200/80"
                      >
                        <option value="">Unspecified</option>
                        <option value="true">Yes</option>
                        <option value="false">No</option>
                      </select>
                      {fieldErrors.hasAc ? (
                        <p className="mt-1 text-xs text-red-600">{fieldErrors.hasAc}</p>
                      ) : null}
                    </div>
                    <div>
                      <label htmlFor="hasTrunkSpace" className={labelClass}>
                        Trunk
                      </label>
                      <select
                        id="hasTrunkSpace"
                        value={formValues.hasTrunkSpace}
                        onChange={(e) =>
                          updateField("hasTrunkSpace", e.target.value as PostRideFormValues["hasTrunkSpace"])
                        }
                        className="w-full rounded-lg bg-zinc-100 py-2.5 pl-2 pr-2 text-sm text-zinc-900 ring-1 ring-inset ring-zinc-200/80"
                      >
                        <option value="">Unspecified</option>
                        <option value="true">Yes</option>
                        <option value="false">No</option>
                      </select>
                      {fieldErrors.hasTrunkSpace ? (
                        <p className="mt-1 text-xs text-red-600">{fieldErrors.hasTrunkSpace}</p>
                      ) : null}
                    </div>
                    <div>
                      <label htmlFor="vehicleType" className={labelClass}>
                        Vehicle
                      </label>
                      <select
                        id="vehicleType"
                        value={formValues.vehicleType}
                        onChange={(e) =>
                          updateField("vehicleType", e.target.value as PostRideFormValues["vehicleType"])
                        }
                        className="w-full rounded-lg bg-zinc-100 py-2.5 pl-2 pr-2 text-sm text-zinc-900 ring-1 ring-inset ring-zinc-200/80"
                      >
                        <option value="">Unspecified</option>
                        <option value="SEDAN">Sedan</option>
                        <option value="SUV">SUV</option>
                        <option value="TRUCK">Truck</option>
                        <option value="VAN">Van</option>
                        <option value="COUPE">Coupe</option>
                        <option value="OTHER">Other</option>
                      </select>
                      {fieldErrors.vehicleType ? (
                        <p className="mt-1 text-xs text-red-600">{fieldErrors.vehicleType}</p>
                      ) : null}
                    </div>
                  </div>
                </section>

                <div className="flex flex-col items-stretch justify-between gap-4 border-t border-zinc-100 pt-5 md:flex-row md:items-center">
                  <div className="flex items-center gap-3">
                    <div className="flex -space-x-2">
                      {userLoaded && user?.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- Clerk avatars use dynamic hosts not in next/image allowlist
                        <img
                          src={user.imageUrl}
                          alt=""
                          className="h-10 w-10 rounded-full border-2 border-white object-cover"
                        />
                      ) : (
                        <div
                          className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-emerald-100 text-xs font-bold text-[#0d3d2e]"
                          aria-hidden
                        >
                          ?
                        </div>
                      )}
                      <div
                        className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-zinc-200 text-xs font-semibold text-zinc-600"
                        title="Fellow students may join your ride"
                        aria-hidden
                      >
                        +3
                      </div>
                    </div>
                    <p className="text-sm text-zinc-600">
                      Posting as{" "}
                      <span className="font-semibold text-[#0d3d2e]">Verified Student</span>
                    </p>
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="inline-flex min-w-[11rem] items-center justify-center rounded-xl bg-[#0d3d2e] px-8 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-[#0a3026] disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {isSubmitting ? (
                        <span className="inline-flex items-center gap-2">
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          {submitButtonLabel}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-2">
                          <Check className="h-4 w-4" strokeWidth={2.5} />
                          {submitButtonLabel}
                        </span>
                      )}
                    </button>
                  </div>
                </div>
              </motion.form>
            )}
          </AnimatePresence>
        </div>

        {offerTarget ? (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="send-offer-title"
          >
            <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
              <button
                type="button"
                onClick={closeSendOffer}
                className="absolute right-3 top-3 rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
              <h3 id="send-offer-title" className="pr-10 text-lg font-bold text-zinc-900">
                Send offer to rider
              </h3>
              <p className="mt-2 text-sm text-zinc-600">
                {offerTarget.originText} → {offerTarget.destinationText}
              </p>
              {offerError ? (
                <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {offerError}
                </div>
              ) : null}
              <div className="mt-4 space-y-3">
                <div>
                  <label htmlFor="offerSeats" className={labelClass}>
                    Seats offered
                  </label>
                  <input
                    id="offerSeats"
                    type="number"
                    min={1}
                    max={8}
                    value={offerForm.seatsOffered}
                    onChange={(e) =>
                      setOfferForm((prev) => ({ ...prev, seatsOffered: e.target.value }))
                    }
                    className="w-full rounded-lg bg-zinc-100 py-2.5 px-3 text-sm text-zinc-900 ring-1 ring-inset ring-zinc-200/80"
                  />
                  {offerFieldErrors.seatsOffered ? (
                    <p className="mt-1 text-xs text-red-600">{offerFieldErrors.seatsOffered}</p>
                  ) : null}
                </div>
                <div>
                  <label htmlFor="offerPrice" className={labelClass}>
                    Price (USD, total for this offer)
                  </label>
                  <div className="flex items-center gap-0 rounded-lg bg-zinc-100 ring-1 ring-inset ring-zinc-200/80">
                    <span className="pl-3 text-sm text-zinc-500">$</span>
                    <input
                      id="offerPrice"
                      type="number"
                      min={0}
                      step="0.01"
                      value={offerForm.priceDollars}
                      onChange={(e) =>
                        setOfferForm((prev) => ({ ...prev, priceDollars: e.target.value }))
                      }
                      className="min-w-0 flex-1 border-0 bg-transparent py-2.5 pr-3 text-sm text-zinc-900 outline-none"
                    />
                  </div>
                  {offerFieldErrors.priceDollars ? (
                    <p className="mt-1 text-xs text-red-600">{offerFieldErrors.priceDollars}</p>
                  ) : null}
                </div>
                <div>
                  <label htmlFor="offerMessage" className={labelClass}>
                    Message (optional)
                  </label>
                  <textarea
                    id="offerMessage"
                    rows={2}
                    value={offerForm.message}
                    onChange={(e) =>
                      setOfferForm((prev) => ({ ...prev, message: e.target.value }))
                    }
                    className="w-full rounded-lg bg-zinc-100 px-3 py-2 text-sm text-zinc-900 ring-1 ring-inset ring-zinc-200/80"
                  />
                  {offerFieldErrors.message ? (
                    <p className="mt-1 text-xs text-red-600">{offerFieldErrors.message}</p>
                  ) : null}
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeSendOffer}
                  className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={offerSubmitting}
                  onClick={() => void handleSendOffer()}
                  className="rounded-lg bg-[#0d3d2e] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0a3026] disabled:opacity-70"
                >
                  {offerSubmitting ? "Sending…" : "Send offer"}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <footer className="mt-auto border-t border-zinc-200/80 bg-[#f3f4f6] py-6">
          <div className="mx-auto flex max-w-4xl flex-col items-start justify-between gap-4 px-4 text-sm text-zinc-500 md:flex-row md:items-center md:px-6">
            <div>
              <span className="text-base font-extrabold text-[#0d3d2e]">Destination</span>
              <p className="mt-1 text-zinc-500">
                &copy; {year} Destination Stetson University. All rights reserved.
              </p>
            </div>
            <div className="flex flex-wrap gap-6">
              <a href="#help" className="text-zinc-600 transition hover:text-zinc-900">
                Help
              </a>
              <a href="#safety" className="text-zinc-600 transition hover:text-zinc-900">
                Safety
              </a>
              <a href="#terms" className="text-zinc-600 transition hover:text-zinc-900">
                Terms
              </a>
            </div>
          </div>
        </footer>
      </div>
    </ProtectedShell>
  );
}
