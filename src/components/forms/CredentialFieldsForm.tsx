"use client";

import React from 'react';
import {
  Stack,
  TextField,
  Card,
  CardContent,
  Typography,
  Box,
} from '@mui/material';

export interface FieldConfig {
  name: string;
  label?: string;
  type?: 'text' | 'password' | 'email' | 'url';
  required?: boolean;
  helperText?: string;
  placeholder?: string;
  defaultValue?: string;
}

export interface ProviderConfig {
  id: string;
  name: string;
  icon?: React.ReactNode;
  description?: string;
  fields: FieldConfig[];
}

interface CredentialFieldsFormProps {
  provider: ProviderConfig;
  values: Record<string, string>;
  onChange: (field: string, value: string) => void;
  disabled?: boolean;
  showProviderHeader?: boolean;
  variant?: 'default' | 'compact';
}

// Built-in field configurations with smart defaults
const BUILT_IN_FIELD_CONFIGS: Record<string, Partial<FieldConfig>> = {
  // Google OAuth
  GOOGLE_CLIENT_ID: {
    label: 'Google Client ID',
    type: 'text',
    helperText: 'Get from Google Cloud Console → APIs & Services → Credentials',
  },
  GOOGLE_CLIENT_SECRET: {
    label: 'Google Client Secret',
    type: 'password',
    helperText: 'Get from Google Cloud Console → APIs & Services → Credentials',
  },

  // GitHub OAuth
  GITHUB_CLIENT_ID: {
    label: 'GitHub Client ID',
    type: 'text',
    helperText: 'Get from GitHub Settings → Developer settings → OAuth Apps',
  },
  GITHUB_CLIENT_SECRET: {
    label: 'GitHub Client Secret',
    type: 'password',
    helperText: 'Get from GitHub Settings → Developer settings → OAuth Apps',
  },

  // Microsoft OAuth
  MICROSOFT_CLIENT_ID: {
    label: 'Microsoft Client ID',
    type: 'text',
    helperText: 'Get from Azure Portal → App registrations',
  },
  MICROSOFT_CLIENT_SECRET: {
    label: 'Microsoft Client Secret',
    type: 'password',
    helperText: 'Get from Azure Portal → App registrations',
  },
  MICROSOFT_TENANT_ID: {
    label: 'Microsoft Tenant ID',
    type: 'text',
    helperText: 'Get from Azure Portal → App registrations',
  },

  // Email providers
  RESEND_API_KEY: {
    label: 'Resend API Key',
    type: 'password',
    helperText: 'Get from Resend dashboard → API Keys',
  },
  EMAIL_FROM: {
    label: 'From Email Address',
    type: 'email',
    helperText: 'Email address for sending magic links (e.g., noreply@your-domain.com)',
  },

  // Development credentials
  DEV_ADMIN_EMAIL: {
    label: 'Admin Email',
    type: 'email',
    defaultValue: 'admin@example.com',
    helperText: 'Email address for development admin user',
  },
  DEV_ADMIN_PASSWORD: {
    label: 'Admin Password',
    type: 'password',
    defaultValue: 'admin',
    helperText: 'Password for development admin user',
  },
};

export function CredentialFieldsForm({
  provider,
  values,
  onChange,
  disabled = false,
  showProviderHeader = true,
  variant = 'default',
}: CredentialFieldsFormProps) {

  const getFieldConfig = (fieldName: string): FieldConfig => {
    // Check if there's a built-in configuration
    const builtInConfig = BUILT_IN_FIELD_CONFIGS[fieldName];

    // Find field config from provider
    const providerField = provider.fields.find(f => f.name === fieldName);

    // Merge configurations with priority: provider > built-in > defaults
    return {
      name: fieldName,
      label: fieldName.replace(/_/g, ' '),
      type: 'text',
      required: true,
      ...builtInConfig,
      ...providerField,
    };
  };

  const detectFieldType = (fieldName: string): 'text' | 'password' | 'email' | 'url' => {
    const lowerName = fieldName.toLowerCase();
    if (lowerName.includes('secret') || lowerName.includes('key') || lowerName.includes('password')) {
      return 'password';
    }
    if (lowerName.includes('email')) {
      return 'email';
    }
    if (lowerName.includes('url') || lowerName.includes('endpoint')) {
      return 'url';
    }
    return 'text';
  };

  const getCurrentValue = (fieldName: string, config: FieldConfig): string => {
    // Return current value if set, otherwise return default value
    return values[fieldName] !== undefined
      ? values[fieldName]
      : config.defaultValue || '';
  };

  const renderField = (fieldName: string) => {
    const config = getFieldConfig(fieldName);
    const fieldType = config.type || detectFieldType(fieldName);
    const currentValue = getCurrentValue(fieldName, config);

    return (
      <TextField
        key={fieldName}
        name={config.name}
        label={config.label}
        type={fieldType}
        value={currentValue}
        onChange={(e) => onChange(fieldName, e.target.value)}
        fullWidth
        required={config.required}
        disabled={disabled}
        helperText={config.helperText}
        placeholder={config.placeholder || config.defaultValue}
        size={variant === 'compact' ? 'small' : 'medium'}
      />
    );
  };

  const content = (
    <Stack spacing={variant === 'compact' ? 2 : 3}>
      {showProviderHeader && (
        <Box>
          <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1 }}>
            {provider.icon}
            <Typography variant="h6">{provider.name}</Typography>
          </Stack>
          {provider.description && (
            <Typography variant="body2" color="text.secondary">
              {provider.description}
            </Typography>
          )}
        </Box>
      )}

      <Stack spacing={variant === 'compact' ? 1.5 : 2}>
        {provider.fields.map(field => renderField(field.name))}
      </Stack>
    </Stack>
  );

  if (variant === 'compact' || !showProviderHeader) {
    return content;
  }

  return (
    <Card>
      <CardContent>
        {content}
      </CardContent>
    </Card>
  );
}

// Helper function to create provider configs from simple field arrays
export function createProviderConfig(
  id: string,
  name: string,
  fieldNames: string[],
  options: {
    icon?: React.ReactNode;
    description?: string;
  } = {}
): ProviderConfig {
  return {
    id,
    name,
    icon: options.icon,
    description: options.description,
    fields: fieldNames.map(fieldName => ({
      name: fieldName,
      // Other properties will be filled in by getFieldConfig
    })),
  };
}

// Validation helper
export function validateCredentials(
  provider: ProviderConfig,
  values: Record<string, string>
): { isValid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  provider.fields.forEach(field => {
    const config = BUILT_IN_FIELD_CONFIGS[field.name] || field;
    const value = values[field.name];

    if (config.required && (!value || !value.trim())) {
      errors[field.name] = `${config.label || field.name} is required`;
      return;
    }

    // Type-specific validation
    if (value && config.type === 'email') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        errors[field.name] = 'Please enter a valid email address';
      }
    }

    if (value && config.type === 'url') {
      try {
        new URL(value);
      } catch {
        errors[field.name] = 'Please enter a valid URL';
      }
    }
  });

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}