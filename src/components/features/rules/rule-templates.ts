import type { Condition } from '@/types/core';
import type { ConditionTemplate } from '@/types/rules';

/**
 * Condition Templates for Bunting Feature Flag Targeting
 *
 * This module defines all available condition types for user targeting in
 * tests and rollouts. Each template specifies the condition type, supported operators,
 * value input method, and UI configuration.
 *
 * The templates are aligned with the Bunting SDK specification to ensure
 * consistent evaluation behavior across admin panel and client SDKs.
 *
 * @see {@link https://docs.bunting.com/sdk-conditions} SDK Condition Documentation
 */
export const conditionTemplates: ConditionTemplate[] = [
	{
		type: 'app_version',
		label: 'App Version',
		description: 'Target users based on their app version (SemVer)',
		operators: [
			'equals',
			'does_not_equals',
			'greater_than',
			'less_than',
			'greater_than_or_equal',
			'less_than_or_equal',
			'between',
		],
		valueType: 'text',
		placeholder: '1.0.0, 1.2.0, 2.0.0',
	},
	{
		type: 'os_version',
		label: 'OS Version',
		description: 'Target users based on their operating system version',
		operators: [
			'equals',
			'does_not_equals',
			'greater_than',
			'less_than',
			'greater_than_or_equal',
			'less_than_or_equal',
			'between',
		],
		valueType: 'text',
		placeholder: '18.0, 17.5, 14.0',
	},
	{
		type: 'build_number',
		label: 'Build Number',
		description: 'Target users based on their app build number',
		operators: [
			'equals',
			'does_not_equals',
			'greater_than',
			'less_than',
			'greater_than_or_equal',
			'less_than_or_equal',
			'between',
		],
		valueType: 'number',
		placeholder: '100, 200, 300',
	},
	{
		type: 'platform',
		label: 'Platform',
		description: 'Target users based on their platform/device',
		operators: ['in', 'not_in'],
		valueType: 'multi-select',
		options: [
			{ value: 'iOS', label: 'iOS' },
			{ value: 'iPadOS', label: 'iPadOS' },
			{ value: 'macOS', label: 'macOS' },
			{ value: 'watchOS', label: 'watchOS' },
			{ value: 'tvOS', label: 'tvOS' },
		],
	},
	{
		type: 'device_model',
		label: 'Device Model',
		description: 'Target users based on their device model',
		operators: ['in', 'not_in'],
		valueType: 'multi-select',
		placeholder: 'iPhone15,2, iPhone14,7, iPad13,1',
	},
	{
		type: 'language',
		label: 'Language',
		description:
			'Target users based on their language code (derived from the device locale, e.g. "en" from "en-GB").',
		operators: ['in', 'not_in'],
		valueType: 'multi-select',
		placeholder: 'en, fr, de, es',
		options: [
			{ value: 'en', label: 'English' },
			{ value: 'fr', label: 'French' },
			{ value: 'de', label: 'German' },
			{ value: 'es', label: 'Spanish' },
			{ value: 'it', label: 'Italian' },
			{ value: 'pt', label: 'Portuguese' },
			{ value: 'nl', label: 'Dutch' },
			{ value: 'ja', label: 'Japanese' },
			{ value: 'ko', label: 'Korean' },
			{ value: 'zh', label: 'Chinese' },
			{ value: 'ru', label: 'Russian' },
			{ value: 'ar', label: 'Arabic' },
			{ value: 'hi', label: 'Hindi' },
		],
	},
	{
		type: 'region',
		label: 'Country',
		description: 'Target users based on their country/location',
		operators: ['in', 'not_in'],
		valueType: 'multi-select',
		options: [
			{ value: 'US', label: 'United States' },
			{ value: 'CA', label: 'Canada' },
			{ value: 'GB', label: 'United Kingdom' },
			{ value: 'DE', label: 'Germany' },
			{ value: 'FR', label: 'France' },
			{ value: 'JP', label: 'Japan' },
			{ value: 'AU', label: 'Australia' },
		],
	},
	{
		type: 'custom_attribute',
		label: 'Custom Attribute',
		description:
			"Target users based on custom attributes defined in your app. The attribute name is passed to the SDK's custom attribute resolver.",
		operators: ['custom'],
		valueType: 'text',
		placeholder: 'Enter custom attribute name',
	},
];

/**
 * Human-readable labels for condition operators
 *
 * Maps operator keys to user-friendly labels displayed in the condition builder UI.
 * Includes both standard operators and SDK-specific aliases.
 */
export const operatorLabels: Record<string, string> = {
	equals: 'equals',
	does_not_equals: 'does not equal',
	in: 'is one of',
	not_in: 'is not one of',
	greater_than: 'is greater than',
	less_than: 'is less than',
	greater_than_or_equal: 'is greater than or equal to',
	less_than_or_equal: 'is less than or equal to',
	between: 'is between',
	custom: 'custom evaluation',
};

/**
 * Short operator symbols used for compact condition chips (e.g. on dashboard cards).
 * `equals` is intentionally blank — the type label + ":" already reads as equality.
 */
const compactOperatorSymbols: Record<string, string> = {
	equals: '',
	does_not_equals: '≠',
	greater_than: '>',
	less_than: '<',
	greater_than_or_equal: '≥',
	less_than_or_equal: '≤',
};

/**
 * Compact, human-readable label for a single targeting condition, e.g.
 * "Platform: iOS, macOS" or "App Version: ≥2.0.0". Used to show who a test/rollout
 * affects at a glance.
 */
export function conditionLabel(condition: Condition): string {
	const typeLabel =
		conditionTemplates.find((t) => t.type === condition.type)?.label ??
		condition.type;
	const values = Array.isArray(condition.values) ? condition.values : [];

	let valuePart: string;
	switch (condition.operator) {
		case 'between':
			valuePart = `${values[0] ?? ''}–${values[1] ?? ''}`;
			break;
		case 'in':
			valuePart = values.join(', ');
			break;
		case 'not_in':
			valuePart = `not ${values.join(', ')}`;
			break;
		case 'custom':
			valuePart = values[0] ?? '';
			break;
		default:
			valuePart = `${compactOperatorSymbols[condition.operator] ?? ''}${values[0] ?? ''}`;
	}

	return valuePart ? `${typeLabel}: ${valuePart}` : typeLabel;
}
