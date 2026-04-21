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

interface TripRequestCreateForm {
  originText: string;
  destinationText: string;
  earliestDesiredAtLocal: string;
  latestDesiredAtLocal: string;
  distanceCategory: DistanceCategory;
  seatsNeeded: string;
}

interface LocationPatchForm {
  id: string;
  originText: string;
  destinationText: string;
}

function toLocalInputValue(date: Date): string {
  const withOffset = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return withOffset.toISOString().slice(0, 16);
}

function localToIso(localValue: string): string {
  return new Date(localValue).toISOString();
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

export default function GeocodeMvp2TestPage() {
  const now = useMemo(() => new Date(), []);
  const earliest = useMemo(() => toLocalInputValue(new Date(now.getTime() + 60 * 60 * 1000)), [now]);
  const latest = useMemo(() => toLocalInputValue(new Date(now.getTime() + 3 * 60 * 60 * 1000)), [now]);

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
    destinationText: "Orlando, FL",
    earliestDesiredAtLocal: earliest,
    latestDesiredAtLocal: latest,
    distanceCategory: "MEDIUM",
    seatsNeeded: "1",
  });

  const [ridePatch, setRidePatch] = useState<LocationPatchForm>({
    id: "",
    originText: "",
    destinationText: "",
  });

  const [tripPatch, setTripPatch] = useState<LocationPatchForm>({
    id: "",
    originText: "",
    destinationText: "",
  });

  const [rideCreateResult, setRideCreateResult] = useState<ApiResult | null>(null);
  const [tripCreateResult, setTripCreateResult] = useState<ApiResult | null>(null);
  const [ridePatchResult, setRidePatchResult] = useState<ApiResult | null>(null);
  const [tripPatchResult, setTripPatchResult] = useState<ApiResult | null>(null);

  const [isRideCreating, setIsRideCreating] = useState(false);
  const [isTripCreating, setIsTripCreating] = useState(false);
  const [isRidePatching, setIsRidePatching] = useState(false);
  const [isTripPatching, setIsTripPatching] = useState(false);

  async function submitRideCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsRideCreating(true);

    try {
      const payload = {
        originText: rideCreate.originText,
        destinationText: rideCreate.destinationText,
        earliestDepartAt: localToIso(rideCreate.earliestDepartAtLocal),
        latestDepartAt: localToIso(rideCreate.latestDepartAtLocal),
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

      const parsed = await parseApiResult(response);
      setRideCreateResult(parsed);

      const maybeId =
        parsed.body && typeof parsed.body === "object" && "id" in parsed.body
          ? (parsed.body as { id?: unknown }).id
          : null;

      if (typeof maybeId === "string" && maybeId.length > 0) {
        setRidePatch((prev) => ({ ...prev, id: maybeId }));
      }
    } finally {
      setIsRideCreating(false);
    }
  }

  async function submitTripCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsTripCreating(true);

    try {
      const payload = {
        originText: tripCreate.originText,
        destinationText: tripCreate.destinationText,
        earliestDesiredAt: localToIso(tripCreate.earliestDesiredAtLocal),
        latestDesiredAt: localToIso(tripCreate.latestDesiredAtLocal),
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

      const parsed = await parseApiResult(response);
      setTripCreateResult(parsed);

      const maybeId =
        parsed.body && typeof parsed.body === "object" && "id" in parsed.body
          ? (parsed.body as { id?: unknown }).id
          : null;

      if (typeof maybeId === "string" && maybeId.length > 0) {
        setTripPatch((prev) => ({ ...prev, id: maybeId }));
      }
    } finally {
      setIsTripCreating(false);
    }
  }

  async function submitRidePatch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!ridePatch.id.trim()) {
      setRidePatchResult({ status: 400, body: { message: "Ride ID is required." } });
      return;
    }

    const patchBody: Record<string, unknown> = {};
    if (ridePatch.originText.trim()) patchBody.originText = ridePatch.originText;
    if (ridePatch.destinationText.trim()) patchBody.destinationText = ridePatch.destinationText;

    if (Object.keys(patchBody).length === 0) {
      setRidePatchResult({ status: 400, body: { message: "Provide originText or destinationText." } });
      return;
    }

    setIsRidePatching(true);
    try {
      const response = await fetch(`/api/rides/${encodeURIComponent(ridePatch.id.trim())}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patchBody),
      });
      setRidePatchResult(await parseApiResult(response));
    } finally {
      setIsRidePatching(false);
    }
  }

  async function submitTripPatch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!tripPatch.id.trim()) {
      setTripPatchResult({ status: 400, body: { message: "Trip Request ID is required." } });
      return;
    }

    const patchBody: Record<string, unknown> = {};
    if (tripPatch.originText.trim()) patchBody.originText = tripPatch.originText;
    if (tripPatch.destinationText.trim()) patchBody.destinationText = tripPatch.destinationText;

    if (Object.keys(patchBody).length === 0) {
      setTripPatchResult({ status: 400, body: { message: "Provide originText or destinationText." } });
      return;
    }

    setIsTripPatching(true);
    try {
      const response = await fetch(
        `/api/trip-requests/${encodeURIComponent(tripPatch.id.trim())}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patchBody),
        }
      );
      setTripPatchResult(await parseApiResult(response));
    } finally {
      setIsTripPatching(false);
    }
  }

  return (
    <ProtectedShell activeNav="browse">
      <div className="bg-white border border-zinc-200 rounded-2xl p-6 md:p-8 space-y-2">
        <h1 className="text-2xl font-bold">MVP2 Geocoding Test Page</h1>
        <p className="text-sm text-zinc-600">
          Dummy test UI for backend geocoding create/edit flows.
        </p>
      </div>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <form onSubmit={submitRideCreate} className="bg-white border border-zinc-200 rounded-2xl p-5 space-y-3">
          <h2 className="font-semibold text-lg">Create Ride</h2>
          <input className="w-full rounded-lg border border-zinc-300 p-2" value={rideCreate.originText} onChange={(e) => setRideCreate((p) => ({ ...p, originText: e.target.value }))} placeholder="originText" />
          <input className="w-full rounded-lg border border-zinc-300 p-2" value={rideCreate.destinationText} onChange={(e) => setRideCreate((p) => ({ ...p, destinationText: e.target.value }))} placeholder="destinationText" />
          <div className="grid grid-cols-2 gap-2">
            <input type="datetime-local" className="rounded-lg border border-zinc-300 p-2" value={rideCreate.earliestDepartAtLocal} onChange={(e) => setRideCreate((p) => ({ ...p, earliestDepartAtLocal: e.target.value }))} />
            <input type="datetime-local" className="rounded-lg border border-zinc-300 p-2" value={rideCreate.latestDepartAtLocal} onChange={(e) => setRideCreate((p) => ({ ...p, latestDepartAtLocal: e.target.value }))} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <select className="rounded-lg border border-zinc-300 p-2" value={rideCreate.distanceCategory} onChange={(e) => setRideCreate((p) => ({ ...p, distanceCategory: e.target.value as DistanceCategory }))}>
              <option value="SHORT">SHORT</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="LONG">LONG</option>
            </select>
            <input className="rounded-lg border border-zinc-300 p-2" value={rideCreate.priceCents} onChange={(e) => setRideCreate((p) => ({ ...p, priceCents: e.target.value }))} placeholder="priceCents" />
            <input className="rounded-lg border border-zinc-300 p-2" value={rideCreate.seatsTotal} onChange={(e) => setRideCreate((p) => ({ ...p, seatsTotal: e.target.value }))} placeholder="seatsTotal" />
          </div>
          <button type="submit" className="rounded-lg bg-emerald-600 text-white px-4 py-2 text-sm" disabled={isRideCreating}>
            {isRideCreating ? "Creating..." : "Create Ride"}
          </button>
          {rideCreateResult && <pre className="text-xs bg-zinc-900 text-zinc-100 rounded-lg p-3 overflow-auto">{pretty(rideCreateResult)}</pre>}
        </form>

        <form onSubmit={submitTripCreate} className="bg-white border border-zinc-200 rounded-2xl p-5 space-y-3">
          <h2 className="font-semibold text-lg">Create Trip Request</h2>
          <input className="w-full rounded-lg border border-zinc-300 p-2" value={tripCreate.originText} onChange={(e) => setTripCreate((p) => ({ ...p, originText: e.target.value }))} placeholder="originText" />
          <input className="w-full rounded-lg border border-zinc-300 p-2" value={tripCreate.destinationText} onChange={(e) => setTripCreate((p) => ({ ...p, destinationText: e.target.value }))} placeholder="destinationText" />
          <div className="grid grid-cols-2 gap-2">
            <input type="datetime-local" className="rounded-lg border border-zinc-300 p-2" value={tripCreate.earliestDesiredAtLocal} onChange={(e) => setTripCreate((p) => ({ ...p, earliestDesiredAtLocal: e.target.value }))} />
            <input type="datetime-local" className="rounded-lg border border-zinc-300 p-2" value={tripCreate.latestDesiredAtLocal} onChange={(e) => setTripCreate((p) => ({ ...p, latestDesiredAtLocal: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select className="rounded-lg border border-zinc-300 p-2" value={tripCreate.distanceCategory} onChange={(e) => setTripCreate((p) => ({ ...p, distanceCategory: e.target.value as DistanceCategory }))}>
              <option value="SHORT">SHORT</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="LONG">LONG</option>
            </select>
            <input className="rounded-lg border border-zinc-300 p-2" value={tripCreate.seatsNeeded} onChange={(e) => setTripCreate((p) => ({ ...p, seatsNeeded: e.target.value }))} placeholder="seatsNeeded" />
          </div>
          <button type="submit" className="rounded-lg bg-emerald-600 text-white px-4 py-2 text-sm" disabled={isTripCreating}>
            {isTripCreating ? "Creating..." : "Create Trip Request"}
          </button>
          {tripCreateResult && <pre className="text-xs bg-zinc-900 text-zinc-100 rounded-lg p-3 overflow-auto">{pretty(tripCreateResult)}</pre>}
        </form>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <form onSubmit={submitRidePatch} className="bg-white border border-zinc-200 rounded-2xl p-5 space-y-3">
          <h2 className="font-semibold text-lg">Patch Ride Location</h2>
          <input className="w-full rounded-lg border border-zinc-300 p-2" value={ridePatch.id} onChange={(e) => setRidePatch((p) => ({ ...p, id: e.target.value }))} placeholder="rideId" />
          <input className="w-full rounded-lg border border-zinc-300 p-2" value={ridePatch.originText} onChange={(e) => setRidePatch((p) => ({ ...p, originText: e.target.value }))} placeholder="new originText (optional)" />
          <input className="w-full rounded-lg border border-zinc-300 p-2" value={ridePatch.destinationText} onChange={(e) => setRidePatch((p) => ({ ...p, destinationText: e.target.value }))} placeholder="new destinationText (optional)" />
          <button type="submit" className="rounded-lg bg-blue-600 text-white px-4 py-2 text-sm" disabled={isRidePatching}>
            {isRidePatching ? "Patching..." : "Patch Ride"}
          </button>
          {ridePatchResult && <pre className="text-xs bg-zinc-900 text-zinc-100 rounded-lg p-3 overflow-auto">{pretty(ridePatchResult)}</pre>}
        </form>

        <form onSubmit={submitTripPatch} className="bg-white border border-zinc-200 rounded-2xl p-5 space-y-3">
          <h2 className="font-semibold text-lg">Patch Trip Request Location</h2>
          <input className="w-full rounded-lg border border-zinc-300 p-2" value={tripPatch.id} onChange={(e) => setTripPatch((p) => ({ ...p, id: e.target.value }))} placeholder="tripRequestId" />
          <input className="w-full rounded-lg border border-zinc-300 p-2" value={tripPatch.originText} onChange={(e) => setTripPatch((p) => ({ ...p, originText: e.target.value }))} placeholder="new originText (optional)" />
          <input className="w-full rounded-lg border border-zinc-300 p-2" value={tripPatch.destinationText} onChange={(e) => setTripPatch((p) => ({ ...p, destinationText: e.target.value }))} placeholder="new destinationText (optional)" />
          <button type="submit" className="rounded-lg bg-blue-600 text-white px-4 py-2 text-sm" disabled={isTripPatching}>
            {isTripPatching ? "Patching..." : "Patch Trip Request"}
          </button>
          {tripPatchResult && <pre className="text-xs bg-zinc-900 text-zinc-100 rounded-lg p-3 overflow-auto">{pretty(tripPatchResult)}</pre>}
        </form>
      </section>
    </ProtectedShell>
  );
}
