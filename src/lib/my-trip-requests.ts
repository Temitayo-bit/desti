import type { DistanceCategory } from "@prisma/client";

export type MyTripRequestsQuickFilter =
    | "All"
    | "Today"
    | "Short"
    | "Medium"
    | "Long";

export interface MyTripRequestFilterInput {
    id: string;
    destinationText: string;
    earliestDesiredAt: string;
    distanceCategory: DistanceCategory;
}

export interface PendingIncomingOffer {
    id: string;
    tripRequestId: string;
    driverUserId: string;
    riderUserId: string;
    seatsOffered: number;
    priceCents: number;
    message: string | null;
    status: "PENDING";
    createdAt: string;
}

export type PendingOffersByTripRequestId = Record<string, PendingIncomingOffer[]>;

function isSameLocalDate(dateA: Date, dateB: Date): boolean {
    return (
        dateA.getFullYear() === dateB.getFullYear() &&
        dateA.getMonth() === dateB.getMonth() &&
        dateA.getDate() === dateB.getDate()
    );
}

function applyQuickFilter(
    tripRequest: MyTripRequestFilterInput,
    activeFilter: MyTripRequestsQuickFilter,
    now: Date
): boolean {
    if (activeFilter === "All") return true;

    if (activeFilter === "Today") {
        const tripDate = new Date(tripRequest.earliestDesiredAt);
        if (Number.isNaN(tripDate.getTime())) {
            return false;
        }
        return isSameLocalDate(tripDate, now);
    }

    if (activeFilter === "Short") return tripRequest.distanceCategory === "SHORT";
    if (activeFilter === "Medium") return tripRequest.distanceCategory === "MEDIUM";
    return tripRequest.distanceCategory === "LONG";
}

export function filterMyTripRequests<T extends MyTripRequestFilterInput>({
    tripRequests,
    searchQuery,
    activeFilter,
    now = new Date(),
}: {
    tripRequests: T[];
    searchQuery: string;
    activeFilter: MyTripRequestsQuickFilter;
    now?: Date;
}): T[] {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    return tripRequests.filter((tripRequest) => {
        const matchesSearch =
            normalizedSearch.length === 0 ||
            tripRequest.destinationText.toLowerCase().includes(normalizedSearch);

        if (!matchesSearch) {
            return false;
        }

        return applyQuickFilter(tripRequest, activeFilter, now);
    });
}

export function groupPendingOffersByTripRequestId(
    offers: PendingIncomingOffer[]
): PendingOffersByTripRequestId {
    return offers.reduce<PendingOffersByTripRequestId>((acc, offer) => {
        if (!acc[offer.tripRequestId]) {
            acc[offer.tripRequestId] = [];
        }
        acc[offer.tripRequestId].push(offer);
        return acc;
    }, {});
}

export function hasPendingOffersForTripRequest(
    offersByTripRequestId: PendingOffersByTripRequestId,
    tripRequestId: string
): boolean {
    return (offersByTripRequestId[tripRequestId]?.length ?? 0) > 0;
}

export function getPendingOffersForTripRequest(
    offersByTripRequestId: PendingOffersByTripRequestId,
    tripRequestId: string
): PendingIncomingOffer[] {
    return offersByTripRequestId[tripRequestId] ?? [];
}
