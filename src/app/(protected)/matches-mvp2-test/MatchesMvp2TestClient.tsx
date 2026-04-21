"use client";

import { type FormEvent, useMemo, useState } from "react";
import { ProtectedShell } from "../_components/ProtectedShell";

type DistanceCategory = "SHORT" | "MEDIUM" | "LONG";

interface MatchCandidate {
    rideId: string;
    originText: string;
    destinationText: string;
    departureTime: string;
    availableSeats: number;
    originDistance: number;
    destinationDistance: number;
    timeDifference: number;
    score: number;
}

interface MatchesApiResponse {
    items?: MatchCandidate[];
    error?: string;
    code?: string;
    message?: string;
}

interface ApiResult {
    status: number;
    body: unknown;
}

interface RideCreateForm {
    originText: string;
    destinationText: string;
    earliestDepartAtLocal: string;
    latestDepartAtLocal: string;
    distanceCategory: DistanceCategory;
    priceCents: string;
    seatsTotal: string;
}

interface TripRequestCreateForm {
    originText: string;
    destinationText: string;
    earliestDesiredAtLocal: string;
    latestDesiredAtLocal: string;
    distanceCategory: DistanceCategory;
    seatsNeeded: string;
}

function formatIso(value: string): string {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleString();
}

function toLocalInputValue(date: Date): string {
    const withOffset = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
    return withOffset.toISOString().slice(0, 16);
}

function localToIso(localValue: string): string | null {
    const trimmed = localValue.trim();
    if (!trimmed) return null;
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString();
}

async function parseApiResult(response: Response): Promise<ApiResult> {
    let body: unknown;
    try {
        body = await response.json();
    } catch {
        body = { message: "No JSON response body." };
    }
    return { status: response.status, body };
}

export default function MatchesMvp2TestClient() {
    const now = useMemo(() => new Date(), []);
    const earliest = useMemo(
        () => toLocalInputValue(new Date(now.getTime() + 60 * 60 * 1000)),
        [now]
    );
    const latest = useMemo(
        () => toLocalInputValue(new Date(now.getTime() + 3 * 60 * 60 * 1000)),
        [now]
    );

    const [tripRequestId, setTripRequestId] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [matches, setMatches] = useState<MatchCandidate[]>([]);
    const [responseStatus, setResponseStatus] = useState<number | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [rawBody, setRawBody] = useState<unknown>(null);

    const [rideCreate, setRideCreate] = useState<RideCreateForm>({
        originText: "Stetson University, DeLand, FL",
        destinationText: "Daytona Beach, FL",
        earliestDepartAtLocal: earliest,
        latestDepartAtLocal: latest,
        distanceCategory: "MEDIUM",
        priceCents: "1200",
        seatsTotal: "2",
    });
    const [tripCreate, setTripCreate] = useState<TripRequestCreateForm>({
        originText: "Stetson University, DeLand, FL",
        destinationText: "Daytona Beach, FL",
        earliestDesiredAtLocal: earliest,
        latestDesiredAtLocal: latest,
        distanceCategory: "MEDIUM",
        seatsNeeded: "1",
    });
    const [rideCreateResult, setRideCreateResult] = useState<ApiResult | null>(null);
    const [tripCreateResult, setTripCreateResult] = useState<ApiResult | null>(null);
    const [isRideCreating, setIsRideCreating] = useState(false);
    const [isTripCreating, setIsTripCreating] = useState(false);

    const hasMatches = matches.length > 0;

    const summaryText = useMemo(() => {
        if (responseStatus === null) return "Run a request to see match results.";
        if (errorMessage) return errorMessage;
        if (!hasMatches) return "No matches returned for this trip request.";
        return `Returned ${matches.length} candidate ride${
            matches.length === 1 ? "" : "s"
        }.`;
    }, [errorMessage, hasMatches, matches.length, responseStatus]);

    async function handleCreateRide(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setIsRideCreating(true);
        try {
            const earliestDepartAt = localToIso(rideCreate.earliestDepartAtLocal);
            const latestDepartAt = localToIso(rideCreate.latestDepartAtLocal);

            if (!earliestDepartAt || !latestDepartAt) {
                setRideCreateResult({
                    status: 400,
                    body: { message: "Provide valid ride date-time fields." },
                });
                return;
            }

            const payload = {
                originText: rideCreate.originText,
                destinationText: rideCreate.destinationText,
                earliestDepartAt,
                latestDepartAt,
                distanceCategory: rideCreate.distanceCategory,
                priceCents: Number.parseInt(rideCreate.priceCents, 10),
                seatsTotal: Number.parseInt(rideCreate.seatsTotal, 10),
            };

            const response = await fetch("/api/rides", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Idempotency-Key": crypto.randomUUID(),
                },
                body: JSON.stringify(payload),
            });

            setRideCreateResult(await parseApiResult(response));
        } finally {
            setIsRideCreating(false);
        }
    }

    async function handleCreateTripRequest(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setIsTripCreating(true);
        try {
            const earliestDesiredAt = localToIso(tripCreate.earliestDesiredAtLocal);
            const latestDesiredAt = localToIso(tripCreate.latestDesiredAtLocal);

            if (!earliestDesiredAt || !latestDesiredAt) {
                setTripCreateResult({
                    status: 400,
                    body: { message: "Provide valid trip request date-time fields." },
                });
                return;
            }

            const payload = {
                originText: tripCreate.originText,
                destinationText: tripCreate.destinationText,
                earliestDesiredAt,
                latestDesiredAt,
                distanceCategory: tripCreate.distanceCategory,
                seatsNeeded: Number.parseInt(tripCreate.seatsNeeded, 10),
            };

            const response = await fetch("/api/trip-requests", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Idempotency-Key": crypto.randomUUID(),
                },
                body: JSON.stringify(payload),
            });

            const result = await parseApiResult(response);
            setTripCreateResult(result);

            const maybeId =
                result.body &&
                typeof result.body === "object" &&
                "id" in (result.body as Record<string, unknown>)
                    ? (result.body as { id?: unknown }).id
                    : null;
            if (typeof maybeId === "string" && maybeId.trim().length > 0) {
                setTripRequestId(maybeId);
            }
        } finally {
            setIsTripCreating(false);
        }
    }

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const trimmedTripRequestId = tripRequestId.trim();

        if (!trimmedTripRequestId) {
            setResponseStatus(400);
            setErrorMessage("Trip Request ID is required.");
            setMatches([]);
            setRawBody({ message: "Trip Request ID is required." });
            return;
        }

        setIsLoading(true);
        setErrorMessage(null);
        setMatches([]);

        try {
            const response = await fetch(
                `/api/trip-requests/${encodeURIComponent(
                    trimmedTripRequestId
                )}/matches`,
                {
                    method: "GET",
                }
            );

            let payload: MatchesApiResponse | Record<string, unknown> = {};
            try {
                payload = (await response.json()) as MatchesApiResponse;
            } catch {
                payload = { message: "No JSON response body." };
            }

            setResponseStatus(response.status);
            setRawBody(payload);

            if (!response.ok) {
                const message =
                    typeof payload.message === "string"
                        ? payload.message
                        : "Match request failed.";
                const code =
                    typeof payload.code === "string" ? ` (${payload.code})` : "";
                setErrorMessage(`HTTP ${response.status}${code}: ${message}`);
                return;
            }

            const items = Array.isArray(payload.items)
                ? (payload.items as MatchCandidate[])
                : [];
            setMatches(items);
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <ProtectedShell activeNav="browseTripRequests">
            <div className="bg-white border border-zinc-200 rounded-2xl p-6 md:p-8 space-y-2">
                <h1 className="text-2xl font-bold">MVP2 Matches Test Page</h1>
                <p className="text-sm text-zinc-600">
                    Dummy UI to test <code>GET /api/trip-requests/:id/matches</code>.
                </p>
            </div>

            <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <form
                    onSubmit={handleCreateRide}
                    className="bg-white border border-zinc-200 rounded-2xl p-5 md:p-6 space-y-3"
                >
                    <h2 className="text-lg font-semibold">Create Ride</h2>
                    <input
                        className="w-full rounded-lg border border-zinc-300 p-2.5 text-sm"
                        value={rideCreate.originText}
                        onChange={(event) =>
                            setRideCreate((prev) => ({
                                ...prev,
                                originText: event.target.value,
                            }))
                        }
                        placeholder="originText"
                    />
                    <input
                        className="w-full rounded-lg border border-zinc-300 p-2.5 text-sm"
                        value={rideCreate.destinationText}
                        onChange={(event) =>
                            setRideCreate((prev) => ({
                                ...prev,
                                destinationText: event.target.value,
                            }))
                        }
                        placeholder="destinationText"
                    />
                    <div className="grid grid-cols-2 gap-2">
                        <input
                            type="datetime-local"
                            className="rounded-lg border border-zinc-300 p-2.5 text-sm"
                            value={rideCreate.earliestDepartAtLocal}
                            onChange={(event) =>
                                setRideCreate((prev) => ({
                                    ...prev,
                                    earliestDepartAtLocal: event.target.value,
                                }))
                            }
                        />
                        <input
                            type="datetime-local"
                            className="rounded-lg border border-zinc-300 p-2.5 text-sm"
                            value={rideCreate.latestDepartAtLocal}
                            onChange={(event) =>
                                setRideCreate((prev) => ({
                                    ...prev,
                                    latestDepartAtLocal: event.target.value,
                                }))
                            }
                        />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        <select
                            className="rounded-lg border border-zinc-300 p-2.5 text-sm"
                            value={rideCreate.distanceCategory}
                            onChange={(event) =>
                                setRideCreate((prev) => ({
                                    ...prev,
                                    distanceCategory: event.target
                                        .value as DistanceCategory,
                                }))
                            }
                        >
                            <option value="SHORT">SHORT</option>
                            <option value="MEDIUM">MEDIUM</option>
                            <option value="LONG">LONG</option>
                        </select>
                        <input
                            className="rounded-lg border border-zinc-300 p-2.5 text-sm"
                            value={rideCreate.priceCents}
                            onChange={(event) =>
                                setRideCreate((prev) => ({
                                    ...prev,
                                    priceCents: event.target.value,
                                }))
                            }
                            placeholder="priceCents"
                        />
                        <input
                            className="rounded-lg border border-zinc-300 p-2.5 text-sm"
                            value={rideCreate.seatsTotal}
                            onChange={(event) =>
                                setRideCreate((prev) => ({
                                    ...prev,
                                    seatsTotal: event.target.value,
                                }))
                            }
                            placeholder="seatsTotal"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={isRideCreating}
                        className="rounded-lg bg-emerald-600 text-white px-4 py-2 text-sm font-medium disabled:opacity-60"
                    >
                        {isRideCreating ? "Creating..." : "Create Ride"}
                    </button>
                    {rideCreateResult ? (
                        <pre className="text-xs bg-zinc-900 text-zinc-100 rounded-lg p-3 overflow-auto">
                            {JSON.stringify(rideCreateResult, null, 2)}
                        </pre>
                    ) : null}
                </form>

                <form
                    onSubmit={handleCreateTripRequest}
                    className="bg-white border border-zinc-200 rounded-2xl p-5 md:p-6 space-y-3"
                >
                    <h2 className="text-lg font-semibold">Create Trip Request</h2>
                    <input
                        className="w-full rounded-lg border border-zinc-300 p-2.5 text-sm"
                        value={tripCreate.originText}
                        onChange={(event) =>
                            setTripCreate((prev) => ({
                                ...prev,
                                originText: event.target.value,
                            }))
                        }
                        placeholder="originText"
                    />
                    <input
                        className="w-full rounded-lg border border-zinc-300 p-2.5 text-sm"
                        value={tripCreate.destinationText}
                        onChange={(event) =>
                            setTripCreate((prev) => ({
                                ...prev,
                                destinationText: event.target.value,
                            }))
                        }
                        placeholder="destinationText"
                    />
                    <div className="grid grid-cols-2 gap-2">
                        <input
                            type="datetime-local"
                            className="rounded-lg border border-zinc-300 p-2.5 text-sm"
                            value={tripCreate.earliestDesiredAtLocal}
                            onChange={(event) =>
                                setTripCreate((prev) => ({
                                    ...prev,
                                    earliestDesiredAtLocal: event.target.value,
                                }))
                            }
                        />
                        <input
                            type="datetime-local"
                            className="rounded-lg border border-zinc-300 p-2.5 text-sm"
                            value={tripCreate.latestDesiredAtLocal}
                            onChange={(event) =>
                                setTripCreate((prev) => ({
                                    ...prev,
                                    latestDesiredAtLocal: event.target.value,
                                }))
                            }
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <select
                            className="rounded-lg border border-zinc-300 p-2.5 text-sm"
                            value={tripCreate.distanceCategory}
                            onChange={(event) =>
                                setTripCreate((prev) => ({
                                    ...prev,
                                    distanceCategory: event.target
                                        .value as DistanceCategory,
                                }))
                            }
                        >
                            <option value="SHORT">SHORT</option>
                            <option value="MEDIUM">MEDIUM</option>
                            <option value="LONG">LONG</option>
                        </select>
                        <input
                            className="rounded-lg border border-zinc-300 p-2.5 text-sm"
                            value={tripCreate.seatsNeeded}
                            onChange={(event) =>
                                setTripCreate((prev) => ({
                                    ...prev,
                                    seatsNeeded: event.target.value,
                                }))
                            }
                            placeholder="seatsNeeded"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={isTripCreating}
                        className="rounded-lg bg-emerald-600 text-white px-4 py-2 text-sm font-medium disabled:opacity-60"
                    >
                        {isTripCreating ? "Creating..." : "Create Trip Request"}
                    </button>
                    {tripCreateResult ? (
                        <pre className="text-xs bg-zinc-900 text-zinc-100 rounded-lg p-3 overflow-auto">
                            {JSON.stringify(tripCreateResult, null, 2)}
                        </pre>
                    ) : null}
                </form>
            </section>

            <form
                onSubmit={handleSubmit}
                className="bg-white border border-zinc-200 rounded-2xl p-5 md:p-6 space-y-4"
            >
                <label className="flex flex-col gap-2">
                    <span className="text-sm font-medium text-zinc-700">
                        Trip Request ID
                    </span>
                    <input
                        type="text"
                        className="w-full rounded-lg border border-zinc-300 p-2.5 text-sm"
                        placeholder="tripRequestId"
                        value={tripRequestId}
                        onChange={(event) => setTripRequestId(event.target.value)}
                    />
                </label>

                <div className="flex items-center gap-3">
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="rounded-lg bg-emerald-600 text-white px-4 py-2 text-sm font-medium disabled:opacity-60"
                    >
                        {isLoading ? "Finding..." : "Find Matches"}
                    </button>
                    <span className="text-sm text-zinc-600">{summaryText}</span>
                </div>
            </form>

            <section className="bg-white border border-zinc-200 rounded-2xl p-5 md:p-6 space-y-4">
                <h2 className="text-lg font-semibold">Candidates</h2>

                {!hasMatches ? (
                    <p className="text-sm text-zinc-600">
                        No candidate rides to display.
                    </p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead>
                                <tr className="text-left text-zinc-600 border-b border-zinc-200">
                                    <th className="py-2 pr-4">Ride</th>
                                    <th className="py-2 pr-4">Departure</th>
                                    <th className="py-2 pr-4">Seats</th>
                                    <th className="py-2 pr-4">Origin km</th>
                                    <th className="py-2 pr-4">Destination km</th>
                                    <th className="py-2 pr-4">Time min</th>
                                    <th className="py-2 pr-4">Score</th>
                                </tr>
                            </thead>
                            <tbody>
                                {matches.map((match) => (
                                    <tr
                                        key={match.rideId}
                                        className="border-b border-zinc-100 align-top"
                                    >
                                        <td className="py-2 pr-4">
                                            <div className="font-medium text-zinc-900">
                                                {match.rideId}
                                            </div>
                                            <div className="text-xs text-zinc-500">
                                                {match.originText} {"->"}{" "}
                                                {match.destinationText}
                                            </div>
                                        </td>
                                        <td className="py-2 pr-4">
                                            {formatIso(match.departureTime)}
                                        </td>
                                        <td className="py-2 pr-4">
                                            {match.availableSeats}
                                        </td>
                                        <td className="py-2 pr-4">
                                            {match.originDistance}
                                        </td>
                                        <td className="py-2 pr-4">
                                            {match.destinationDistance}
                                        </td>
                                        <td className="py-2 pr-4">
                                            {match.timeDifference}
                                        </td>
                                        <td className="py-2 pr-4">{match.score}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            <section className="bg-white border border-zinc-200 rounded-2xl p-5 md:p-6 space-y-2">
                <h2 className="text-lg font-semibold">Raw Response</h2>
                <p className="text-xs text-zinc-500">
                    Status: {responseStatus === null ? "n/a" : responseStatus}
                </p>
                <pre className="text-xs bg-zinc-900 text-zinc-100 rounded-lg p-3 overflow-auto">
                    {JSON.stringify(rawBody, null, 2)}
                </pre>
            </section>
        </ProtectedShell>
    );
}
