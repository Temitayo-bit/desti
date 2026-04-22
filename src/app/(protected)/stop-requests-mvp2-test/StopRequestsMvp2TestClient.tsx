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

interface StopRequestCreateForm {
  rideId: string;
  requestedPickupText: string;
  requestedPickupLatitude: string;
  requestedPickupLongitude: string;
  requestedDropoffText: string;
  requestedDropoffLatitude: string;
  requestedDropoffLongitude: string;
  riderNote: string;
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
  if (error instanceof Error && error.message) return error.message;
  return "Network error";
}

function getStringId(candidate: unknown): string | null {
  if (typeof candidate === "string" && candidate.length > 0) return candidate;
  return null;
}

function parseNumericField(value: string, fieldName: string): { ok: true; value: number } | { ok: false; message: string } {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return { ok: false, message: `${fieldName} must be a valid number.` };
  }

  return { ok: true, value: parsed };
}

export default function StopRequestsMvp2TestClient() {
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
    priceCents: "1500",
    seatsTotal: "2",
  });

  const [stopForm, setStopForm] = useState<StopRequestCreateForm>({
    rideId: "",
    requestedPickupText: "Publix DeLand, FL",
    requestedPickupLatitude: "29.034",
    requestedPickupLongitude: "-81.299",
    requestedDropoffText: "Orlando International Airport, FL",
    requestedDropoffLatitude: "28.431",
    requestedDropoffLongitude: "-81.308",
    riderNote: "I can be ready in front of the main entrance.",
  });

  const [incomingRideId, setIncomingRideId] = useState("");
  const [quoteStopRequestId, setQuoteStopRequestId] = useState("");
  const [quotePriceCents, setQuotePriceCents] = useState("1800");
  const [actionStopRequestId, setActionStopRequestId] = useState("");

  const [rideCreateResult, setRideCreateResult] = useState<ApiResult | null>(null);
  const [stopCreateResult, setStopCreateResult] = useState<ApiResult | null>(null);
  const [incomingResult, setIncomingResult] = useState<ApiResult | null>(null);
  const [outgoingResult, setOutgoingResult] = useState<ApiResult | null>(null);
  const [quoteResult, setQuoteResult] = useState<ApiResult | null>(null);
  const [acceptResult, setAcceptResult] = useState<ApiResult | null>(null);
  const [rejectResult, setRejectResult] = useState<ApiResult | null>(null);

  const [isCreatingRide, setIsCreatingRide] = useState(false);
  const [isCreatingStopRequest, setIsCreatingStopRequest] = useState(false);
  const [isLoadingIncoming, setIsLoadingIncoming] = useState(false);
  const [isLoadingOutgoing, setIsLoadingOutgoing] = useState(false);
  const [isQuoting, setIsQuoting] = useState(false);
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
          ? getStringId((parsed.body as { id?: unknown }).id)
          : null;

      if (maybeRideId) {
        setStopForm((prev) => ({ ...prev, rideId: maybeRideId }));
        setIncomingRideId(maybeRideId);
      }
    } catch (error) {
      setRideCreateResult({ status: 0, body: { message: getErrorMessage(error) } });
    } finally {
      setIsCreatingRide(false);
    }
  }

  async function submitCreateStopRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const rideId = stopForm.rideId.trim();
    if (!rideId) {
      setStopCreateResult({ status: 400, body: { message: "rideId is required." } });
      return;
    }

    const pickupLat = parseNumericField(stopForm.requestedPickupLatitude, "requestedPickupLatitude");
    if (!pickupLat.ok) {
      setStopCreateResult({ status: 400, body: { message: pickupLat.message } });
      return;
    }

    const pickupLng = parseNumericField(stopForm.requestedPickupLongitude, "requestedPickupLongitude");
    if (!pickupLng.ok) {
      setStopCreateResult({ status: 400, body: { message: pickupLng.message } });
      return;
    }

    const dropoffLat = parseNumericField(stopForm.requestedDropoffLatitude, "requestedDropoffLatitude");
    if (!dropoffLat.ok) {
      setStopCreateResult({ status: 400, body: { message: dropoffLat.message } });
      return;
    }

    const dropoffLng = parseNumericField(stopForm.requestedDropoffLongitude, "requestedDropoffLongitude");
    if (!dropoffLng.ok) {
      setStopCreateResult({ status: 400, body: { message: dropoffLng.message } });
      return;
    }

    setIsCreatingStopRequest(true);
    try {
      const response = await fetch(`/api/rides/${encodeURIComponent(rideId)}/stop-requests`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requestedPickupText: stopForm.requestedPickupText,
          requestedPickupLatitude: pickupLat.value,
          requestedPickupLongitude: pickupLng.value,
          requestedDropoffText: stopForm.requestedDropoffText,
          requestedDropoffLatitude: dropoffLat.value,
          requestedDropoffLongitude: dropoffLng.value,
          riderNote: stopForm.riderNote,
        }),
      });

      const parsed = await parseApiResult(response);
      setStopCreateResult(parsed);

      const maybeStopRequestId =
        parsed.body &&
        typeof parsed.body === "object" &&
        "item" in parsed.body &&
        (parsed.body as { item?: unknown }).item &&
        typeof (parsed.body as { item?: unknown }).item === "object" &&
        "id" in ((parsed.body as { item: { id?: unknown } }).item)
          ? getStringId((parsed.body as { item: { id?: unknown } }).item.id)
          : null;

      if (maybeStopRequestId) {
        setQuoteStopRequestId(maybeStopRequestId);
        setActionStopRequestId(maybeStopRequestId);
      }
    } catch (error) {
      setStopCreateResult({ status: 0, body: { message: getErrorMessage(error) } });
    } finally {
      setIsCreatingStopRequest(false);
    }
  }

  async function fetchIncomingStopRequests() {
    const rideId = incomingRideId.trim();
    if (!rideId) {
      setIncomingResult({ status: 400, body: { message: "rideId is required." } });
      return;
    }

    setIsLoadingIncoming(true);
    try {
      const response = await fetch(`/api/rides/${encodeURIComponent(rideId)}/stop-requests`);
      setIncomingResult(await parseApiResult(response));
    } catch (error) {
      setIncomingResult({ status: 0, body: { message: getErrorMessage(error) } });
    } finally {
      setIsLoadingIncoming(false);
    }
  }

  async function fetchOutgoingStopRequests() {
    setIsLoadingOutgoing(true);
    try {
      const response = await fetch("/api/me/stop-requests/outgoing");
      setOutgoingResult(await parseApiResult(response));
    } catch (error) {
      setOutgoingResult({ status: 0, body: { message: getErrorMessage(error) } });
    } finally {
      setIsLoadingOutgoing(false);
    }
  }

  async function quoteStopRequestAction() {
    const stopRequestId = quoteStopRequestId.trim();
    if (!stopRequestId) {
      setQuoteResult({ status: 400, body: { message: "stopRequestId is required." } });
      return;
    }

    const parsedPrice = Number.parseInt(quotePriceCents, 10);
    if (!Number.isInteger(parsedPrice) || parsedPrice <= 0) {
      setQuoteResult({ status: 400, body: { message: "quotedPriceCents must be a positive integer." } });
      return;
    }

    setIsQuoting(true);
    try {
      const response = await fetch(`/api/stop-requests/${encodeURIComponent(stopRequestId)}/quote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quotedPriceCents: parsedPrice }),
      });
      setQuoteResult(await parseApiResult(response));
    } catch (error) {
      setQuoteResult({ status: 0, body: { message: getErrorMessage(error) } });
    } finally {
      setIsQuoting(false);
    }
  }

  async function acceptStopRequestAction() {
    const stopRequestId = actionStopRequestId.trim();
    if (!stopRequestId) {
      setAcceptResult({ status: 400, body: { message: "stopRequestId is required." } });
      return;
    }

    setIsAccepting(true);
    try {
      const response = await fetch(`/api/stop-requests/${encodeURIComponent(stopRequestId)}/accept`, {
        method: "POST",
      });
      setAcceptResult(await parseApiResult(response));
    } catch (error) {
      setAcceptResult({ status: 0, body: { message: getErrorMessage(error) } });
    } finally {
      setIsAccepting(false);
    }
  }

  async function rejectStopRequestAction() {
    const stopRequestId = actionStopRequestId.trim();
    if (!stopRequestId) {
      setRejectResult({ status: 400, body: { message: "stopRequestId is required." } });
      return;
    }

    setIsRejecting(true);
    try {
      const response = await fetch(`/api/stop-requests/${encodeURIComponent(stopRequestId)}/reject`, {
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
        <h1 className="text-2xl font-bold">Stop Requests MVP2 Test Page</h1>
        <p className="text-sm text-zinc-600">
          Dummy UI to manually test stop request endpoints (create, list, quote, accept, reject).
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
              onChange={(event) => setRideForm((prev) => ({ ...prev, earliestDepartAtLocal: event.target.value }))}
            />
            <input
              type="datetime-local"
              className="rounded-lg border border-zinc-300 p-2"
              value={rideForm.latestDepartAtLocal}
              onChange={(event) => setRideForm((prev) => ({ ...prev, latestDepartAtLocal: event.target.value }))}
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

        <form onSubmit={submitCreateStopRequest} className="bg-white border border-zinc-200 rounded-2xl p-5 space-y-3">
          <h2 className="font-semibold text-lg">2) Rider: Create Stop Request</h2>
          <input
            className="w-full rounded-lg border border-zinc-300 p-2"
            value={stopForm.rideId}
            onChange={(event) => setStopForm((prev) => ({ ...prev, rideId: event.target.value }))}
            placeholder="rideId"
          />
          <input
            className="w-full rounded-lg border border-zinc-300 p-2"
            value={stopForm.requestedPickupText}
            onChange={(event) => setStopForm((prev) => ({ ...prev, requestedPickupText: event.target.value }))}
            placeholder="requestedPickupText"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              className="rounded-lg border border-zinc-300 p-2"
              value={stopForm.requestedPickupLatitude}
              onChange={(event) => setStopForm((prev) => ({ ...prev, requestedPickupLatitude: event.target.value }))}
              placeholder="requestedPickupLatitude"
            />
            <input
              className="rounded-lg border border-zinc-300 p-2"
              value={stopForm.requestedPickupLongitude}
              onChange={(event) => setStopForm((prev) => ({ ...prev, requestedPickupLongitude: event.target.value }))}
              placeholder="requestedPickupLongitude"
            />
          </div>
          <input
            className="w-full rounded-lg border border-zinc-300 p-2"
            value={stopForm.requestedDropoffText}
            onChange={(event) => setStopForm((prev) => ({ ...prev, requestedDropoffText: event.target.value }))}
            placeholder="requestedDropoffText"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              className="rounded-lg border border-zinc-300 p-2"
              value={stopForm.requestedDropoffLatitude}
              onChange={(event) => setStopForm((prev) => ({ ...prev, requestedDropoffLatitude: event.target.value }))}
              placeholder="requestedDropoffLatitude"
            />
            <input
              className="rounded-lg border border-zinc-300 p-2"
              value={stopForm.requestedDropoffLongitude}
              onChange={(event) => setStopForm((prev) => ({ ...prev, requestedDropoffLongitude: event.target.value }))}
              placeholder="requestedDropoffLongitude"
            />
          </div>
          <textarea
            className="w-full rounded-lg border border-zinc-300 p-2"
            value={stopForm.riderNote}
            onChange={(event) => setStopForm((prev) => ({ ...prev, riderNote: event.target.value }))}
            placeholder="riderNote (optional)"
            rows={3}
          />
          <button
            type="submit"
            className="rounded-lg bg-blue-600 text-white px-4 py-2 text-sm"
            disabled={isCreatingStopRequest}
          >
            {isCreatingStopRequest ? "Creating..." : "Create Stop Request"}
          </button>
          {stopCreateResult && <pre className="text-xs bg-zinc-900 text-zinc-100 rounded-lg p-3 overflow-auto">{pretty(stopCreateResult)}</pre>}
        </form>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 space-y-3">
          <h2 className="font-semibold text-lg">3) Driver: List Incoming Stop Requests</h2>
          <input
            className="w-full rounded-lg border border-zinc-300 p-2"
            value={incomingRideId}
            onChange={(event) => setIncomingRideId(event.target.value)}
            placeholder="rideId"
          />
          <button
            type="button"
            className="rounded-lg bg-zinc-800 text-white px-4 py-2 text-sm"
            onClick={fetchIncomingStopRequests}
            disabled={isLoadingIncoming}
          >
            {isLoadingIncoming ? "Loading..." : "Fetch Incoming"}
          </button>
          {incomingResult && <pre className="text-xs bg-zinc-900 text-zinc-100 rounded-lg p-3 overflow-auto">{pretty(incomingResult)}</pre>}
        </div>

        <div className="bg-white border border-zinc-200 rounded-2xl p-5 space-y-3">
          <h2 className="font-semibold text-lg">4) Rider: List Outgoing Stop Requests</h2>
          <button
            type="button"
            className="rounded-lg bg-zinc-800 text-white px-4 py-2 text-sm"
            onClick={fetchOutgoingStopRequests}
            disabled={isLoadingOutgoing}
          >
            {isLoadingOutgoing ? "Loading..." : "Fetch Outgoing"}
          </button>
          {outgoingResult && <pre className="text-xs bg-zinc-900 text-zinc-100 rounded-lg p-3 overflow-auto">{pretty(outgoingResult)}</pre>}
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 space-y-3">
          <h2 className="font-semibold text-lg">5) Driver: Quote Stop Request</h2>
          <input
            className="w-full rounded-lg border border-zinc-300 p-2"
            value={quoteStopRequestId}
            onChange={(event) => setQuoteStopRequestId(event.target.value)}
            placeholder="stopRequestId"
          />
          <input
            className="w-full rounded-lg border border-zinc-300 p-2"
            value={quotePriceCents}
            onChange={(event) => setQuotePriceCents(event.target.value)}
            placeholder="quotedPriceCents"
          />
          <button
            type="button"
            className="rounded-lg bg-amber-600 text-white px-4 py-2 text-sm"
            onClick={quoteStopRequestAction}
            disabled={isQuoting}
          >
            {isQuoting ? "Quoting..." : "Quote"}
          </button>
          {quoteResult && <pre className="text-xs bg-zinc-900 text-zinc-100 rounded-lg p-3 overflow-auto">{pretty(quoteResult)}</pre>}
        </div>

        <div className="bg-white border border-zinc-200 rounded-2xl p-5 space-y-3">
          <h2 className="font-semibold text-lg">6) Rider or Driver: Accept / Reject</h2>
          <input
            className="w-full rounded-lg border border-zinc-300 p-2"
            value={actionStopRequestId}
            onChange={(event) => setActionStopRequestId(event.target.value)}
            placeholder="stopRequestId"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-lg bg-emerald-700 text-white px-4 py-2 text-sm"
              onClick={acceptStopRequestAction}
              disabled={isAccepting}
            >
              {isAccepting ? "Accepting..." : "Accept"}
            </button>
            <button
              type="button"
              className="rounded-lg bg-rose-700 text-white px-4 py-2 text-sm"
              onClick={rejectStopRequestAction}
              disabled={isRejecting}
            >
              {isRejecting ? "Rejecting..." : "Reject"}
            </button>
          </div>
          {acceptResult && <pre className="text-xs bg-zinc-900 text-zinc-100 rounded-lg p-3 overflow-auto">Accept: {pretty(acceptResult)}</pre>}
          {rejectResult && <pre className="text-xs bg-zinc-900 text-zinc-100 rounded-lg p-3 overflow-auto">Reject: {pretty(rejectResult)}</pre>}
        </div>
      </section>
    </ProtectedShell>
  );
}
