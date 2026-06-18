import {
	conditionSchema,
	createFlagSchema,
	createRolloutSchema,
	createTestRolloutSchema,
	createTestSchema,
	updateFlagSchema,
	updateRolloutSchema,
} from '@/lib/validation-schemas';

describe('validation-schemas', () => {
	describe('conditionSchema', () => {
		const valid = {
			type: 'app_version',
			operator: 'greater_than',
			values: ['1.2.0'],
		};

		it('accepts a well-formed condition', () => {
			expect(conditionSchema.safeParse(valid).success).toBe(true);
		});

		it('rejects an unknown operator (SDK raw-value drift)', () => {
			// 'not_equals' was removed in favour of the plural 'does_not_equals'
			const r = conditionSchema.safeParse({ ...valid, operator: 'not_equals' });
			expect(r.success).toBe(false);
		});

		it('rejects an unknown condition type', () => {
			const r = conditionSchema.safeParse({ ...valid, type: 'made_up' });
			expect(r.success).toBe(false);
		});

		it('rejects non-string values', () => {
			const r = conditionSchema.safeParse({ ...valid, values: [1, 2] });
			expect(r.success).toBe(false);
		});

		it('accepts every SDK operator', () => {
			const ops = [
				'equals',
				'does_not_equals',
				'in',
				'not_in',
				'greater_than',
				'less_than',
				'greater_than_or_equal',
				'less_than_or_equal',
				'between',
				'custom',
			];
			for (const operator of ops) {
				expect(conditionSchema.safeParse({ ...valid, operator }).success).toBe(
					true,
				);
			}
		});
	});

	describe('createFlagSchema', () => {
		const valid = {
			key: 'store/new_paywall',
			displayName: 'New Paywall',
			type: 'bool',
			defaultValues: { development: true, beta: false, production: false },
			appId: 'app123',
		};

		it('accepts a valid flag', () => {
			expect(createFlagSchema.safeParse(valid).success).toBe(true);
		});

		it('accepts the short-form wire types, not the SDK long form', () => {
			expect(
				createFlagSchema.safeParse({ ...valid, type: 'int' }).success,
			).toBe(true);
			// 'boolean'/'integer' are the SDK *output* form, never accepted on the wire
			expect(
				createFlagSchema.safeParse({ ...valid, type: 'boolean' }).success,
			).toBe(false);
			expect(
				createFlagSchema.safeParse({ ...valid, type: 'integer' }).success,
			).toBe(false);
		});

		it('requires all three environment defaults', () => {
			const r = createFlagSchema.safeParse({
				...valid,
				defaultValues: { development: true },
			});
			expect(r.success).toBe(false);
		});

		it('rejects a missing appId', () => {
			const { appId, ...noApp } = valid;
			expect(createFlagSchema.safeParse(noApp).success).toBe(false);
		});

		it('accepts json object/array flag values', () => {
			expect(
				createFlagSchema.safeParse({
					...valid,
					type: 'json',
					defaultValues: {
						development: { a: 1 },
						beta: [1, 2],
						production: {},
					},
				}).success,
			).toBe(true);
		});
	});

	describe('createRolloutSchema', () => {
		const base = { key: 'k', name: 'n', appId: 'a', conditions: [] };

		it('rejects percentage out of range', () => {
			expect(
				createRolloutSchema.safeParse({ ...base, percentage: 150 }).success,
			).toBe(false);
			expect(
				createRolloutSchema.safeParse({ ...base, percentage: -1 }).success,
			).toBe(false);
		});

		it('accepts boundary percentages', () => {
			expect(
				createRolloutSchema.safeParse({ ...base, percentage: 0 }).success,
			).toBe(true);
			expect(
				createRolloutSchema.safeParse({ ...base, percentage: 100 }).success,
			).toBe(true);
		});
	});

	describe('createTestSchema', () => {
		it('rejects a non-integer variantCount', () => {
			const r = createTestSchema.safeParse({
				key: 'k',
				name: 'n',
				appId: 'a',
				conditions: [],
				variantCount: 2.5,
				trafficSplit: [50, 50],
				variantNames: ['a', 'b'],
			});
			expect(r.success).toBe(false);
		});
	});

	describe('createTestRolloutSchema (discriminated)', () => {
		it('requires percentage for ROLLOUT', () => {
			const r = createTestRolloutSchema.safeParse({
				appId: 'a',
				name: 'n',
				type: 'ROLLOUT',
			});
			expect(r.success).toBe(false);
		});

		it('requires variants for TEST', () => {
			const r = createTestRolloutSchema.safeParse({
				appId: 'a',
				name: 'n',
				type: 'TEST',
			});
			expect(r.success).toBe(false);
		});

		it('accepts a valid ROLLOUT', () => {
			const r = createTestRolloutSchema.safeParse({
				appId: 'a',
				name: 'n',
				type: 'ROLLOUT',
				percentage: 25,
			});
			expect(r.success).toBe(true);
		});
	});

	describe('update schemas strip unknown keys (mass-assignment guard)', () => {
		it('drops id/appId/createdAt from a flag update', () => {
			const parsed = updateFlagSchema.parse({
				displayName: 'Renamed',
				id: 'should-be-dropped',
				appId: 'should-be-dropped',
				createdAt: '2020-01-01',
				archived: true,
			});
			expect(parsed).toEqual({ displayName: 'Renamed', archived: true });
			expect('id' in parsed).toBe(false);
			expect('appId' in parsed).toBe(false);
		});

		it('still enforces percentage bounds on rollout update', () => {
			expect(updateRolloutSchema.safeParse({ percentage: 101 }).success).toBe(
				false,
			);
			expect(updateRolloutSchema.safeParse({ percentage: 50 }).success).toBe(
				true,
			);
		});

		// Rollouts are created with all-null env slots and config-generator skips
		// null envs, so the update path must accept null rolloutValues. Regression
		// for the 400 when adding a flag to an existing rollout.
		it('accepts null and per-flag rolloutValues envs', () => {
			expect(
				updateRolloutSchema.safeParse({
					rolloutValues: { development: null, beta: null, production: null },
					flagIds: ['flag-1'],
				}).success,
			).toBe(true);

			expect(
				updateRolloutSchema.safeParse({
					rolloutValues: {
						development: null,
						beta: null,
						production: { 'flag-1': true },
					},
					flagIds: ['flag-1'],
				}).success,
			).toBe(true);
		});
	});
});
