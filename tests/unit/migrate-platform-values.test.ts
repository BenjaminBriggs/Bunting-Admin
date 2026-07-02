import { migrateConditionsArray } from '../../scripts/migrate-platform-values';

describe('migrateConditionsArray', () => {
	it('lowercases plain platform values', () => {
		const { conditions, changed } = migrateConditionsArray([
			{ type: 'platform', operator: 'in', values: ['iOS', 'macOS'] },
		]);
		expect(changed).toBe(true);
		expect(conditions[0].values).toEqual(['ios', 'macos']);
	});

	it('turns an iPad-only rule into ios + device_class:[tablet]', () => {
		const { conditions, needsReview } = migrateConditionsArray([
			{ type: 'platform', operator: 'in', values: ['iPadOS'] },
		]);
		expect(conditions[0]).toMatchObject({ type: 'platform', values: ['ios'] });
		expect(conditions[1]).toEqual({
			type: 'device_class',
			operator: 'in',
			values: ['tablet'],
		});
		expect(needsReview).toBe(false);
	});

	it('flags a combined iPhone+iPad rule for review and still appends tablet', () => {
		const { conditions, needsReview } = migrateConditionsArray([
			{ type: 'platform', operator: 'in', values: ['iOS', 'iPadOS'] },
		]);
		expect(conditions[0].values).toEqual(['ios']);
		expect(conditions[1]).toEqual({
			type: 'device_class',
			operator: 'in',
			values: ['tablet'],
		});
		expect(needsReview).toBe(true);
	});

	it('leaves already-migrated arrays unchanged', () => {
		const input = [{ type: 'platform', operator: 'in', values: ['ios'] }];
		const { changed } = migrateConditionsArray(input);
		expect(changed).toBe(false);
	});

	it('ignores non-platform conditions', () => {
		const { changed } = migrateConditionsArray([
			{ type: 'region', operator: 'in', values: ['US'] },
		]);
		expect(changed).toBe(false);
	});
});
