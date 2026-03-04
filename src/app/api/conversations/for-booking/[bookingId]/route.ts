import { NextRequest } from "next/server";
import { handlePostConversationForBooking } from "@/routes/conversations";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ bookingId: string }> }
) {
    const { bookingId } = await params;
    return handlePostConversationForBooking(request, bookingId);
}
