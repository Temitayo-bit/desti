import { NextRequest } from "next/server";
import { handleGetConversations } from "@/routes/conversations";

export async function GET(request: NextRequest) {
    return handleGetConversations(request);
}
