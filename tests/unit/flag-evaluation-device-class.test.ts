import {
	evaluateCondition,
	type EvaluationContext,
} from '@/lib/flag-evaluation';

const ctx = (device_class?: string): EvaluationContext => ({
	environment: 'production',
	localId: 'user-1',
	userAttributes: { platform: 'ios', device_class },
});

describe('evaluateCondition — device_class', () => {
	it('matches when the form factor is in the list', () => {
		expect(
			evaluateCondition(
				{ type: 'device_class', operator: 'in', values: ['phone', 'tablet'] },
				ctx('tablet'),
			),
		).toBe(true);
	});

	it('does not match an absent device_class (absent-field rule)', () => {
		expect(
			evaluateCondition(
				{ type: 'device_class', operator: 'in', values: ['desktop'] },
				ctx(undefined),
			),
		).toBe(false);
		expect(
			evaluateCondition(
				{ type: 'device_class', operator: 'not_in', values: ['desktop'] },
				ctx(undefined),
			),
		).toBe(false);
	});
});
