// WHY: shell-supplied clock keeps the demo logic deterministic — every sample reads wall-clock time
// through this single module instead of calling new Date() inline, so all clock access stays in one place.

/** Returns the current four-digit year. */
const currentYear = (): number => new Date().getFullYear();

/** Formats a date as a locale-aware time string, defaulting to now. */
const localizedTime = (date: Date = new Date()): string => date.toLocaleTimeString();

/** Returns the current instant as an ISO-8601 UTC timestamp. */
const isoTimestamp = (): string => new Date().toISOString();

export { currentYear, isoTimestamp, localizedTime };
