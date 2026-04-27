import { notFound, redirect } from "next/navigation";
import { requireStetsonAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { RideDetailClient } from "./RideDetailClient";

interface PageProps {
  params: Promise<{
    rideId: string;
  }>;
}

export default async function RideDetailPage({ params }: PageProps) {
  const { rideId } = await params;
  const auth = await requireStetsonAuth();

  if (auth.error) {
    redirect("/sign-in");
  }

  const currentUserClerkId = auth.user.clerkUserId;

  const ride = await prisma.ride.findUnique({
    where: { id: rideId },
    include: {
      driver: {
        select: {
          name: true,
          profilePictureUrl: true,
        },
      },
      rideOffers: {
        include: {
          rider: { select: { name: true, profilePictureUrl: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      stopRequests: {
        include: {
          rider: { select: { name: true, profilePictureUrl: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      matches: {
        where: {
          ride: { driverUserId: currentUserClerkId },
        },
        include: {
          tripRequest: {
            include: { rider: { select: { name: true, profilePictureUrl: true } } },
          },
        },
        orderBy: { scoreSnapshot: "desc" },
      },
      bookings: true
    },
  });

  if (!ride) {
    notFound();
  }

  return (
    <RideDetailClient
      ride={ride}
      currentUserClerkId={currentUserClerkId}
    />
  );
}
