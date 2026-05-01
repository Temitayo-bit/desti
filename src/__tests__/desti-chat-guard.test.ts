import { describe, expect, it } from "vitest";
import {
    answerContainsBannedGenericContent,
    guardDestiChatOutput,
    matchesPostRideFaq,
    tryCanonicalDestiAnswer,
} from "@/lib/desti-chat-guard";

describe("desti-chat-guard", () => {
    it("matches common post-ride phrasings", () => {
        expect(matchesPostRideFaq("How do I post a ride?")).toBe(true);
        expect(matchesPostRideFaq("how to post a ride")).toBe(true);
        expect(matchesPostRideFaq("  How do I post a ride?  ")).toBe(true);
        expect(matchesPostRideFaq("bookings in Desti")).toBe(false);
    });

    it("does not match 'post a ride request' (trip request wording)", () => {
        expect(matchesPostRideFaq("How do I post a ride request?")).toBe(false);
        expect(matchesPostRideFaq("how to post a ride request for tomorrow")).toBe(
            false
        );
    });

    it("returns a canonical answer for post-ride FAQ", () => {
        const a = tryCanonicalDestiAnswer("How do I post a ride?");
        expect(a).toBeTruthy();
        expect(a).toContain("Create Ride");
    });

    it("treats empty user message as no canonical answer", () => {
        expect(matchesPostRideFaq("")).toBe(false);
        expect(tryCanonicalDestiAnswer("")).toBeFalsy();
    });

    it("flags generic web / rideshare copy", () => {
        expect(
            answerContainsBannedGenericContent("Try BlaBlaCar for intercity trips.")
        ).toBe(true);
        expect(
            answerContainsBannedGenericContent(
                "Posting a ride typically means you are offering a ride to others"
            )
        ).toBe(true);
        expect(answerContainsBannedGenericContent("Try Uber for that trip.")).toBe(
            true
        );
        expect(
            answerContainsBannedGenericContent(
                "In Desti, tap Create Ride on the post-ride form."
            )
        ).toBe(false);
    });

    it("guard swaps spam for canonical when user asked about posting a ride", () => {
        const bad = "Use Lyft or BlaBlaCar.";
        const out = guardDestiChatOutput(bad, "How do I post a ride?");
        expect(out.text).not.toContain("Lyft");
        expect(out.text).toContain("Create Ride");
        expect(out.branch).toBe("canonical");
    });

    it("guard uses refusal for off-topic user message when model outputs spam", () => {
        const out = guardDestiChatOutput(
            "BlaBlaCar is very popular in Europe.",
            "What is 2+2?"
        );
        expect(out.text).toContain("I can only help with Desti");
        expect(out.branch).toBe("refusal");
    });

    it("passes through benign Desti-only model output unchanged", () => {
        const benign = "In Desti, tap Create Ride.";
        const out = guardDestiChatOutput(
            benign,
            "How do I post a ride in Desti?"
        );
        expect(out.text).toBe(benign);
        expect(out.branch).toBe("pass");
    });
});
