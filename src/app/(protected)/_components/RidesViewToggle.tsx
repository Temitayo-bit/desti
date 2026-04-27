"use client";

import { getRidesViewHref, type RidesView } from "@/lib/ride-view";
import { ViewToggle } from "./ViewToggle";

interface RidesViewToggleProps {
  activeView: RidesView;
}

export function RidesViewToggle({ activeView }: RidesViewToggleProps) {
  return (
    <ViewToggle
      activeView={activeView}
      options={[
        { value: "browse", label: "Browse Rides", href: getRidesViewHref("browse") },
        { value: "my", label: "My Rides", href: getRidesViewHref("my") },
      ]}
    />
  );
}
