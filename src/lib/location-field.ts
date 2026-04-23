import {
  hasValidSelectedCoordinates,
  type LocationSelection,
} from "@/lib/mapbox-location-autocomplete";

export interface LocationField {
  inputText: string;
  selectedLabel: string | null;
  latitude: number | null;
  longitude: number | null;
  isValidSelection: boolean;
}

export function createEmptyLocationField(): LocationField {
  return {
    inputText: "",
    selectedLabel: null,
    latitude: null,
    longitude: null,
    isValidSelection: false,
  };
}

export function createLocationFieldFromSelection(
  selection: LocationSelection,
): LocationField {
  return {
    inputText: selection.label,
    selectedLabel: selection.label,
    latitude: selection.latitude,
    longitude: selection.longitude,
    isValidSelection: true,
  };
}

export function clearLocationFieldSelection(
  current: LocationField,
  nextInputText: string,
): LocationField {
  return {
    ...current,
    inputText: nextInputText,
    selectedLabel: null,
    latitude: null,
    longitude: null,
    isValidSelection: false,
  };
}

export function updateLocationFieldInput(
  current: LocationField,
  nextInputText: string,
): LocationField {
  const trimmedInput = nextInputText.trim();

  if (
    current.isValidSelection &&
    current.selectedLabel !== null &&
    trimmedInput === current.selectedLabel &&
    hasValidSelectedCoordinates(current.latitude, current.longitude)
  ) {
    return {
      ...current,
      inputText: nextInputText,
    };
  }

  return clearLocationFieldSelection(current, nextInputText);
}

export function hasValidLocationFieldSelection(
  field: LocationField,
): boolean {
  if (!field.isValidSelection || field.selectedLabel === null) {
    return false;
  }

  return (
    field.inputText.trim() === field.selectedLabel &&
    hasValidSelectedCoordinates(field.latitude, field.longitude)
  );
}

export function toLocationSelectionOrNull(
  field: LocationField,
): LocationSelection | null {
  if (!hasValidLocationFieldSelection(field)) {
    return null;
  }

  if (typeof field.latitude !== "number" || typeof field.longitude !== "number") {
    return null;
  }

  return {
    label: field.selectedLabel!,
    latitude: field.latitude,
    longitude: field.longitude,
  };
}
