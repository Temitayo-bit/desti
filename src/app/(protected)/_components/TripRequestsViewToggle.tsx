"use client";

import {
  getTripRequestsViewHref,
  type TripRequestsView,
} from "@/lib/trip-request-view";
import { ViewToggle } from "./ViewToggle";

interface TripRequestsViewToggleProps {
  activeView: TripRequestsView;
}

export function TripRequestsViewToggle({
  activeView,
}: TripRequestsViewToggleProps) {
  return (
    <ViewToggle
      activeView={activeView}
      options={[
        {
          value: "browse",
          label: "Browse Trip Requests",
          href: getTripRequestsViewHref("browse"),
        },
        {
          value: "my",
          label: "My Trip Requests",
          href: getTripRequestsViewHref("my"),
        },
        {
          value: "offers",
          label: "Offers",
          href: getTripRequestsViewHref("offers"),
        },
      ]}
    />
  );
}
