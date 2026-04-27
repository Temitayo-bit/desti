import { notFound, redirect } from "next/navigation";
import { requireStetsonAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TripRequestDetailClient } from "./TripRequestDetailClient";

interface PageProps {
  params: Promise<{
    requestId: string;
  }>;
}

export default async function TripRequestDetailPage({ params }: PageProps) {
  const { requestId } = await params;
  const auth = await requireStetsonAuth();

  if (auth.error) {
    redirect("/sign-in");
  }

  const currentUserClerkId = auth.user.clerkUserId;

  const tripRequest = await prisma.tripRequest.findUnique({
    where: { id: requestId },
    include: {
      rider: {
        select: {
          name: true,
          profilePictureUrl: true,
        },
      },
      offers: {
        include: {
          driver: { select: { name: true, profilePictureUrl: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      matches: {
        include: {
          ride: {
            include: { driver: { select: { name: true, profilePictureUrl: true } } },
          },
        },
        orderBy: { scoreSnapshot: "desc" },
      },
      bookings: true
    },
  });

  if (!tripRequest) {
    notFound();
  }

  return (
    <TripRequestDetailClient
      tripRequest={tripRequest}
      currentUserClerkId={currentUserClerkId}
    />
  );
}
