/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { act, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocationAutocompleteInput } from "@/components/LocationAutocompleteInput";
import {
  createEmptyLocationField,
  createLocationFieldFromSelection,
  updateLocationFieldInput,
  type LocationField,
} from "@/lib/location-field";

interface HarnessProps {
  initialField?: LocationField;
  onLocationChange?: (field: LocationField) => void;
}

function Harness({
  initialField = createEmptyLocationField(),
  onLocationChange,
}: HarnessProps) {
  const [locationField, setLocationField] = useState<LocationField>(initialField);

  return (
    <LocationAutocompleteInput
      id="origin"
      label="Origin"
      placeholder="Type a location"
      locationField={locationField}
      onInputChange={(nextValue) => {
        const nextField = updateLocationFieldInput(locationField, nextValue);
        setLocationField(nextField);
        onLocationChange?.(nextField);
      }}
      onSuggestionSelect={(selection) => {
        const nextField = createLocationFieldFromSelection(selection);
        setLocationField(nextField);
        onLocationChange?.(nextField);
      }}
    />
  );
}

function mockJsonResponse(payload: unknown): Response {
  return {
    ok: true,
    json: async () => payload,
  } as Response;
}

describe("LocationAutocompleteInput", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubEnv("NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN", "pk.test-token");
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("debounces suggestion requests while typing", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(
      mockJsonResponse({
        features: [
          {
            id: "feature-1",
            place_name: "DeLand, Florida, United States",
            center: [-81.3031, 29.0283],
            place_type: ["place"],
          },
        ],
      }),
    );

    render(<Harness />);

    const input = screen.getByRole("combobox", { name: "Origin" });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Del" } });

    expect(fetchMock).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(299);
    });
    expect(fetchMock).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(1);
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  it("renders loading, no-results, and error states", async () => {
    const fetchMock = vi.mocked(fetch);

    const pendingFirst: { release?: (value: Response) => void } = {};
    fetchMock.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          pendingFirst.release = resolve;
        }),
    );

    render(<Harness />);

    const input = screen.getByRole("combobox", { name: "Origin" });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Del" } });

    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    expect(screen.queryByText("Loading suggestions...")).not.toBeNull();

    pendingFirst.release?.(mockJsonResponse({ features: [] }));

    await waitFor(() => {
      expect(screen.queryByText("No results found.")).not.toBeNull();
    });

    fetchMock.mockRejectedValueOnce(new Error("network"));
    fireEvent.change(input, { target: { value: "Deland" } });

    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(
        screen.queryByText("Unable to load location suggestions right now."),
      ).not.toBeNull();
    });
  });

  it("selects a suggestion and stores valid selection state", async () => {
    const fetchMock = vi.mocked(fetch);
    const onLocationChange = vi.fn();

    fetchMock.mockResolvedValue(
      mockJsonResponse({
        features: [
          {
            id: "feature-1",
            place_name: "Stetson University, DeLand, Florida",
            center: [-81.302, 29.0361],
            place_type: ["poi"],
          },
        ],
      }),
    );

    render(<Harness onLocationChange={onLocationChange} />);

    const input = screen.getByRole("combobox", { name: "Origin" });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Stet" } });

    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    const option = await screen.findByRole("option", {
      name: "Stetson University, DeLand, Florida",
    });

    fireEvent.mouseDown(option);

    const latestCall = onLocationChange.mock.calls.at(-1)?.[0] as LocationField;
    expect(latestCall).toMatchObject({
      inputText: "Stetson University, DeLand, Florida",
      selectedLabel: "Stetson University, DeLand, Florida",
      latitude: 29.0361,
      longitude: -81.302,
      isValidSelection: true,
    });

    await waitFor(() => {
      expect(screen.queryByText("Please select a valid location from suggestions.")).toBeNull();
    });
  });

  it("invalidates selection when text changes after selection", () => {
    const onLocationChange = vi.fn();

    render(
      <Harness
        initialField={{
          inputText: "Stetson University, DeLand, Florida",
          selectedLabel: "Stetson University, DeLand, Florida",
          latitude: 29.0361,
          longitude: -81.302,
          isValidSelection: true,
        }}
        onLocationChange={onLocationChange}
      />,
    );

    const input = screen.getByRole("combobox", { name: "Origin" });
    fireEvent.change(input, {
      target: { value: "Stetson University, DeLand, Florida Campus" },
    });

    const latestCall = onLocationChange.mock.calls.at(-1)?.[0] as LocationField;
    expect(latestCall).toMatchObject({
      selectedLabel: null,
      latitude: null,
      longitude: null,
      isValidSelection: false,
    });

    expect(
      screen.queryByText("Please select a valid location from suggestions."),
    ).not.toBeNull();
    expect(screen.queryByText("Valid suggestion selected.")).toBeNull();
  });
});
