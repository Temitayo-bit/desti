"use client";

import { useMemo, useState, type FormEvent } from "react";
import { ProtectedShell } from "../_components/ProtectedShell";

type DistanceCategory = "SHORT" | "MEDIUM" | "LONG";

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

function toLocalInputValue(date: Date): string {
  const withOffset = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return withOffset.toISOString().slice(0, 16);
}

function localToIso(localValue: string): string | null {
  const trimmed = localValue.trim();
  if (!trimmed) return null;

  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return null;

  return date.toISOString();
}

async function parseApiResult(response: Response): Promise<ApiResult> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = { message: "No JSON response body" };
  }

  return { status: response.status, body };
}

function pretty(result: ApiResult | null): string {
  if (!result) return "";
  return JSON.stringify(result, null, 2);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Network error";
}

export default function RideOffersMvp2TestClient() {
  const now = useMemo(() => new Date(), []);
  const defaultEarliest = useMemo(
    () => toLocalInputValue(new Date(now.getTime() + 60 * 60 * 1000)),
    [now]
  );
  const defaultLatest = useMemo(
    () => toLocalInputValue(new Date(now.getTime() + 3 * 60 * 60 * 1000)),
    [now]
  );

  const [rideForm, setRideForm] = useState<RideCreateForm>({
    originText: "Stetson University, DeLand, FL",
    destinationText: "Orlando, FL",
    earliestDepartAtLocal: defaultEarliest,
    latestDepartAtLocal: defaultLatest,
    distanceCategory: "MEDIUM",
    priceCents: "1400",
    seatsTotal: "2",
  });

  const [offerRideId, setOfferRideId] = useState("");
  const [offeredPriceCents, setOfferedPriceCents] = useState("1200");
  const [incomingRideId, setIncomingRideId] = useState("");
  const [offerActionId, setOfferActionId] = useState("");

  const [rideCreateResult, setRideCreateResult] = useState<ApiResult | null>(null);
  const [createOfferResult, setCreateOfferResult] = useState<ApiResult | null>(null);
  const [incomingResult, setIncomingResult] = useState<ApiResult | null>(null);
  const [outgoingResult, setOutgoingResult] = useState<ApiResult | null>(null);
  const [acceptResult, setAcceptResult] = useState<ApiResult | null>(null);
  const [rejectResult, setRejectResult] = useState<ApiResult | null>(null);

  const [isCreatingRide, setIsCreatingRide] = useState(false);
  const [isCreatingOffer, setIsCreatingOffer] = useState(false);
  const [isLoadingIncoming, setIsLoadingIncoming] = useState(false);
  const [isLoadingOutgoing, setIsLoadingOutgoing] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);

  async function submitCreateRide(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsCreatingRide(true);

    try {
      const earliestDepartAt = localToIso(rideForm.earliestDepartAtLocal);
      const latestDepartAt = localToIso(rideForm.latestDepartAtLocal);

      if (!earliestDepartAt || !latestDepartAt) {
        setRideCreateResult({
          status: 400,
          body: {
            error: "Validation Error",
            message: "Earliest and latest departure must be valid date-time values.",
          },
        });
        return;
      }

      const payload = {
        originText: rideForm.originText,
        destinationText: rideForm.destinationText,
        earliestDepartAt,
        latestDepartAt,
        distanceCategory: rideForm.distanceCategory,
        priceCents: Number.parseInt(rideForm.priceCents, 10),
        seatsTotal: Number.parseInt(rideForm.seatsTotal, 10),
      };

      const response = await fetch("/api/rides", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify(payload),
      });

      const parsed = await parseApiResult(response);
      setRideCreateResult(parsed);

      const maybeRideId =
        parsed.body && typeof parsed.body === "object" && "id" in parsed.body
          ? (parsed.body as { id?: unknown }).id
          : null;

      if (typeof maybeRideId === "string" && maybeRideId.length > 0) {
        setIncomingRideId(maybeRideId);
      }
    } catch (error) {
      setRideCreateResult({ status: 0, body: { message: getErrorMessage(error) } });
    } finally {
      setIsCreatingRide(false);
    }
  }

  async function submitCreateOffer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const rideId = offerRideId.trim();
    if (!rideId) {
      setCreateOfferResult({ status: 400, body: { message: "Ride ID is required." } });
      return;
    }

    const price = Number.parseInt(offeredPriceCents, 10);
    if (!Number.isInteger(price) || price <= 0) {
      setCreateOfferResult({ status: 400, body: { message: "offeredPriceCents must be a positive integer." } });
      return;
    }

    setIsCreatingOffer(true);
    try {
      const response = await fetch(`/api/rides/${encodeURIComponent(rideId)}/offers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offeredPriceCents: price }),
      });
      setCreateOfferResult(await parseApiResult(response));
    } catch (error) {
      setCreateOfferResult({ status: 0, body: { message: getErrorMessage(error) } });
    } finally {
      setIsCreatingOffer(false);
    }
  }

  async function fetchIncomingOffers() {
    const rideId = incomingRideId.trim();
    if (!rideId) {
      setIncomingResult({ status: 400, body: { message: "Ride ID is required." } });
      return;
    }

    setIsLoadingIncoming(true);
    try {
      const response = await fetch(`/api/rides/${encodeURIComponent(rideId)}/offers`);
      setIncomingResult(await parseApiResult(response));
    } catch (error) {
      setIncomingResult({ status: 0, body: { message: getErrorMessage(error) } });
    } finally {
      setIsLoadingIncoming(false);
    }
  }

  async function fetchOutgoingOffers() {
    setIsLoadingOutgoing(true);
    try {
      const response = await fetch("/api/me/ride-offers/outgoing");
      setOutgoingResult(await parseApiResult(response));
    } catch (error) {
      setOutgoingResult({ status: 0, body: { message: getErrorMessage(error) } });
    } finally {
      setIsLoadingOutgoing(false);
    }
  }

  async function acceptOffer() {
    const offerId = offerActionId.trim();
    if (!offerId) {
      setAcceptResult({ status: 400, body: { message: "Offer ID is required." } });
      return;
    }

    setIsAccepting(true);
    try {
      const response = await fetch(`/api/ride-offers/${encodeURIComponent(offerId)}/accept`, {
        method: "POST",
      });
      setAcceptResult(await parseApiResult(response));
    } catch (error) {
      setAcceptResult({ status: 0, body: { message: getErrorMessage(error) } });
    } finally {
      setIsAccepting(false);
    }
  }

  async function rejectOffer() {
    const offerId = offerActionId.trim();
    if (!offerId) {
      setRejectResult({ status: 400, body: { message: "Offer ID is required." } });
      return;
    }

    setIsRejecting(true);
    try {
      const response = await fetch(`/api/ride-offers/${encodeURIComponent(offerId)}/reject`, {
        method: "POST",
      });
      setRejectResult(await parseApiResult(response));
    } catch (error) {
      setRejectResult({ status: 0, body: { message: getErrorMessage(error) } });
    } finally {
      setIsRejecting(false);
    }
  }

  return (
    <ProtectedShell activeNav="browse">
      <div className="bg-white border border-zinc-200 rounded-2xl p-6 md:p-8 space-y-2">
        <h1 className="text-2xl font-bold">Ride Offers MVP2 Test Page</h1>
        <p className="text-sm text-zinc-600">
          Dummy UI to manually test ride-offer negotiation endpoints.
        </p>
      </div>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <form onSubmit={submitCreateRide} className="bg-white border border-zinc-200 rounded-2xl p-5 space-y-3">
          <h2 className="font-semibold text-lg">1) Driver Seed: Create Ride</h2>
          <input
            className="w-full rounded-lg border border-zinc-300 p-2"
            value={rideForm.originText}
            onChange={(event) => setRideForm((prev) => ({ ...prev, originText: event.target.value }))}
            placeholder="originText"
          />
          <input
            className="w-full rounded-lg border border-zinc-300 p-2"
            value={rideForm.destinationText}
            onChange={(event) => setRideForm((prev) => ({ ...prev, destinationText: event.target.value }))}
            placeholder="destinationText"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="datetime-local"
              className="rounded-lg border border-zinc-300 p-2"
              value={rideForm.earliestDepartAtLocal}
              onChange={(event) =>
                setRideForm((prev) => ({ ...prev, earliestDepartAtLocal: event.target.value }))
              }
            />
            <input
              type="datetime-local"
              className="rounded-lg border border-zinc-300 p-2"
              value={rideForm.latestDepartAtLocal}
              onChange={(event) =>
                setRideForm((prev) => ({ ...prev, latestDepartAtLocal: event.target.value }))
              }
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <select
              className="rounded-lg border border-zinc-300 p-2"
              value={rideForm.distanceCategory}
              onChange={(event) =>
                setRideForm((prev) => ({ ...prev, distanceCategory: event.target.value as DistanceCategory }))
              }
            >
              <option value="SHORT">SHORT</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="LONG">LONG</option>
            </select>
            <input
              className="rounded-lg border border-zinc-300 p-2"
              value={rideForm.priceCents}
              onChange={(event) => setRideForm((prev) => ({ ...prev, priceCents: event.target.value }))}
              placeholder="priceCents"
            />
            <input
              className="rounded-lg border border-zinc-300 p-2"
              value={rideForm.seatsTotal}
              onChange={(event) => setRideForm((prev) => ({ ...prev, seatsTotal: event.target.value }))}
              placeholder="seatsTotal"
            />
          </div>
          <button type="submit" className="rounded-lg bg-emerald-600 text-white px-4 py-2 text-sm" disabled={isCreatingRide}>
            {isCreatingRide ? "Creating..." : "Create Ride"}
          </button>
          {rideCreateResult && <pre className="text-xs bg-zinc-900 text-zinc-100 rounded-lg p-3 overflow-auto">{pretty(rideCreateResult)}</pre>}
        </form>

        <form onSubmit={submitCreateOffer} className="bg-white border border-zinc-200 rounded-2xl p-5 space-y-3">
          <h2 className="font-semibold text-lg">2) Rider Action: Create Offer</h2>
          <input
            className="w-full rounded-lg border border-zinc-300 p-2"
            value={offerRideId}
            onChange={(event) => setOfferRideId(event.target.value)}
            placeholder="rideId"
          />
          <input
            className="w-full rounded-lg border border-zinc-300 p-2"
            value={offeredPriceCents}
            onChange={(event) => setOfferedPriceCents(event.target.value)}
            placeholder="offeredPriceCents"
          />
          <button type="submit" className="rounded-lg bg-emerald-600 text-white px-4 py-2 text-sm" disabled={isCreatingOffer}>
            {isCreatingOffer ? "Creating..." : "Create Ride Offer"}
          </button>
          {createOfferResult && <pre className="text-xs bg-zinc-900 text-zinc-100 rounded-lg p-3 overflow-auto">{pretty(createOfferResult)}</pre>}
        </form>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 space-y-3">
          <h2 className="font-semibold text-lg">3) Driver Action: List Incoming Offers</h2>
          <input
            className="w-full rounded-lg border border-zinc-300 p-2"
            value={incomingRideId}
            onChange={(event) => setIncomingRideId(event.target.value)}
            placeholder="rideId"
          />
          <button
            type="button"
            className="rounded-lg bg-blue-600 text-white px-4 py-2 text-sm"
            onClick={fetchIncomingOffers}
            disabled={isLoadingIncoming}
          >
            {isLoadingIncoming ? "Loading..." : "Load Incoming Offers"}
          </button>
          {incomingResult && <pre className="text-xs bg-zinc-900 text-zinc-100 rounded-lg p-3 overflow-auto">{pretty(incomingResult)}</pre>}
        </div>

        <div className="bg-white border border-zinc-200 rounded-2xl p-5 space-y-3">
          <h2 className="font-semibold text-lg">4) Rider Action: List Outgoing Offers</h2>
          <button
            type="button"
            className="rounded-lg bg-blue-600 text-white px-4 py-2 text-sm"
            onClick={fetchOutgoingOffers}
            disabled={isLoadingOutgoing}
          >
            {isLoadingOutgoing ? "Loading..." : "Load Outgoing Offers"}
          </button>
          {outgoingResult && <pre className="text-xs bg-zinc-900 text-zinc-100 rounded-lg p-3 overflow-auto">{pretty(outgoingResult)}</pre>}
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 space-y-3">
          <h2 className="font-semibold text-lg">5) Driver Action: Accept / Reject</h2>
          <input
            className="w-full rounded-lg border border-zinc-300 p-2"
            value={offerActionId}
            onChange={(event) => setOfferActionId(event.target.value)}
            placeholder="offerId"
          />
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-lg bg-emerald-600 text-white px-4 py-2 text-sm"
              onClick={acceptOffer}
              disabled={isAccepting}
            >
              {isAccepting ? "Accepting..." : "Accept Offer"}
            </button>
            <button
              type="button"
              className="rounded-lg bg-rose-600 text-white px-4 py-2 text-sm"
              onClick={rejectOffer}
              disabled={isRejecting}
            >
              {isRejecting ? "Rejecting..." : "Reject Offer"}
            </button>
          </div>
          {acceptResult && <pre className="text-xs bg-zinc-900 text-zinc-100 rounded-lg p-3 overflow-auto">{pretty(acceptResult)}</pre>}
          {rejectResult && <pre className="text-xs bg-zinc-900 text-zinc-100 rounded-lg p-3 overflow-auto">{pretty(rejectResult)}</pre>}
        </div>
      </section>
    </ProtectedShell>
  );
}
