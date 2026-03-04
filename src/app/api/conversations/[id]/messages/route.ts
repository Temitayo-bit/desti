import { NextRequest } from "next/server";
import {
    handleGetConversationMessages,
    handlePostConversationMessage,
} from "@/routes/conversations";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    return handleGetConversationMessages(request, id);
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    return handlePostConversationMessage(request, id);
}
