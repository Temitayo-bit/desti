import { NextRequest, NextResponse } from "next/server";
import { requireStetsonAuth } from "@/lib/auth";
import {
    createOrGetBookingConversationController,
    createOrGetOfferConversationController,
    listConversationsController,
} from "@/controllers/conversationController";
import {
    getConversationMessagesController,
    sendConversationMessageController,
} from "@/controllers/messageController";
import { ConversationServiceError } from "@/services/conversationService";

function statusToErrorLabel(status: number): string {
    if (status === 400) return "Bad Request";
    if (status === 404) return "Not Found";
    if (status === 409) return "Conflict";
    if (status === 429) return "Too Many Requests";
    return "Internal Server Error";
}

function toErrorResponse(error: unknown): NextResponse {
    if (error instanceof ConversationServiceError) {
        return NextResponse.json(
            {
                error: statusToErrorLabel(error.statusCode),
                code: error.code,
                message: error.message,
            },
            { status: error.statusCode }
        );
    }

    console.error("[conversations route] Unexpected error:", error);
    return NextResponse.json(
        {
            error: "Internal Server Error",
            message: "An unexpected error occurred.",
        },
        { status: 500 }
    );
}

/**
 * GET /api/conversations
 */
export async function handleGetConversations(request: NextRequest) {
    const auth = await requireStetsonAuth(request);
    if (auth.error) return auth.error;

    try {
        const items = await listConversationsController(auth.user.clerkUserId);
        return NextResponse.json({ items });
    } catch (error) {
        return toErrorResponse(error);
    }
}

/**
 * GET /api/conversations/:id/messages
 */
export async function handleGetConversationMessages(
    request: NextRequest,
    conversationId: string
) {
    const auth = await requireStetsonAuth(request);
    if (auth.error) return auth.error;

    try {
        const searchParams = new URL(request.url).searchParams;
        const payload = await getConversationMessagesController(
            auth.user.clerkUserId,
            conversationId,
            searchParams
        );
        return NextResponse.json(payload);
    } catch (error) {
        return toErrorResponse(error);
    }
}

/**
 * POST /api/conversations/:id/messages
 */
export async function handlePostConversationMessage(
    request: NextRequest,
    conversationId: string
) {
    const auth = await requireStetsonAuth(request);
    if (auth.error) return auth.error;

    let rawBody: unknown;
    try {
        rawBody = await request.json();
    } catch {
        return NextResponse.json(
            {
                error: "Bad Request",
                message: "Request body must be valid JSON.",
            },
            { status: 400 }
        );
    }

    try {
        const message = await sendConversationMessageController(
            auth.user.clerkUserId,
            conversationId,
            rawBody
        );
        return NextResponse.json(message, { status: 201 });
    } catch (error) {
        return toErrorResponse(error);
    }
}

/**
 * POST /api/conversations/for-booking/:bookingId
 */
export async function handlePostConversationForBooking(
    request: NextRequest,
    bookingId: string
) {
    const auth = await requireStetsonAuth(request);
    if (auth.error) return auth.error;

    try {
        const conversation = await createOrGetBookingConversationController(
            auth.user.clerkUserId,
            bookingId
        );
        return NextResponse.json(conversation);
    } catch (error) {
        return toErrorResponse(error);
    }
}

/**
 * POST /api/conversations/for-offer/:offerId
 */
export async function handlePostConversationForOffer(
    request: NextRequest,
    offerId: string
) {
    const auth = await requireStetsonAuth(request);
    if (auth.error) return auth.error;

    try {
        const conversation = await createOrGetOfferConversationController(
            auth.user.clerkUserId,
            offerId
        );
        return NextResponse.json(conversation);
    } catch (error) {
        return toErrorResponse(error);
    }
}
