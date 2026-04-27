"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { ProtectedShell } from "../_components/ProtectedShell";
import { LocationAutocompleteInput } from "@/components/LocationAutocompleteInput";
import {
  createEmptyLocationField,
  createLocationFieldFromSelection,
  updateLocationFieldInput,
} from "@/lib/location-field";
import {
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

export default function PostTripRequestPage() {
  const [formValues, setFormValues] =
    useState<PostTripRequestFormValues>(initialFormValues);
  const [fieldErrors, setFieldErrors] = useState<PostTripRequestFieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    if (!isSuccess) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setIsSuccess(false);
      setFormValues(initialFormValues);
      setFieldErrors({});
      setSubmitError(null);
      setShowAdvanced(false);
    }, 2500);

    return () => window.clearTimeout(timeoutId);
  }, [isSuccess]);

  const submitButtonLabel = useMemo(() => {
    if (isSubmitting) {
      return "Posting...";
    }

    return "Post Trip Request";
  }, [isSubmitting]);

  const computedDistanceCategory = useMemo(
    () => distanceCategoryFromLocationFields(formValues.origin, formValues.destination),
    [formValues.origin, formValues.destination],
  );

  type NonLocationField = Exclude<
    keyof PostTripRequestFormValues,
    | "origin"
    | "destination"
  >;

  function updateField<K extends NonLocationField>(
    field: K,
    value: PostTripRequestFormValues[K],
  ) {
    setFormValues((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function updateLocationInput(
    field: "origin" | "destination",
    nextValue: string,
  ) {
    if (field === "origin") {
      setFormValues((prev) => ({
        ...prev,
        origin: updateLocationFieldInput(prev.origin, nextValue),
      }));
      setFieldErrors((prev) => ({
        ...prev,
        originText: undefined,
        distanceCategory: undefined,
      }));
      return;
    }

    setFormValues((prev) => ({
      ...prev,
      destination: updateLocationFieldInput(prev.destination, nextValue),
    }));
    setFieldErrors((prev) => ({
      ...prev,
      destinationText: undefined,
      distanceCategory: undefined,
    }));
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
      setFieldErrors((prev) => ({
        ...prev,
        originText: undefined,
        distanceCategory: undefined,
      }));
      return;
    }

    setFormValues((prev) => ({
      ...prev,
      destination: createLocationFieldFromSelection(selection),
    }));
    setFieldErrors((prev) => ({
      ...prev,
      destinationText: undefined,
      distanceCategory: undefined,
    }));
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

  return (
    <ProtectedShell activeNav="browseTripRequests">
      <div className="md:hidden px-1">
        <h1 className="text-2xl font-bold tracking-tight mb-1">Post a Trip Request</h1>
        <p className="text-zinc-500 text-sm">
          Share your route and desired departure window with verified Stetson
          students.
        </p>
      </div>

      <div className="hidden md:block w-full max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-zinc-100">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-2">
            Post a Trip Request
          </h1>
          <p className="text-zinc-500">
            Share your route and desired departure window with verified Stetson
            students.
          </p>
        </div>
      </div>

      <div className="w-full md:max-w-4xl md:mx-auto">
        <AnimatePresence mode="wait">
          {isSuccess ? (
            <motion.section
              key="success-state"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="bg-white rounded-2xl p-8 md:p-10 shadow-sm border border-zinc-100 flex flex-col items-center text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 220, damping: 16 }}
                className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-5"
              >
                <motion.svg
                  width="52"
                  height="52"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
                >
                  <motion.polyline points="20 6 9 17 4 12" />
                </motion.svg>
              </motion.div>
              <h2 className="text-3xl font-bold text-zinc-900 mb-2">
                Trip Request Posted Successfully
              </h2>
              <p className="text-zinc-500 max-w-md">
                Your trip request is now live.
              </p>
            </motion.section>
          ) : (
            <motion.form
              key="post-trip-request-form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onSubmit={handleSubmit}
              className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-zinc-100 space-y-6 overflow-x-hidden"
            >
              {submitError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {submitError}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <LocationAutocompleteInput
                  id="originText"
                  label="Origin"
                  placeholder="Enter origin location..."
                  locationField={formValues.origin}
                  error={fieldErrors.originText}
                  onInputChange={(nextValue) =>
                    updateLocationInput("origin", nextValue)
                  }
                  onSuggestionSelect={(selection) =>
                    applyLocationSelection("origin", selection)
                  }
                />

                <LocationAutocompleteInput
                  id="destinationText"
                  label="Destination"
                  placeholder="Enter destination location..."
                  locationField={formValues.destination}
                  error={fieldErrors.destinationText}
                  onInputChange={(nextValue) =>
                    updateLocationInput("destination", nextValue)
                  }
                  onSuggestionSelect={(selection) =>
                    applyLocationSelection("destination", selection)
                  }
                />
              </div>

              <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-5 md:p-6 overflow-x-hidden">
                <div className="flex items-center gap-2 mb-4 text-emerald-800 font-bold text-lg">
                  Departure Window
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="min-w-0 flex flex-col items-center md:items-stretch">
                    <div className="w-full max-w-[16rem] md:max-w-none">
                      <label
                        htmlFor="earliestDesiredAt"
                        className="block text-sm font-medium text-zinc-600 mb-1"
                      >
                        Earliest
                      </label>
                      <input
                        id="earliestDesiredAt"
                        type="datetime-local"
                        value={formValues.earliestDesiredAt}
                        onChange={(e) =>
                          updateField("earliestDesiredAt", e.target.value)
                        }
                        className="block w-full min-w-0 max-w-full bg-white border border-zinc-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl p-2.5 text-sm text-zinc-900 shadow-sm outline-none"
                      />
                    </div>
                    {fieldErrors.earliestDesiredAt && (
                      <p className="mt-1 text-sm text-red-600">
                        {fieldErrors.earliestDesiredAt}
                      </p>
                    )}
                  </div>
                  <div className="min-w-0 flex flex-col items-center md:items-stretch">
                    <div className="w-full max-w-[16rem] md:max-w-none">
                      <label
                        htmlFor="latestDesiredAt"
                        className="block text-sm font-medium text-zinc-600 mb-1"
                      >
                        Latest
                      </label>
                      <input
                        id="latestDesiredAt"
                        type="datetime-local"
                        value={formValues.latestDesiredAt}
                        onChange={(e) =>
                          updateField("latestDesiredAt", e.target.value)
                        }
                        className="block w-full min-w-0 max-w-full bg-white border border-zinc-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl p-2.5 text-sm text-zinc-900 shadow-sm outline-none"
                      />
                    </div>
                    {fieldErrors.latestDesiredAt && (
                      <p className="mt-1 text-sm text-red-600">
                        {fieldErrors.latestDesiredAt}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="seatsNeeded"
                    className="block text-sm font-semibold text-emerald-800 mb-2"
                  >
                    Seats Needed
                  </label>
                  <input
                    id="seatsNeeded"
                    type="number"
                    min="1"
                    max="8"
                    step="1"
                    value={formValues.seatsNeeded}
                    onChange={(e) => updateField("seatsNeeded", e.target.value)}
                    className="w-full bg-white border border-zinc-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl p-3 text-zinc-900 transition-all outline-none"
                  />
                  {fieldErrors.seatsNeeded && (
                    <p className="mt-1 text-sm text-red-600">{fieldErrors.seatsNeeded}</p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="distanceCategoryDisplay"
                    className="block text-sm font-semibold text-emerald-800 mb-2"
                  >
                    Distance Category
                  </label>
                  <input
                    id="distanceCategoryDisplay"
                    type="text"
                    readOnly
                    disabled
                    value={
                      computedDistanceCategory
                        ? formatPostRideDistanceCategory(computedDistanceCategory)
                        : "Select origin and destination first"
                    }
                    className="w-full cursor-not-allowed bg-zinc-100 border border-zinc-200 rounded-xl p-3 text-zinc-800"
                  />
                  {fieldErrors.distanceCategory && (
                    <p className="mt-1 text-sm text-red-600">
                      {fieldErrors.distanceCategory}
                    </p>
                  )}
                </div>
              </div>

              <div className="border border-zinc-200 rounded-2xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowAdvanced((prev) => !prev)}
                  className="w-full flex items-center justify-between px-5 py-4 bg-zinc-50 hover:bg-zinc-100 transition-colors"
                >
                  <span className="font-semibold text-zinc-800">Advanced (Optional)</span>
                  <ChevronDown
                    size={18}
                    className={`transition-transform ${showAdvanced ? "rotate-180" : ""}`}
                  />
                </button>
                {showAdvanced && (
                  <div className="p-5 md:p-6 space-y-4 bg-white">
                    <div>
                      <label
                        htmlFor="pickupInstructions"
                        className="block text-sm font-medium text-zinc-600 mb-1"
                      >
                        Pickup Instructions
                      </label>
                      <textarea
                        id="pickupInstructions"
                        rows={3}
                        value={formValues.pickupInstructions}
                        onChange={(e) =>
                          updateField("pickupInstructions", e.target.value)
                        }
                        className="w-full bg-white border border-zinc-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl p-3 text-zinc-900 transition-all outline-none"
                        placeholder="Optional pickup notes..."
                      />
                      {fieldErrors.pickupInstructions && (
                        <p className="mt-1 text-sm text-red-600">
                          {fieldErrors.pickupInstructions}
                        </p>
                      )}
                    </div>

                    <div>
                      <label
                        htmlFor="dropoffInstructions"
                        className="block text-sm font-medium text-zinc-600 mb-1"
                      >
                        Dropoff Instructions
                      </label>
                      <textarea
                        id="dropoffInstructions"
                        rows={3}
                        value={formValues.dropoffInstructions}
                        onChange={(e) =>
                          updateField("dropoffInstructions", e.target.value)
                        }
                        className="w-full bg-white border border-zinc-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl p-3 text-zinc-900 transition-all outline-none"
                        placeholder="Optional dropoff notes..."
                      />
                      {fieldErrors.dropoffInstructions && (
                        <p className="mt-1 text-sm text-red-600">
                          {fieldErrors.dropoffInstructions}
                        </p>
                      )}
                    </div>

                    <div>
                      <label
                        htmlFor="preferredDepartAt"
                        className="block text-sm font-medium text-zinc-600 mb-1"
                      >
                        Preferred Departure
                      </label>
                      <input
                        id="preferredDepartAt"
                        type="datetime-local"
                        value={formValues.preferredDepartAt}
                        onChange={(e) =>
                          updateField("preferredDepartAt", e.target.value)
                        }
                        className="block w-full min-w-0 max-w-full bg-white border border-zinc-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl p-2.5 text-sm text-zinc-900 shadow-sm outline-none"
                      />
                      {fieldErrors.preferredDepartAt && (
                        <p className="mt-1 text-sm text-red-600">
                          {fieldErrors.preferredDepartAt}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-8 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white font-medium rounded-xl shadow-sm transition-colors text-lg disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {submitButtonLabel}
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </ProtectedShell>
  );
}
