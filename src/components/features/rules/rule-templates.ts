import { ConditionTemplate } from '@/types/rules';

export const conditionTemplates: ConditionTemplate[] = [
  {
    type: 'app_version',
    label: 'App Version',
    description: 'Target users based on their app version',
    operators: ['equals', 'not_equals', 'greater_than', 'less_than', 'greater_than_or_equal', 'less_than_or_equal', 'in', 'not_in'],
    valueType: 'text',
    placeholder: '1.0.0, 1.2.0'
  },
  {
    type: 'os_version',
    label: 'OS Version', 
    description: 'Target users based on their operating system version',
    operators: ['equals', 'not_equals', 'greater_than', 'less_than', 'greater_than_or_equal', 'less_than_or_equal', 'in', 'not_in'],
    valueType: 'text',
    placeholder: '18.0, 17.5, 14.0'
  },
  {
    type: 'platform',
    label: 'Platform',
    description: 'Target users based on their platform/device',
    operators: ['equals', 'not_equals', 'in', 'not_in'],
    valueType: 'select',
    options: [
      { value: 'ios', label: 'iOS' },
      { value: 'android', label: 'Android' },
      { value: 'web', label: 'Web' },
      { value: 'desktop', label: 'Desktop' },
      { value: 'mobile', label: 'Mobile' }
    ]
  },
  {
    type: 'country',
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
  }
];

export const operatorLabels: Record<string, string> = {
  'equals': 'equals',
  'not_equals': 'does not equal',
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
  'regex_match': 'matches regex',
  'is_in_cohort': 'is in cohort',
  'is_not_in_cohort': 'is not in cohort'
};

// Cohorts are now loaded dynamically from the API in ConditionBuilder