import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { mockRequireStetsonAuth, mockPrisma } = vi.hoisted(() => {
    const prismaClient = {
        user: {
            findUnique: vi.fn(),
            upsert: vi.fn(),
            updateMany: vi.fn(),
        },
    };

    return {
        mockRequireStetsonAuth: vi.fn(),
        mockPrisma: prismaClient,
    };
});

vi.mock("@/lib/auth", () => ({
    requireStetsonAuth: (...args: unknown[]) => mockRequireStetsonAuth(...args),
}));

vi.mock("@/lib/prisma", () => ({
    prisma: mockPrisma,
}));

const originalWorkerUploadUrl = process.env.WORKER_UPLOAD_URL;
const originalWorkerUploadApiKey = process.env.WORKER_UPLOAD_API_KEY;

function successAuth() {
    return {
        user: {
            clerkUserId: "user_123",
            primaryStetsonEmail: "student@stetson.edu",
        },
    };
}

function makeMultipartRequest(fileType = "image/png"): NextRequest {
    const formData = new FormData();
    const file = new Blob([new Uint8Array([1, 2, 3, 4])], { type: fileType });
    formData.append("file", file, "avatar.png");

    return new NextRequest("http://localhost:3000/api/user/profile-picture", {
        method: "POST",
        body: formData,
    });
}

function makeDeleteRequest(): NextRequest {
    return new NextRequest("http://localhost:3000/api/user/profile-picture", {
        method: "DELETE",
    });
}

describe("profile picture upload route", () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();

        process.env.WORKER_UPLOAD_URL = "https://worker.example.dev";
        process.env.WORKER_UPLOAD_API_KEY = "worker-secret";

        mockRequireStetsonAuth.mockResolvedValue(successAuth());
        mockPrisma.user.findUnique.mockResolvedValue(null);
        mockPrisma.user.upsert.mockResolvedValue({});
        mockPrisma.user.updateMany.mockResolvedValue({ count: 1 });

        vi.spyOn(Date, "now").mockReturnValue(1700000000000);
        vi.spyOn(crypto, "randomUUID").mockReturnValue(
            "11111111-1111-4111-8111-111111111111"
        );

        globalThis.fetch = vi.fn();
    });

    afterEach(() => {
        vi.restoreAllMocks();

        if (originalWorkerUploadUrl === undefined) {
            delete process.env.WORKER_UPLOAD_URL;
        } else {
            process.env.WORKER_UPLOAD_URL = originalWorkerUploadUrl;
        }

        if (originalWorkerUploadApiKey === undefined) {
            delete process.env.WORKER_UPLOAD_API_KEY;
        } else {
            process.env.WORKER_UPLOAD_API_KEY = originalWorkerUploadApiKey;
        }
    });

    it("creates a versioned URL on first upload", async () => {
        const mockFetch = vi.mocked(globalThis.fetch);
        mockFetch.mockResolvedValueOnce(
            new Response(JSON.stringify({ ok: true }), { status: 200 })
        );

        const { POST } = await import("@/app/api/user/profile-picture/route");
        const response = await POST(makeMultipartRequest());
        const json = await response.json();

        const expectedKey =
            "profile-pictures/user_123/1700000000000-11111111-1111-4111-8111-111111111111.png";
        const expectedUrl = `https://worker.example.dev/${expectedKey}`;

        expect(response.status).toBe(200);
        expect(json).toEqual({ profilePictureUrl: expectedUrl });
        expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
            where: { clerkUserId: "user_123" },
            select: { profilePictureUrl: true },
        });
        expect(mockFetch).toHaveBeenCalledTimes(1);
        expect(mockFetch).toHaveBeenCalledWith(expectedUrl, {
            method: "PUT",
            headers: {
                "Content-Type": "image/png",
                "Content-Length": "4",
                "X-Upload-Api-Key": "worker-secret",
            },
            body: expect.any(ArrayBuffer),
        });
        expect(mockPrisma.user.upsert).toHaveBeenCalledWith({
            where: { clerkUserId: "user_123" },
            update: { profilePictureUrl: expectedUrl },
            create: {
                clerkUserId: "user_123",
                email: "student@stetson.edu",
                profilePictureUrl: expectedUrl,
            },
        });
    });

    it("replaces an existing versioned avatar and deletes the old object after updating the DB", async () => {
        const previousUrl =
            "https://worker.example.dev/profile-pictures/user_123/old-version.png";
        mockPrisma.user.findUnique.mockResolvedValue({ profilePictureUrl: previousUrl });

        const mockFetch = vi.mocked(globalThis.fetch);
        mockFetch
            .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))
            .mockResolvedValueOnce(new Response(null, { status: 204 }));

        const { POST } = await import("@/app/api/user/profile-picture/route");
        const response = await POST(makeMultipartRequest());
        const json = await response.json();

        const newKey =
            "profile-pictures/user_123/1700000000000-11111111-1111-4111-8111-111111111111.png";
        const newUrl = `https://worker.example.dev/${newKey}`;

        expect(response.status).toBe(200);
        expect(json.profilePictureUrl).toBe(newUrl);
        expect(mockFetch).toHaveBeenNthCalledWith(1, newUrl, expect.objectContaining({
            method: "PUT",
        }));
        expect(mockFetch).toHaveBeenNthCalledWith(2, previousUrl, {
            method: "DELETE",
            headers: {
                "X-Upload-Api-Key": "worker-secret",
            },
        });
        expect(mockPrisma.user.upsert.mock.invocationCallOrder[0]).toBeLessThan(
            mockFetch.mock.invocationCallOrder[1] ?? Number.MAX_SAFE_INTEGER
        );
    });

    it("deletes a legacy fixed-key avatar when replacing it", async () => {
        const legacyUrl = "https://worker.example.dev/profile-pictures/user_123";
        mockPrisma.user.findUnique.mockResolvedValue({ profilePictureUrl: legacyUrl });

        const mockFetch = vi.mocked(globalThis.fetch);
        mockFetch
            .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))
            .mockResolvedValueOnce(new Response(null, { status: 204 }));

        const { POST } = await import("@/app/api/user/profile-picture/route");
        const response = await POST(makeMultipartRequest("image/webp"));

        const newUrl =
            "https://worker.example.dev/profile-pictures/user_123/1700000000000-11111111-1111-4111-8111-111111111111.webp";

        expect(response.status).toBe(200);
        expect(mockPrisma.user.upsert).toHaveBeenCalledWith(expect.objectContaining({
            update: { profilePictureUrl: newUrl },
        }));
        expect(mockFetch).toHaveBeenNthCalledWith(2, legacyUrl, {
            method: "DELETE",
            headers: {
                "X-Upload-Api-Key": "worker-secret",
            },
        });
    });

    it("returns success and keeps the new URL when old-image cleanup fails", async () => {
        mockPrisma.user.findUnique.mockResolvedValue({
            profilePictureUrl:
                "https://worker.example.dev/profile-pictures/user_123/old-version.png",
        });

        const mockFetch = vi.mocked(globalThis.fetch);
        mockFetch
            .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))
            .mockResolvedValueOnce(new Response(null, { status: 500 }));

        const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

        const { POST } = await import("@/app/api/user/profile-picture/route");
        const response = await POST(makeMultipartRequest());
        const json = await response.json();

        expect(response.status).toBe(200);
        expect(json.profilePictureUrl).toContain(
            "profile-pictures/user_123/1700000000000-11111111-1111-4111-8111-111111111111.png"
        );
        expect(mockPrisma.user.upsert).toHaveBeenCalledTimes(1);
        expect(errorSpy).toHaveBeenCalledWith(
            expect.stringContaining("Failed to delete previous profile picture"),
            expect.any(Error)
        );
    });

    it("does not try to delete prior URLs from other hosts", async () => {
        mockPrisma.user.findUnique.mockResolvedValue({
            profilePictureUrl: "https://cdn.example.com/avatar.png",
        });

        const mockFetch = vi.mocked(globalThis.fetch);
        mockFetch.mockResolvedValueOnce(
            new Response(JSON.stringify({ ok: true }), { status: 200 })
        );

        const { POST } = await import("@/app/api/user/profile-picture/route");
        const response = await POST(makeMultipartRequest());

        expect(response.status).toBe(200);
        expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("deletes the stored versioned object and clears the DB field", async () => {
        mockPrisma.user.findUnique.mockResolvedValue({
            profilePictureUrl:
                "https://worker.example.dev/profile-pictures/user_123/current-version.png",
        });

        const mockFetch = vi.mocked(globalThis.fetch);
        mockFetch.mockResolvedValueOnce(new Response(null, { status: 204 }));

        const { DELETE } = await import("@/app/api/user/profile-picture/route");
        const response = await DELETE(makeDeleteRequest());

        expect(response.status).toBe(204);
        expect(mockFetch).toHaveBeenCalledWith(
            "https://worker.example.dev/profile-pictures/user_123/current-version.png",
            {
                method: "DELETE",
                headers: {
                    "X-Upload-Api-Key": "worker-secret",
                },
            }
        );
        expect(mockPrisma.user.updateMany).toHaveBeenCalledWith({
            where: { clerkUserId: "user_123" },
            data: { profilePictureUrl: null },
        });
    });

    it("falls back to the legacy key on delete when no URL is stored and tolerates worker 404", async () => {
        mockPrisma.user.findUnique.mockResolvedValue({ profilePictureUrl: null });

        const mockFetch = vi.mocked(globalThis.fetch);
        mockFetch.mockResolvedValueOnce(new Response(null, { status: 404 }));

        const { DELETE } = await import("@/app/api/user/profile-picture/route");
        const response = await DELETE(makeDeleteRequest());

        expect(response.status).toBe(204);
        expect(mockFetch).toHaveBeenCalledWith(
            "https://worker.example.dev/profile-pictures/user_123",
            {
                method: "DELETE",
                headers: {
                    "X-Upload-Api-Key": "worker-secret",
                },
            }
        );
        expect(mockPrisma.user.updateMany).toHaveBeenCalledWith({
            where: { clerkUserId: "user_123" },
            data: { profilePictureUrl: null },
        });
    });
});
