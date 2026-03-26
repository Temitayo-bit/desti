import { NextRequest, NextResponse } from "next/server";
import { requireStetsonAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ALLOWED_MIME_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
]);

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

const WORKER_UPLOAD_URL = process.env.WORKER_UPLOAD_URL ?? "";
const WORKER_UPLOAD_API_KEY = process.env.WORKER_UPLOAD_API_KEY ?? "";
const WORKER_UPLOAD_BASE_URL = WORKER_UPLOAD_URL.replace(/\/+$/, "");

const MIME_TYPE_TO_EXTENSION: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
};

function buildLegacyObjectKey(clerkUserId: string): string {
    return `profile-pictures/${clerkUserId}`;
}

function buildVersionedObjectKey(clerkUserId: string, mimeType: string): string {
    const extension = MIME_TYPE_TO_EXTENSION[mimeType] ?? "bin";
    const versionSegment = `${Date.now()}-${crypto.randomUUID()}`;
    return `profile-pictures/${clerkUserId}/${versionSegment}.${extension}`;
}

function buildPublicUrl(key: string): string {
    return `${WORKER_UPLOAD_BASE_URL}/${key}`;
}

function extractObjectKeyFromWorkerUrl(url: string): string | null {
    if (!WORKER_UPLOAD_BASE_URL) {
        return null;
    }

    try {
        const workerBaseUrl = new URL(`${WORKER_UPLOAD_BASE_URL}/`);
        const storedUrl = new URL(url);

        if (storedUrl.origin !== workerBaseUrl.origin) {
            return null;
        }

        const workerPathPrefix = workerBaseUrl.pathname;
        if (!storedUrl.pathname.startsWith(workerPathPrefix)) {
            return null;
        }

        const key = storedUrl.pathname.slice(workerPathPrefix.length);
        return key.length > 0 ? key : null;
    } catch {
        return null;
    }
}

async function deleteWorkerObject(objectKey: string): Promise<void> {
    const workerResponse = await fetch(`${WORKER_UPLOAD_BASE_URL}/${objectKey}`, {
        method: "DELETE",
        headers: {
            "X-Upload-Api-Key": WORKER_UPLOAD_API_KEY,
        },
    });

    if (!workerResponse.ok && workerResponse.status !== 404) {
        throw new Error(`Worker delete failed with status ${workerResponse.status}.`);
    }
}

/**
 * POST /api/user/profile-picture
 *
 * Uploads a profile picture for the authenticated user.
 * Accepts multipart FormData with a "file" field.
 * Proxies the binary to the Cloudflare Worker, then stores the URL in DB.
 */
export async function POST(request: NextRequest) {
    try {
        const auth = await requireStetsonAuth(request);
        if (auth.error) return auth.error;

        if (!WORKER_UPLOAD_URL || !WORKER_UPLOAD_API_KEY) {
            return NextResponse.json(
                {
                    error: "Service Unavailable",
                    message: "Profile picture upload is not configured.",
                },
                { status: 503 }
            );
        }

        let formData: FormData;
        try {
            formData = await request.formData();
        } catch {
            return NextResponse.json(
                { error: "Bad Request", message: "Expected multipart form data." },
                { status: 400 }
            );
        }

        const file = formData.get("file");
        if (!file || !(file instanceof Blob)) {
            return NextResponse.json(
                { error: "Bad Request", message: "Missing 'file' field in form data." },
                { status: 400 }
            );
        }

        if (!ALLOWED_MIME_TYPES.has(file.type)) {
            return NextResponse.json(
                {
                    error: "Bad Request",
                    message: "Unsupported file type. Allowed: JPEG, PNG, WebP.",
                },
                { status: 400 }
            );
        }

        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json(
                { error: "Bad Request", message: "File too large. Maximum size is 5 MB." },
                { status: 413 }
            );
        }

        const { clerkUserId } = auth.user;
        const existingUser = await prisma.user.findUnique({
            where: { clerkUserId },
            select: { profilePictureUrl: true },
        });

        const objectKey = buildVersionedObjectKey(clerkUserId, file.type);
        const fileBuffer = await file.arrayBuffer();

        const workerResponse = await fetch(`${WORKER_UPLOAD_BASE_URL}/${objectKey}`, {
            method: "PUT",
            headers: {
                "Content-Type": file.type,
                "Content-Length": String(fileBuffer.byteLength),
                "X-Upload-Api-Key": WORKER_UPLOAD_API_KEY,
            },
            body: fileBuffer,
        });

        if (!workerResponse.ok) {
            const workerBody = await workerResponse
                .json()
                .catch(() => null) as { error?: string } | null;

            if (workerResponse.status === 400 && workerBody?.error) {
                return NextResponse.json(
                    { error: "Bad Request", message: workerBody.error },
                    { status: 400 }
                );
            }

            console.error(
                `[POST /api/user/profile-picture] Worker upload failed (${workerResponse.status}):`,
                workerBody
            );
            return NextResponse.json(
                { error: "Internal Server Error", message: "Failed to upload profile picture." },
                { status: 500 }
            );
        }

        const publicUrl = buildPublicUrl(objectKey);

        await prisma.user.upsert({
            where: { clerkUserId },
            update: { profilePictureUrl: publicUrl },
            create: {
                clerkUserId,
                email: auth.user.primaryStetsonEmail,
                profilePictureUrl: publicUrl,
            },
        });

        const previousObjectKey = existingUser?.profilePictureUrl
            ? extractObjectKeyFromWorkerUrl(existingUser.profilePictureUrl)
            : null;

        if (previousObjectKey) {
            try {
                await deleteWorkerObject(previousObjectKey);
            } catch (error) {
                console.error(
                    `[POST /api/user/profile-picture] Failed to delete previous profile picture (${previousObjectKey}):`,
                    error
                );
            }
        }

        return NextResponse.json({ profilePictureUrl: publicUrl });
    } catch (error) {
        console.error("[POST /api/user/profile-picture] Unexpected error:", error);
        return NextResponse.json(
            { error: "Internal Server Error", message: "An unexpected error occurred." },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/user/profile-picture
 *
 * Removes the authenticated user's profile picture from R2 and clears the DB field.
 */
export async function DELETE(request: NextRequest) {
    try {
        const auth = await requireStetsonAuth(request);
        if (auth.error) return auth.error;

        if (!WORKER_UPLOAD_URL || !WORKER_UPLOAD_API_KEY) {
            return NextResponse.json(
                {
                    error: "Service Unavailable",
                    message: "Profile picture upload is not configured.",
                },
                { status: 503 }
            );
        }

        const { clerkUserId } = auth.user;
        const existingUser = await prisma.user.findUnique({
            where: { clerkUserId },
            select: { profilePictureUrl: true },
        });

        const objectKey =
            existingUser?.profilePictureUrl == null
                ? buildLegacyObjectKey(clerkUserId)
                : extractObjectKeyFromWorkerUrl(existingUser.profilePictureUrl);

        if (objectKey) {
            try {
                await deleteWorkerObject(objectKey);
            } catch (error) {
                console.error(
                    `[DELETE /api/user/profile-picture] Worker delete failed (${objectKey}):`,
                    error
                );
            }
        }

        await prisma.user.updateMany({
            where: { clerkUserId },
            data: { profilePictureUrl: null },
        });

        return new NextResponse(null, { status: 204 });
    } catch (error) {
        console.error("[DELETE /api/user/profile-picture] Unexpected error:", error);
        return NextResponse.json(
            { error: "Internal Server Error", message: "An unexpected error occurred." },
            { status: 500 }
        );
    }
}
