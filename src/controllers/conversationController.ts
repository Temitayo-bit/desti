import type { Conversation } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assertConversationParticipant } from "@/helpers/conversationAuth";
import {
    ConversationServiceError,
    getOrCreateBookingConversation,
    getOrCreateOfferConversation,
    listUserConversations,
} from "@/services/conversationService";

const latestMessageSelect = {
    id: true,
    conversationId: true,
    senderUserId: true,
    body: true,
    createdAt: true,
} as const;

type LatestConversationMessage = {
    id: string;
    conversationId: string;
    senderUserId: string;
    body: string;
    createdAt: Date;
};

type ConversationCandidateEntry = {
    conversation: Conversation;
    latestMessage: LatestConversationMessage | null;
};

function isConversationEntryPreferred<T extends ConversationCandidateEntry>(
    candidate: T,
    existing: T
): boolean {
    const candidateHasMessage = Boolean(candidate.latestMessage);
    const existingHasMessage = Boolean(existing.latestMessage);

    if (candidateHasMessage && !existingHasMessage) {
        return true;
    }

    if (!candidateHasMessage && existingHasMessage) {
        return false;
    }

    if (candidate.latestMessage && existing.latestMessage) {
        const candidateTime = candidate.latestMessage.createdAt.getTime();
        const existingTime = existing.latestMessage.createdAt.getTime();

        if (candidateTime !== existingTime) {
            return candidateTime > existingTime;
        }

        if (candidate.latestMessage.id !== existing.latestMessage.id) {
            return candidate.latestMessage.id > existing.latestMessage.id;
        }
    }

    const candidateUpdatedTime = candidate.conversation.updatedAt.getTime();
    const existingUpdatedTime = existing.conversation.updatedAt.getTime();
    if (candidateUpdatedTime !== existingUpdatedTime) {
        return candidateUpdatedTime > existingUpdatedTime;
    }

    return candidate.conversation.id > existing.conversation.id;
}

function selectCanonicalConversationEntry<T extends ConversationCandidateEntry>(
    entries: T[]
): T | null {
    if (entries.length === 0) {
        return null;
    }

    let canonical = entries[0];
    for (let index = 1; index < entries.length; index += 1) {
        const entry = entries[index];
        if (isConversationEntryPreferred(entry, canonical)) {
            canonical = entry;
        }
    }

    return canonical;
}

async function loadLatestConversationMessages(
    conversations: Conversation[]
): Promise<(LatestConversationMessage | null)[]> {
    if (conversations.length === 0) {
        return [];
    }

    const conversationIds = conversations.map((conversation) => conversation.id);
    const messages = await prisma.message.findMany({
        where: {
            conversationId: {
                in: conversationIds,
            },
        },
        orderBy: [
            { conversationId: "asc" },
            { createdAt: "desc" },
            { id: "desc" },
        ],
        select: latestMessageSelect,
    });

    const latestByConversationId = new Map<string, LatestConversationMessage>();
    for (const message of messages) {
        if (!latestByConversationId.has(message.conversationId)) {
            latestByConversationId.set(message.conversationId, message);
        }
    }

    return conversations.map(
        (conversation) => latestByConversationId.get(conversation.id) ?? null
    );
}

async function getCanonicalConversationForPair(
    riderUserId: string,
    driverUserId: string
): Promise<Conversation | null> {
    const pairConversations = await prisma.conversation.findMany({
        where: {
            OR: [
                {
                    riderUserId,
                    driverUserId,
                },
                {
                    riderUserId: driverUserId,
                    driverUserId: riderUserId,
                },
            ],
        },
    });

    if (pairConversations.length === 0) {
        return null;
    }

    const latestMessages = await loadLatestConversationMessages(pairConversations);
    const entries: ConversationCandidateEntry[] = pairConversations.map(
        (conversation, index) => ({
            conversation,
            latestMessage: latestMessages[index],
        })
    );

    return selectCanonicalConversationEntry(entries)?.conversation ?? null;
}

export interface ConversationListItem {
    id: string;
    type: Conversation["type"];
    bookingId: string | null;
    offerId: string | null;
    riderUserId: string;
    driverUserId: string;
    updatedAt: Date;
    counterpartUserId: string;
    counterpartDisplayName: string;
    tripDestinationText: string | null;
    tripStartsAt: Date | null;
    latestMessage: {
        id: string;
        conversationId: string;
        senderUserId: string;
        body: string;
        createdAt: Date;
    } | null;
}

/**
 * Returns conversations for a user with latest-message preview.
 */
export async function listConversationsController(
    userId: string
): Promise<ConversationListItem[]> {
    const conversations = await listUserConversations(userId);

    const latestMessages = await loadLatestConversationMessages(conversations);

    const entries = conversations.map((conversation, index) => {
        const counterpartUserId =
            conversation.riderUserId === userId
                ? conversation.driverUserId
                : conversation.driverUserId === userId
                  ? conversation.riderUserId
                  : conversation.riderUserId;

        return {
            conversation,
            latestMessage: latestMessages[index],
            counterpartUserId,
        };
    });

    const canonicalByCounterpart = new Map<string, (typeof entries)[number]>();
    for (const entry of entries) {
        const existing = canonicalByCounterpart.get(entry.counterpartUserId);
        if (!existing) {
            canonicalByCounterpart.set(entry.counterpartUserId, entry);
            continue;
        }

        if (isConversationEntryPreferred(entry, existing)) {
            canonicalByCounterpart.set(entry.counterpartUserId, entry);
        }
    }

    const canonicalEntries = Array.from(canonicalByCounterpart.values()).sort(
        (a, b) => {
            const timeA = a.conversation.updatedAt.getTime();
            const timeB = b.conversation.updatedAt.getTime();
            if (timeA !== timeB) return timeB - timeA;

            if (isConversationEntryPreferred(a, b)) {
                return -1;
            }

            if (isConversationEntryPreferred(b, a)) {
                return 1;
            }

            return 0;
        }
    );

    const counterpartUserIds = Array.from(
        new Set(canonicalEntries.map((entry) => entry.counterpartUserId))
    );
    const counterpartUsers =
        counterpartUserIds.length > 0
            ? await prisma.user.findMany({
                  where: {
                      clerkUserId: {
                          in: counterpartUserIds,
                      },
                  },
                  select: {
                      clerkUserId: true,
                      name: true,
                      email: true,
                  },
              })
            : [];

    const counterpartUserMap = new Map(
        counterpartUsers.map((user) => [user.clerkUserId, user])
    );

    const bookingIds = Array.from(
        new Set(
            canonicalEntries
                .map((entry) => entry.conversation.bookingId)
                .filter((value): value is string => Boolean(value))
        )
    );
    const offerIds = Array.from(
        new Set(
            canonicalEntries
                .map((entry) => entry.conversation.offerId)
                .filter((value): value is string => Boolean(value))
        )
    );

    const [bookingTripRows, offerTripRows] = await Promise.all([
        bookingIds.length > 0
            ? prisma.booking.findMany({
                  where: { id: { in: bookingIds } },
                  select: {
                      id: true,
                      ride: {
                          select: {
                              destinationText: true,
                              earliestDepartAt: true,
                          },
                      },
                      tripRequest: {
                          select: {
                              destinationText: true,
                              earliestDesiredAt: true,
                          },
                      },
                  },
              })
            : Promise.resolve([]),
        offerIds.length > 0
            ? prisma.offer.findMany({
                  where: { id: { in: offerIds } },
                  select: {
                      id: true,
                      tripRequest: {
                          select: {
                              destinationText: true,
                              earliestDesiredAt: true,
                          },
                      },
                  },
              })
            : Promise.resolve([]),
    ]);

    const bookingTripPreviewById = new Map(
        bookingTripRows.map((booking) => {
            const destinationFromRide = booking.ride?.destinationText?.trim() ?? "";
            const destinationFromTripRequest =
                booking.tripRequest?.destinationText?.trim() ?? "";
            const destinationText =
                destinationFromRide || destinationFromTripRequest || null;
            const startsAt =
                booking.ride?.earliestDepartAt ??
                booking.tripRequest?.earliestDesiredAt ??
                null;

            return [
                booking.id,
                {
                    destinationText,
                    startsAt,
                },
            ];
        })
    );

    const offerTripPreviewById = new Map(
        offerTripRows.map((offer) => {
            const destinationText =
                offer.tripRequest?.destinationText?.trim() || null;
            const startsAt = offer.tripRequest?.earliestDesiredAt ?? null;

            return [
                offer.id,
                {
                    destinationText,
                    startsAt,
                },
            ];
        })
    );

    function toCounterpartDisplayName(counterpartUserId: string): string {
        const counterpart = counterpartUserMap.get(counterpartUserId);
        const trimmedName = counterpart?.name?.trim();
        if (trimmedName) {
            return trimmedName;
        }

        const trimmedEmail = counterpart?.email?.trim();
        if (trimmedEmail) {
            const emailLocalPart = trimmedEmail.split("@")[0]?.trim();
            if (emailLocalPart) {
                return emailLocalPart;
            }
        }

        return counterpartUserId;
    }

    function toTripPreview(conversation: Conversation) {
        if (conversation.bookingId) {
            return (
                bookingTripPreviewById.get(conversation.bookingId) ?? {
                    destinationText: null,
                    startsAt: null,
                }
            );
        }

        if (conversation.offerId) {
            return (
                offerTripPreviewById.get(conversation.offerId) ?? {
                    destinationText: null,
                    startsAt: null,
                }
            );
        }

        return {
            destinationText: null,
            startsAt: null,
        };
    }

    return canonicalEntries.map((entry) => {
        const conversation = entry.conversation;
        const counterpartUserId = entry.counterpartUserId;
        const tripPreview = toTripPreview(conversation);
        return {
            id: conversation.id,
            type: conversation.type,
            bookingId: conversation.bookingId,
            offerId: conversation.offerId,
            riderUserId: conversation.riderUserId,
            driverUserId: conversation.driverUserId,
            updatedAt: conversation.updatedAt,
            counterpartUserId,
            counterpartDisplayName: toCounterpartDisplayName(counterpartUserId),
            tripDestinationText: tripPreview.destinationText,
            tripStartsAt: tripPreview.startsAt,
            latestMessage: entry.latestMessage,
        };
    });
}

/**
 * Creates or returns an existing booking conversation, then enforces participant access.
 */
export async function createOrGetBookingConversationController(
    userId: string,
    bookingId: string
): Promise<Conversation> {
    const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        select: {
            id: true,
            tripRequestId: true,
            riderUserId: true,
            driverUserId: true,
            ride: {
                select: {
                    driverUserId: true,
                },
            },
        },
    });

    if (!booking) {
        throw new ConversationServiceError(
            "Booking not found.",
            "BOOKING_NOT_FOUND",
            404
        );
    }

    const driverUserId = booking.driverUserId ?? booking.ride?.driverUserId ?? null;
    const isParticipant =
        booking.riderUserId === userId ||
        (driverUserId !== null && driverUserId === userId);

    if (!isParticipant) {
        throw new ConversationServiceError(
            "Booking not found.",
            "BOOKING_NOT_FOUND",
            404
        );
    }

    // For offer-derived bookings, keep a single canonical thread by
    // reusing the accepted offer conversation when available.
    if (booking.tripRequestId && driverUserId) {
        const canonicalTripRequestConversation = await prisma.conversation.findFirst({
            where: {
                riderUserId: booking.riderUserId,
                driverUserId,
                OR: [
                    {
                        booking: {
                            is: {
                                tripRequestId: booking.tripRequestId,
                            },
                        },
                    },
                    {
                        offer: {
                            is: {
                                tripRequestId: booking.tripRequestId,
                            },
                        },
                    },
                ],
            },
            orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        });

        if (canonicalTripRequestConversation) {
            await assertConversationParticipant(
                canonicalTripRequestConversation.id,
                userId
            );
            return canonicalTripRequestConversation;
        }

        const acceptedOffer = await prisma.offer.findFirst({
            where: {
                tripRequestId: booking.tripRequestId,
                riderUserId: booking.riderUserId,
                driverUserId,
                status: "ACCEPTED",
            },
            select: { id: true },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        });

        if (acceptedOffer) {
            const existingBookingConversation = await prisma.conversation.findUnique({
                where: { bookingId },
            });
            if (existingBookingConversation) {
                await assertConversationParticipant(
                    existingBookingConversation.id,
                    userId
                );
                return existingBookingConversation;
            }

            const conversation = await getOrCreateOfferConversation(acceptedOffer.id);
            await assertConversationParticipant(conversation.id, userId);
            return conversation;
        }
    }

    if (driverUserId) {
        const canonicalPairConversation = await getCanonicalConversationForPair(
            booking.riderUserId,
            driverUserId
        );
        if (canonicalPairConversation) {
            await assertConversationParticipant(canonicalPairConversation.id, userId);
            return canonicalPairConversation;
        }
    }

    const conversation = await getOrCreateBookingConversation(bookingId);
    await assertConversationParticipant(conversation.id, userId);
    return conversation;
}

/**
 * Creates or returns an existing offer conversation, then enforces participant access.
 */
export async function createOrGetOfferConversationController(
    userId: string,
    offerId: string
): Promise<Conversation> {
    const offer = await prisma.offer.findUnique({
        where: { id: offerId },
        select: {
            id: true,
            riderUserId: true,
            driverUserId: true,
        },
    });

    if (!offer) {
        throw new ConversationServiceError(
            "Offer not found.",
            "OFFER_NOT_FOUND",
            404
        );
    }

    if (offer.riderUserId !== userId && offer.driverUserId !== userId) {
        throw new ConversationServiceError(
            "Offer not found.",
            "OFFER_NOT_FOUND",
            404
        );
    }

    const canonicalPairConversation = await getCanonicalConversationForPair(
        offer.riderUserId,
        offer.driverUserId
    );

    if (canonicalPairConversation) {
        await assertConversationParticipant(canonicalPairConversation.id, userId);
        return canonicalPairConversation;
    }

    const conversation = await getOrCreateOfferConversation(offerId);
    await assertConversationParticipant(conversation.id, userId);
    return conversation;
}
