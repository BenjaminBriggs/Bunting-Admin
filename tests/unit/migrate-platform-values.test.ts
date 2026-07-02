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

	it('maps a combined iPhone+iPad rule to plain ios with no tablet append or review', () => {
		const { conditions, needsReview } = migrateConditionsArray([
			{ type: 'platform', operator: 'in', values: ['iOS', 'iPadOS'] },
		]);
		expect(conditions).toEqual([
			{ type: 'platform', operator: 'in', values: ['ios'] },
		]);
		expect(needsReview).toBe(false);
	});

	it('flags an iPadOS + non-iOS platform rule for review, widened, no tablet append', () => {
		const { conditions, needsReview } = migrateConditionsArray([
			{ type: 'platform', operator: 'in', values: ['iPadOS', 'macOS'] },
		]);
		expect(conditions).toEqual([
			{ type: 'platform', operator: 'in', values: ['ios', 'macos'] },
		]);
		expect(needsReview).toBe(true);
	});

	it('dedupes a duplicated iPadOS-only rule and still appends tablet exactly', () => {
		const { conditions, needsReview } = migrateConditionsArray([
			{ type: 'platform', operator: 'in', values: ['iPadOS', 'iPadOS'] },
		]);
		expect(conditions).toEqual([
			{ type: 'platform', operator: 'in', values: ['ios'] },
			{ type: 'device_class', operator: 'in', values: ['tablet'] },
		]);
		expect(needsReview).toBe(false);
	});

	it('maps iOS+iPadOS+macOS (case 2 with extra platforms) with no tablet or review', () => {
		const { conditions, needsReview } = migrateConditionsArray([
			{ type: 'platform', operator: 'in', values: ['iOS', 'iPadOS', 'macOS'] },
		]);
		expect(conditions).toEqual([
			{ type: 'platform', operator: 'in', values: ['ios', 'macos'] },
		]);
		expect(needsReview).toBe(false);
	});

	it('maps not_in [iOS, iPadOS] to not_in [ios] exactly, no review', () => {
		const { conditions, needsReview } = migrateConditionsArray([
			{ type: 'platform', operator: 'not_in', values: ['iOS', 'iPadOS'] },
		]);
		expect(conditions).toEqual([
			{ type: 'platform', operator: 'not_in', values: ['ios'] },
		]);
		expect(needsReview).toBe(false);
	});

	it('leaves not_in [iPadOS] completely untouched and flags it for review', () => {
		const input = [
			{ type: 'platform', operator: 'not_in', values: ['iPadOS'] },
		];
		const { conditions, changed, needsReview } = migrateConditionsArray(input);
		expect(conditions).toEqual(input);
		expect(changed).toBe(false);
		expect(needsReview).toBe(true);
	});

	it('leaves not_in [iPadOS, macOS] completely untouched and flags it for review', () => {
		const input = [
			{ type: 'platform', operator: 'not_in', values: ['iPadOS', 'macOS'] },
		];
		const { conditions, changed, needsReview } = migrateConditionsArray(input);
		expect(conditions).toEqual(input);
		expect(changed).toBe(false);
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
