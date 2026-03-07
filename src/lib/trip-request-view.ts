export type TripRequestsView = "browse" | "my";

export function normalizeTripRequestsView(
    value: string | null | undefined
): TripRequestsView {
    return value === "my" ? "my" : "browse";
}

export function getTripRequestsViewHref(view: TripRequestsView): string {
    return view === "my"
        ? "/browse-trip-requests?view=my"
        : "/browse-trip-requests";
}
