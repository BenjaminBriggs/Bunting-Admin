import { decodeArtifact } from '@/lib/artifact-decoder';
import {
	defaultDateValue,
	toLocalDateTimeInput,
	toUtcInstant,
} from '@/lib/date-values';

// Every value these helpers produce must be a date the SDKs decode (rule C2).
const decodesAsDate = (value: string) =>
	decodeArtifact(
		JSON.stringify({
			schema_version: 1,
			config_version: 'v',
			published_at: '2026-01-01T00:00:00.000Z',
			app_identifier: 'a',
			flags: {
				d: {
					type: 'date',
					development: { default: value },
					beta: { default: value },
					production: { default: value },
				},
			},
		}),
	).skippedFlags.length === 0;

describe('toUtcInstant', () => {
	it('reads a legacy date-only value as midnight UTC', () => {
		expect(toUtcInstant('2026-06-25')).toBe('2026-06-25T00:00:00.000Z');
	});

	it('canonicalises an instant', () => {
		expect(toUtcInstant('2026-06-25T10:30:00Z')).toBe(
			'2026-06-25T10:30:00.000Z',
		);
	});

	it('reads a datetime-local value in the local time zone', () => {
		const local = '2026-06-25T10:30';
		expect(toUtcInstant(local)).toBe(new Date(local).toISOString());
	});

	it('leaves unparseable text for publish validation to report', () => {
		expect(toUtcInstant('next tuesday')).toBe('next tuesday');
	});

	it('only ever produces dates the SDKs decode', () => {
		for (const input of [
			'2026-06-25',
			'2026-06-25T10:30',
			'2026-06-25T10:30:00Z',
			'2026-06-25T10:30:00+02:00',
		]) {
			expect(decodesAsDate(toUtcInstant(input))).toBe(true);
		}
	});
});

describe('toLocalDateTimeInput', () => {
	it('round-trips through the input to the same instant', () => {
		const stored = '2026-06-25T10:30:00.000Z';
		expect(toUtcInstant(toLocalDateTimeInput(stored))).toBe(stored);
	});

	it('shows nothing for an unparseable value', () => {
		expect(toLocalDateTimeInput('garbage')).toBe('');
	});
});

describe('defaultDateValue', () => {
	it('is the current minute as a decodable UTC instant', () => {
		const value = defaultDateValue(new Date('2026-06-25T10:30:45.678Z'));
		expect(value).toBe('2026-06-25T10:30:00.000Z');
		expect(decodesAsDate(value)).toBe(true);
	});
});
