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

function buildObjectKey(clerkUserId: string): string {
    return `profile-pictures/${clerkUserId}`;
}

function buildPublicUrl(key: string): string {
    return `${WORKER_UPLOAD_URL}/${key}`;
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
        const objectKey = buildObjectKey(clerkUserId);
        const fileBuffer = await file.arrayBuffer();

        const workerResponse = await fetch(`${WORKER_UPLOAD_URL}/${objectKey}`, {
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
        const objectKey = buildObjectKey(clerkUserId);

        const workerResponse = await fetch(`${WORKER_UPLOAD_URL}/${objectKey}`, {
            method: "DELETE",
            headers: {
                "X-Upload-Api-Key": WORKER_UPLOAD_API_KEY,
            },
        });

        if (!workerResponse.ok && workerResponse.status !== 404) {
            console.error(
                `[DELETE /api/user/profile-picture] Worker delete failed (${workerResponse.status})`
            );
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
