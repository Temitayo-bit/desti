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

    it("returns a canonical answer for post-ride FAQ", () => {
        const a = tryCanonicalDestiAnswer("How do I post a ride?");
        expect(a).toBeTruthy();
        expect(a).toContain("Create Ride");
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
        expect(
            answerContainsBannedGenericContent(
                "In Desti, tap Create Ride on the post-ride form."
            )
        ).toBe(false);
    });

    it("guard swaps spam for canonical when user asked about posting a ride", () => {
        const bad = "Use Lyft or BlaBlaCar.";
        const out = guardDestiChatOutput(bad, "How do I post a ride?");
        expect(out).not.toContain("Lyft");
        expect(out).toContain("Create Ride");
    });

    it("guard uses refusal for off-topic user message when model outputs spam", () => {
        const out = guardDestiChatOutput(
            "BlaBlaCar is very popular in Europe.",
            "What is 2+2?"
        );
        expect(out).toContain("I can only help with Desti");
    });
});
