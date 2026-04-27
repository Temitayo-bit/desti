"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import {
  LOCATION_AUTOCOMPLETE_DEBOUNCE_MS,
  LOCATION_AUTOCOMPLETE_MIN_QUERY_LENGTH,
  fetchMapboxLocationSuggestions,
  isMapboxAutocompleteEnabled,
  type MapboxLocationSuggestion,
} from "@/lib/mapbox-location-autocomplete";
import {
  hasValidLocationFieldSelection,
  toLocationSelectionOrNull,
  type LocationField,
} from "@/lib/location-field";

interface LocationAutocompleteInputProps {
  id: string;
  label: string;
  placeholder: string;
  locationField: LocationField;
  error?: string;
  /** Optional icon or prefix shown inside the field (e.g. map pin). */
  startAdornment?: ReactNode;
  labelClassName?: string;
  onInputChange: (nextValue: string) => void;
  onSuggestionSelect: (selection: {
    label: string;
    latitude: number;
    longitude: number;
  }) => void;
}

export function LocationAutocompleteInput({
  id,
  label,
  placeholder,
  locationField,
  error,
  startAdornment,
  labelClassName = "mb-2 block text-sm font-semibold text-emerald-800",
  onInputChange,
  onSuggestionSelect,
}: LocationAutocompleteInputProps) {
  const [debouncedQuery, setDebouncedQuery] = useState(locationField.inputText.trim());
  const [suggestions, setSuggestions] = useState<MapboxLocationSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const blurTimeoutRef = useRef<number | null>(null);
  const latestRequestIdRef = useRef(0);

  const autocompleteEnabled = useMemo(() => isMapboxAutocompleteEnabled(), []);

  const trimmedValue = locationField.inputText.trim();
  const selectedLocation = toLocationSelectionOrNull(locationField);

  const hasExactSelection = Boolean(
    selectedLocation &&
      selectedLocation.label === trimmedValue &&
      hasValidLocationFieldSelection(locationField),
  );

  const shouldQuery =
    autocompleteEnabled &&
    debouncedQuery.length >= LOCATION_AUTOCOMPLETE_MIN_QUERY_LENGTH &&
    !hasExactSelection;

  const showDropdown =
    isFocused &&
    autocompleteEnabled &&
    trimmedValue.length >= LOCATION_AUTOCOMPLETE_MIN_QUERY_LENGTH &&
    !hasExactSelection;

  const selectionRequiredInvalid = trimmedValue.length > 0 && !hasExactSelection;

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedQuery(locationField.inputText.trim());
    }, LOCATION_AUTOCOMPLETE_DEBOUNCE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [locationField.inputText]);

  useEffect(() => {
    if (!shouldQuery) {
      return;
    }

    const requestId = latestRequestIdRef.current + 1;
    latestRequestIdRef.current = requestId;

    const controller = new AbortController();
    const loadingTimeout = window.setTimeout(() => {
      if (latestRequestIdRef.current === requestId) {
        setIsLoading(true);
        setRequestError(null);
      }
    }, 0);

    void fetchMapboxLocationSuggestions(debouncedQuery, {
      signal: controller.signal,
    })
      .then((results) => {
        if (latestRequestIdRef.current !== requestId) {
          return;
        }

        setSuggestions(results);
        setHighlightedIndex(results.length > 0 ? 0 : -1);
      })
      .catch((requestFailure: unknown) => {
        if (
          typeof requestFailure === "object" &&
          requestFailure !== null &&
          "name" in requestFailure &&
          (requestFailure as { name: string }).name === "AbortError"
        ) {
          return;
        }

        if (latestRequestIdRef.current !== requestId) {
          return;
        }

        setSuggestions([]);
        setHighlightedIndex(-1);
        setRequestError("Unable to load location suggestions right now.");
      })
      .finally(() => {
        if (latestRequestIdRef.current === requestId) {
          setIsLoading(false);
        }
      });

    return () => {
      window.clearTimeout(loadingTimeout);
      controller.abort();
    };
  }, [debouncedQuery, shouldQuery]);

  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current !== null) {
        window.clearTimeout(blurTimeoutRef.current);
      }
    };
  }, []);

  function handleInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!showDropdown || suggestions.length === 0) {
      if (event.key === "Escape") {
        setIsFocused(false);
      }
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightedIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((prev) => Math.max(prev - 1, 0));
      return;
    }

    if (event.key === "Enter" && highlightedIndex >= 0) {
      event.preventDefault();
      selectSuggestion(suggestions[highlightedIndex]);
      return;
    }

    if (event.key === "Escape") {
      setIsFocused(false);
    }
  }

  function selectSuggestion(suggestion: MapboxLocationSuggestion) {
    onSuggestionSelect({
      label: suggestion.label,
      latitude: suggestion.latitude,
      longitude: suggestion.longitude,
    });

    setSuggestions([]);
    setIsFocused(false);
    setRequestError(null);
    setIsLoading(false);
    setHighlightedIndex(-1);
  }

  return (
    <div className="md:col-span-1">
      <label htmlFor={id} className={labelClassName}>
        {label}
      </label>

      <div className="relative">
        {startAdornment ? (
          <div
            className={`flex w-full items-center gap-2 rounded-xl border bg-zinc-50 text-zinc-900 transition-all ${
              error || selectionRequiredInvalid
                ? "border-red-300 focus-within:border-red-500 focus-within:ring-1 focus-within:ring-red-500"
                : "border-zinc-200/80 focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500"
            }`}
          >
            <span className="pl-3 text-zinc-500 shrink-0" aria-hidden>
              {startAdornment}
            </span>
            <input
              id={id}
              type="text"
              value={locationField.inputText}
              onFocus={() => setIsFocused(true)}
              onBlur={() => {
                blurTimeoutRef.current = window.setTimeout(() => {
                  setIsFocused(false);
                }, 100);
              }}
              onChange={(event) => {
                onInputChange(event.target.value);
                setSuggestions([]);
                setHighlightedIndex(-1);
                setRequestError(null);
                setIsLoading(false);
              }}
              onKeyDown={handleInputKeyDown}
              className="min-w-0 flex-1 border-0 bg-transparent py-3 pr-3 pl-0 text-zinc-900 outline-none"
              placeholder={placeholder}
              autoComplete="off"
              role="combobox"
              aria-expanded={showDropdown}
              aria-controls={`${id}-autocomplete-list`}
              aria-autocomplete="list"
              aria-invalid={Boolean(error || selectionRequiredInvalid)}
            />
          </div>
        ) : (
          <input
            id={id}
            type="text"
            value={locationField.inputText}
            onFocus={() => setIsFocused(true)}
            onBlur={() => {
              blurTimeoutRef.current = window.setTimeout(() => {
                setIsFocused(false);
              }, 100);
            }}
            onChange={(event) => {
              onInputChange(event.target.value);
              setSuggestions([]);
              setHighlightedIndex(-1);
              setRequestError(null);
              setIsLoading(false);
            }}
            onKeyDown={handleInputKeyDown}
            className={`w-full rounded-xl border p-3 text-zinc-900 transition-all outline-none ${
              error || selectionRequiredInvalid
                ? "border-red-300 focus:border-red-500 focus:ring-1 focus:ring-red-500"
                : "border-zinc-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            }`}
            placeholder={placeholder}
            autoComplete="off"
            role="combobox"
            aria-expanded={showDropdown}
            aria-controls={`${id}-autocomplete-list`}
            aria-autocomplete="list"
            aria-invalid={Boolean(error || selectionRequiredInvalid)}
          />
        )}

        {showDropdown && (
          <div
            id={`${id}-autocomplete-list`}
            role="listbox"
            className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg"
          >
            {isLoading && (
              <div className="px-3 py-2 text-sm text-zinc-500">Loading suggestions...</div>
            )}

            {!isLoading && requestError && (
              <div className="px-3 py-2 text-sm text-red-600">{requestError}</div>
            )}

            {!isLoading && !requestError && suggestions.length === 0 && (
              <div className="px-3 py-2 text-sm text-zinc-500">No results found.</div>
            )}

            {!isLoading && !requestError && suggestions.length > 0 && (
              <ul>
                {suggestions.map((suggestion, index) => (
                  <li key={suggestion.id}>
                    <button
                      type="button"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        selectSuggestion(suggestion);
                      }}
                      className={`w-full px-3 py-2 text-left text-sm transition-colors ${
                        index === highlightedIndex
                          ? "bg-emerald-50 text-emerald-800"
                          : "text-zinc-800 hover:bg-zinc-50"
                      }`}
                      role="option"
                      aria-selected={index === highlightedIndex}
                    >
                      {suggestion.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}

      {!error && !autocompleteEnabled && (
        <p className="mt-1 text-xs text-red-600">
          Mapbox autocomplete is not configured. Please configure it to submit this field.
        </p>
      )}

      {!error &&
        autocompleteEnabled &&
        !hasExactSelection &&
        selectionRequiredInvalid && (
        <p className="mt-1 text-xs text-red-600">
          Please select a valid location from suggestions.
        </p>
        )}

    </div>
  );
}
