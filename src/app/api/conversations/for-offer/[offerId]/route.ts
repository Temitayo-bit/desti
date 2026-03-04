import { NextRequest } from "next/server";
import { handlePostConversationForOffer } from "@/routes/conversations";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ offerId: string }> }
) {
    const { offerId } = await params;
    return handlePostConversationForOffer(request, offerId);
}
