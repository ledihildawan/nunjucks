// WHY: shell-supplied clock keeps the demo logic deterministic — every sample reads wall-clock time
// through this single module instead of calling new Date() inline, so all clock access stays in one place.

const currentYear = (): number => new Date().getFullYear();

const localizedTime = (date: Date = new Date()): string => date.toLocaleTimeString();

const isoTimestamp = (): string => new Date().toISOString();

export { currentYear, localizedTime, isoTimestamp };