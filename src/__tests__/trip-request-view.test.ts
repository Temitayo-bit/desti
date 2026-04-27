import { describe, expect, it } from "vitest";
import {
    getTripRequestsViewHref,
    normalizeTripRequestsView,
} from "@/lib/trip-request-view";

describe("trip request hub view helpers", () => {
    it("defaults to browse for missing or unknown values", () => {
        expect(normalizeTripRequestsView(null)).toBe("browse");
        expect(normalizeTripRequestsView(undefined)).toBe("browse");
        expect(normalizeTripRequestsView("unexpected")).toBe("browse");
    });

    it("recognizes the my view query", () => {
        expect(normalizeTripRequestsView("my")).toBe("my");
    });

    it("recognizes the offers view query", () => {
        expect(normalizeTripRequestsView("offers")).toBe("offers");
    });

    it("builds stable hub hrefs", () => {
        expect(getTripRequestsViewHref("browse")).toBe("/browse-trip-requests");
        expect(getTripRequestsViewHref("my")).toBe(
            "/browse-trip-requests?view=my"
        );
        expect(getTripRequestsViewHref("offers")).toBe(
            "/browse-trip-requests?view=offers"
        );
    });
});
