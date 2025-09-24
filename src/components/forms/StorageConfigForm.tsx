"use client";

import React from 'react';
import {
  Stack,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Typography,
} from '@mui/material';

export type StorageProviderType = "minio" | "aws" | "r2" | "b2" | "custom";

export interface StorageConfig {
  bucket: string;
  region: string;
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export interface StorageConfigData {
  storageType: StorageProviderType;
  storageConfig: StorageConfig;
}

interface StorageConfigFormProps {
  value: StorageConfigData;
  onChange: (value: StorageConfigData) => void;
  disabled?: boolean;
  showTypeSelector?: boolean;
}

const STORAGE_PROVIDER_OPTIONS = [
  { value: "minio", label: "MinIO (Local Development)" },
  { value: "aws", label: "AWS S3" },
  { value: "r2", label: "Cloudflare R2" },
  { value: "b2", label: "Backblaze B2" },
  { value: "custom", label: "Custom S3-Compatible" },
] as const;

const DEFAULT_CONFIGS: Record<StorageProviderType, StorageConfig> = {
  minio: {
    bucket: "bunting-configs",
    region: "us-east-1",
    endpoint: "http://localhost:9000",
    accessKeyId: "admin",
    secretAccessKey: "admin123",
  },
  aws: {
    bucket: "",
    region: "us-east-1",
    endpoint: "",
    accessKeyId: "",
    secretAccessKey: "",
  },
  r2: {
    bucket: "",
    region: "",
    endpoint: "",
    accessKeyId: "",
    secretAccessKey: "",
  },
  b2: {
    bucket: "",
    region: "",
    endpoint: "",
    accessKeyId: "",
    secretAccessKey: "",
  },
  custom: {
    bucket: "",
    region: "",
    endpoint: "",
    accessKeyId: "",
    secretAccessKey: "",
  },
};

export function StorageConfigForm({
  value,
  onChange,
  disabled = false,
  showTypeSelector = true,
}: StorageConfigFormProps) {
  const handleStorageTypeChange = (newType: StorageProviderType) => {
    const defaultConfig = DEFAULT_CONFIGS[newType];
    onChange({
      storageType: newType,
      storageConfig: defaultConfig,
    });
  };

  const handleConfigChange = (field: keyof StorageConfig, fieldValue: string) => {
    onChange({
      ...value,
      storageConfig: {
        ...value.storageConfig,
        [field]: fieldValue,
      },
    });
  };

  const getFieldHelperText = (field: keyof StorageConfig): string => {
    switch (field) {
      case 'bucket':
        if (value.storageType === "minio") {
          return "MinIO bucket name (default: bunting-configs)";
        }
        if (value.storageType === "b2") {
          return "Backblaze B2 bucket name";
        }
        return "S3 bucket name for storing config artifacts";

      case 'region':
        if (value.storageType === "aws") {
          return "AWS region (e.g., us-east-1)";
        }
        if (value.storageType === "r2") {
          return "Cloudflare account ID";
        }
        if (value.storageType === "b2") {
          return "Not used for Backblaze B2";
        }
        return "Storage region";

      case 'endpoint':
        if (value.storageType === "minio") {
          return "MinIO endpoint (default: http://localhost:9000)";
        }
        if (value.storageType === "b2") {
          return "Backblaze B2 endpoint URL";
        }
        return "Full endpoint URL (e.g., http://localhost:9000)";

      case 'accessKeyId':
        if (value.storageType === "aws") {
          return "Leave empty to use environment variables or IAM roles";
        }
        if (value.storageType === "minio") {
          return "MinIO access key (default: admin)";
        }
        return "Access key ID for authentication";

      case 'secretAccessKey':
        if (value.storageType === "aws") {
          return "Leave empty to use environment variables or IAM roles";
        }
        if (value.storageType === "minio") {
          return "MinIO secret key (default: admin123)";
        }
        return "Secret access key for authentication";

      default:
        return "";
    }
  };

  const shouldShowField = (field: keyof StorageConfig): boolean => {
    switch (field) {
      case 'region':
        return value.storageType !== "b2";
      case 'endpoint':
        return ["minio", "custom", "b2"].includes(value.storageType);
      default:
        return true;
    }
  };

  const isFieldRequired = (field: keyof StorageConfig): boolean => {
    switch (field) {
      case 'bucket':
      case 'region':
        return true;
      case 'endpoint':
        return value.storageType !== "minio";
      case 'accessKeyId':
      case 'secretAccessKey':
        return value.storageType !== "aws";
      default:
        return false;
    }
  };

  return (
    <Stack spacing={3}>
      {showTypeSelector && (
        <>
          <Typography variant="subtitle1">Storage Configuration</Typography>

          <FormControl fullWidth>
            <InputLabel>Storage Provider</InputLabel>
            <Select
              value={value.storageType}
              onChange={(e) => handleStorageTypeChange(e.target.value as StorageProviderType)}
              label="Storage Provider"
              disabled={disabled}
            >
              {STORAGE_PROVIDER_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {value.storageType === "minio" && (
            <Alert severity="info">
              Using MinIO running on localhost:9000 with default admin credentials.
            </Alert>
          )}
        </>
      )}

      <TextField
        label={value.storageType === "b2" ? "Bucket Name" : "S3 Bucket"}
        value={value.storageConfig.bucket}
        onChange={(e) => handleConfigChange('bucket', e.target.value)}
        fullWidth
        required={isFieldRequired('bucket')}
        disabled={disabled}
        helperText={getFieldHelperText('bucket')}
      />

      {shouldShowField('region') && (
        <TextField
          label="Region"
          value={value.storageConfig.region}
          onChange={(e) => handleConfigChange('region', e.target.value)}
          fullWidth
          required={isFieldRequired('region')}
          disabled={disabled}
          helperText={getFieldHelperText('region')}
        />
      )}

      {shouldShowField('endpoint') && (
        <TextField
          label="Endpoint"
          value={value.storageConfig.endpoint}
          onChange={(e) => handleConfigChange('endpoint', e.target.value)}
          fullWidth
          required={isFieldRequired('endpoint')}
          disabled={disabled}
          helperText={getFieldHelperText('endpoint')}
        />
      )}

      <TextField
        label="Access Key ID"
        value={value.storageConfig.accessKeyId}
        onChange={(e) => handleConfigChange('accessKeyId', e.target.value)}
        fullWidth
        required={isFieldRequired('accessKeyId')}
        disabled={disabled}
        helperText={getFieldHelperText('accessKeyId')}
      />

      <TextField
        label="Secret Access Key"
        type="password"
        value={value.storageConfig.secretAccessKey}
        onChange={(e) => handleConfigChange('secretAccessKey', e.target.value)}
        fullWidth
        required={isFieldRequired('secretAccessKey')}
        disabled={disabled}
        helperText={getFieldHelperText('secretAccessKey')}
      />
    </Stack>
  );
}

// Utility functions for generating artifact URLs
export function generateArtifactUrl(
  type: StorageProviderType,
  storageConfig: StorageConfig,
  appIdentifier: string,
): string {
  if (!appIdentifier) return "";

  switch (type) {
    case "minio": {
      const endpoint = storageConfig.endpoint || "http://localhost:9000";
      return `${endpoint}/${storageConfig.bucket}/${appIdentifier}/`;
    }

    case "aws": {
      return `https://${storageConfig.bucket}.s3.${storageConfig.region}.amazonaws.com/${appIdentifier}/`;
    }

    case "r2": {
      if (storageConfig.bucket && storageConfig.region) {
        return `https://${storageConfig.bucket}.${storageConfig.region}.r2.cloudflarestorage.com/${appIdentifier}/`;
      }
      return "";
    }

    case "b2": {
      if (storageConfig.endpoint && storageConfig.bucket) {
        return `${storageConfig.endpoint}/file/${storageConfig.bucket}/${appIdentifier}/`;
      }
      return "";
    }

    case "custom": {
      if (storageConfig.endpoint && storageConfig.bucket) {
        return `${storageConfig.endpoint}/${storageConfig.bucket}/${appIdentifier}/`;
      }
      return "";
    }

    default:
      return "";
  }
}

// Helper to detect storage type from endpoint
export function detectStorageType(endpoint: string | undefined): StorageProviderType {
  if (!endpoint) return "aws";
  if (endpoint.includes('localhost') || endpoint.includes('127.0.0.1')) return "minio";
  if (endpoint.includes('amazonaws.com')) return "aws";
  if (endpoint.includes('r2.cloudflarestorage.com')) return "r2";
  if (endpoint.includes('backblazeb2.com')) return "b2";
  return "custom";
}