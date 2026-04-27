export type TripRequestsView = "browse" | "my" | "offers";

export function normalizeTripRequestsView(
    value: string | null | undefined
): TripRequestsView {
    if (value === "my") return "my";
    if (value === "offers") return "offers";
    return "browse";
}

export function getTripRequestsViewHref(view: TripRequestsView): string {
    const base = "/browse-trip-requests";
    if (view === "my") return `${base}?view=my`;
    if (view === "offers") return `${base}?view=offers`;
    return base;
}
