import type { DistanceCategory } from "@prisma/client";

export type MyTripRequestsQuickFilter =
    | "All"
    | "Active"
    | "Offers Received"
    | "Booked"
    | "Closed";

export interface MyTripRequestFilterInput {
    id: string;
    destinationText: string;
    earliestDesiredAt: string;
    distanceCategory: DistanceCategory;
    status: "ACTIVE" | "CLOSED";
    confirmedBookings: readonly unknown[];
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

function applyQuickFilter(
    tripRequest: MyTripRequestFilterInput,
    activeFilter: MyTripRequestsQuickFilter,
    pendingOfferTripRequestIds: Set<string>
): boolean {
    if (activeFilter === "All") return true;

    if (activeFilter === "Active") {
        return tripRequest.status === "ACTIVE";
    }

    if (activeFilter === "Offers Received") {
        return pendingOfferTripRequestIds.has(tripRequest.id);
    }

    if (activeFilter === "Booked") {
        return tripRequest.confirmedBookings.length > 0;
    }

    return tripRequest.status === "CLOSED";
}

export function filterMyTripRequests<T extends MyTripRequestFilterInput>({
    tripRequests,
    searchQuery,
    activeFilter,
    pendingOfferTripRequestIds = new Set<string>(),
}: {
    tripRequests: T[];
    searchQuery: string;
    activeFilter: MyTripRequestsQuickFilter;
    pendingOfferTripRequestIds?: Set<string>;
}): T[] {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    return tripRequests.filter((tripRequest) => {
        const matchesSearch =
            normalizedSearch.length === 0 ||
            tripRequest.destinationText.toLowerCase().includes(normalizedSearch);

        if (!matchesSearch) {
            return false;
        }

        return applyQuickFilter(
            tripRequest,
            activeFilter,
            pendingOfferTripRequestIds
        );
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
