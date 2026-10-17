/**
 * Date flag values on the wire are UTC instants (`2026-06-25T10:30:00.000Z`),
 * the only form every SDK decodes (see artifact-decoder.ts, rule C2). The
 * dashboard edits them with a `datetime-local` input in the admin user's own
 * time zone, so these helpers convert between that and the stored instant.
 */

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Normalise a date value to a canonical UTC instant. A local
 * `YYYY-MM-DDTHH:mm` from the input is read in the browser's time zone; a
 * legacy date-only `YYYY-MM-DD` (what older dashboards stored) is midnight UTC,
 * the same instant `Date.parse` gives it. Unparseable text is returned as is,
 * so publish validation can report it.
 */
export function toUtcInstant(value: string): string {
	const trimmed = value.trim();
	if (trimmed === '') {
		return trimmed;
	}
	const date = DATE_ONLY.test(trimmed)
		? new Date(`${trimmed}T00:00:00.000Z`)
		: new Date(trimmed);
	return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

/** The `YYYY-MM-DDTHH:mm` a `datetime-local` input shows for a stored value. */
export function toLocalDateTimeInput(value: string): string {
	const instant = toUtcInstant(value);
	const date = new Date(instant);
	if (Number.isNaN(date.getTime())) {
		return '';
	}
	const pad = (n: number) => String(n).padStart(2, '0');
	return (
		`${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
		`T${pad(date.getHours())}:${pad(date.getMinutes())}`
	);
}

/** A new date flag's starting value: now, to the minute, as a UTC instant. */
export function defaultDateValue(now: Date = new Date()): string {
	return new Date(Math.floor(now.getTime() / 60_000) * 60_000).toISOString();
}
