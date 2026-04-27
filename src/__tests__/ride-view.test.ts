import { describe, expect, it } from "vitest";
import { getRidesViewHref, normalizeRidesView } from "@/lib/ride-view";

describe("rides hub view helpers", () => {
    it("defaults to browse for missing or unknown values", () => {
        expect(normalizeRidesView(null)).toBe("browse");
        expect(normalizeRidesView(undefined)).toBe("browse");
        expect(normalizeRidesView("unexpected")).toBe("browse");
    });

    it("recognizes the my view query", () => {
        expect(normalizeRidesView("my")).toBe("my");
    });

    it("builds stable hub hrefs", () => {
        expect(getRidesViewHref("browse")).toBe("/browse");
        expect(getRidesViewHref("my")).toBe("/browse?view=my");
    });
});
