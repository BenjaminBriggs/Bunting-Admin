import { ConditionTemplate } from '@/types/rules';

/**
 * Condition Templates for Bunting Feature Flag Targeting
 *
 * This module defines all available condition types for user targeting in cohorts,
 * tests, and rollouts. Each template specifies the condition type, supported operators,
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
    operators: ['equals', 'does_not_equal', 'greater_than', 'less_than', 'greater_than_or_equal', 'less_than_or_equal', 'between', 'in', 'not_in'],
    valueType: 'text',
    placeholder: '1.0.0, 1.2.0, 2.0.0'
  },
  {
    type: 'os_version',
    label: 'OS Version',
    description: 'Target users based on their operating system version',
    operators: ['equals', 'does_not_equal', 'greater_than', 'less_than', 'greater_than_or_equal', 'less_than_or_equal', 'between', 'in', 'not_in'],
    valueType: 'text',
    placeholder: '18.0, 17.5, 14.0'
  },
  {
    type: 'build_number',
    label: 'Build Number',
    description: 'Target users based on their app build number',
    operators: ['equals', 'does_not_equal', 'greater_than', 'less_than', 'greater_than_or_equal', 'less_than_or_equal', 'between', 'in', 'not_in'],
    valueType: 'number',
    placeholder: '100, 200, 300'
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
      { value: 'tvOS', label: 'tvOS' }
    ]
  },
  {
    type: 'device_model',
    label: 'Device Model',
    description: 'Target users based on their device model',
    operators: ['in', 'not_in'],
    valueType: 'multi-select',
    placeholder: 'iPhone15,2, iPhone14,7, iPad13,1'
  },
  {
    type: 'locale',
    label: 'Locale',
    description: 'Target users based on their locale (prefix aware)',
    operators: ['in', 'not_in'],
    valueType: 'multi-select',
    placeholder: 'en, en-US, fr-CA, de-DE',
    options: [
      { value: 'en', label: 'English (any)' },
      { value: 'en-US', label: 'English (US)' },
      { value: 'en-GB', label: 'English (UK)' },
      { value: 'fr', label: 'French (any)' },
      { value: 'fr-FR', label: 'French (France)' },
      { value: 'fr-CA', label: 'French (Canada)' },
      { value: 'de', label: 'German (any)' },
      { value: 'de-DE', label: 'German (Germany)' },
      { value: 'es', label: 'Spanish (any)' },
      { value: 'es-ES', label: 'Spanish (Spain)' },
      { value: 'es-MX', label: 'Spanish (Mexico)' },
      { value: 'ja', label: 'Japanese' },
      { value: 'ko', label: 'Korean' },
      { value: 'zh', label: 'Chinese (any)' },
      { value: 'zh-CN', label: 'Chinese (Simplified)' },
      { value: 'zh-TW', label: 'Chinese (Traditional)' }
    ]
  },
  {
    type: 'region',
    label: 'Country',
    description: 'Target users based on their country/location',
    operators: ['equals', 'not_equals', 'in', 'not_in'],
    valueType: 'select',
    options: [
      { value: 'US', label: 'United States' },
      { value: 'CA', label: 'Canada' },
      { value: 'GB', label: 'United Kingdom' },
      { value: 'DE', label: 'Germany' },
      { value: 'FR', label: 'France' },
      { value: 'JP', label: 'Japan' },
      { value: 'AU', label: 'Australia' }
    ]
  },
  {
    type: 'cohort',
    label: 'User Cohort',
    description: 'Target users based on cohort membership',
    operators: ['is_in_cohort', 'is_not_in_cohort'],
    valueType: 'cohort'
  },
  {
    type: 'custom_attribute',
    label: 'Custom Attribute',
    description: 'Target users based on custom attributes defined in your app',
    operators: ['custom'],
    valueType: 'text',
    placeholder: 'Enter custom attribute name'
  }
];

/**
 * Human-readable labels for condition operators
 *
 * Maps operator keys to user-friendly labels displayed in the condition builder UI.
 * Includes both standard operators and SDK-specific aliases.
 */
export const operatorLabels: Record<string, string> = {
  'equals': 'equals',
  'not_equals': 'does not equal',
  'does_not_equal': 'does not equal', // SDK spec alias
  'contains': 'contains',
  'not_contains': 'does not contain',
  'starts_with': 'starts with',
  'ends_with': 'ends with',
  'in': 'is one of',
  'not_in': 'is not one of',
  'greater_than': 'is greater than',
  'less_than': 'is less than',
  'greater_than_or_equal': 'is greater than or equal to',
  'less_than_or_equal': 'is less than or equal to',
  'between': 'is between',
  'regex_match': 'matches regex',
  'is_in_cohort': 'is in cohort',
  'is_not_in_cohort': 'is not in cohort',
  'custom': 'custom evaluation'
};

// Cohorts are now loaded dynamically from the API in ConditionBuilder