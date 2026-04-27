export type RidesView = "browse" | "my";

export function normalizeRidesView(
    value: string | null | undefined
): RidesView {
    return value === "my" ? "my" : "browse";
}

export function getRidesViewHref(view: RidesView): string {
    return view === "my" ? "/browse?view=my" : "/browse";
}
