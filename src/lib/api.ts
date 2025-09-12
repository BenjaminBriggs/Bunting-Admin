// API utility functions for making requests to our backend

import { ConfigArtifact } from '@/lib/config-generator';

export interface StorageConfig {
  bucket: string;
  region: string;
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
}

export interface App {
  id: string;
  name: string;
  identifier: string;
  artifactUrl: string;
  publicKeys: Array<{ kid: string; pem: string }>;
  fetchPolicy: { min_interval_seconds: number; hard_ttl_days: number };
  storageConfig: StorageConfig;
  createdAt: string;
  updatedAt: string;
  _count?: {
    flags: number;
    cohorts: number;
  };
}

export interface Flag {
  id: string;
  key: string;
  displayName: string;
  type: 'BOOL' | 'STRING' | 'INT' | 'DOUBLE' | 'DATE' | 'JSON';
  defaultValue: any;
  rules: any[];
  description?: string;
  archived: boolean;
  archivedAt?: string;
  createdAt: string;
  updatedAt: string;
  appId: string;
  app?: {
    name: string;
    identifier: string;
  };
}

export interface Cohort {
  id: string;
  key: string;
  name: string;
  salt: string;
  percentage: number;
  description?: string;
  createdAt: string;
  updatedAt: string;
  appId: string;
  app?: {
    name: string;
    identifier: string;
  };
}

// Apps API
export async function fetchApps(): Promise<App[]> {
  const response = await fetch('/api/apps');
  if (!response.ok) {
    throw new Error('Failed to fetch apps');
  }
  return response.json();
}

export async function createApp(data: Omit<App, 'id' | 'createdAt' | 'updatedAt'>): Promise<App> {
  const response = await fetch('/api/apps', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create app');
  }
  return response.json();
}

export async function updateApp(id: string, data: Partial<Omit<App, 'id' | 'createdAt' | 'updatedAt'>>): Promise<App> {
  const response = await fetch(`/api/apps/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update app');
  }
  return response.json();
}

export async function deleteApp(id: string): Promise<void> {
  const response = await fetch(`/api/apps/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete app');
  }
}

// Flags API
export async function fetchFlags(appId: string): Promise<Flag[]> {
  const response = await fetch(`/api/flags?appId=${appId}`);
  if (!response.ok) {
    throw new Error('Failed to fetch flags');
  }
  return response.json();
}

export async function fetchFlag(id: string): Promise<Flag> {
  const response = await fetch(`/api/flags/${id}`);
  if (!response.ok) {
    throw new Error('Failed to fetch flag');
  }
  return response.json();
}

export async function createFlag(data: {
  appId: string;
  key: string;
  displayName: string;
  type: string;
  defaultValue: any;
  rules?: any[];
  description?: string;
}): Promise<Flag> {
  const response = await fetch('/api/flags', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create flag');
  }
  return response.json();
}

export async function updateFlag(id: string, data: Partial<Flag>): Promise<Flag> {
  const response = await fetch(`/api/flags/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update flag');
  }
  return response.json();
}

export async function deleteFlag(id: string): Promise<void> {
  const response = await fetch(`/api/flags/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to delete flag');
  }
}

// Cohorts API
export async function fetchCohorts(appId: string): Promise<Cohort[]> {
  const response = await fetch(`/api/cohorts?appId=${appId}`);
  if (!response.ok) {
    throw new Error('Failed to fetch cohorts');
  }
  return response.json();
}

export async function createCohort(data: {
  appId: string;
  key: string;
  name: string;
  percentage: number;
  description?: string;
}): Promise<Cohort> {
  const response = await fetch('/api/cohorts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create cohort');
  }
  return response.json();
}

export async function fetchCohort(id: string): Promise<Cohort> {
  const response = await fetch(`/api/cohorts/${id}`);
  if (!response.ok) {
    throw new Error('Failed to fetch cohort');
  }
  return response.json();
}

export async function updateCohort(id: string, data: Partial<Cohort>): Promise<Cohort> {
  const response = await fetch(`/api/cohorts/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update cohort');
  }
  return response.json();
}

export async function deleteCohort(id: string): Promise<void> {
  const response = await fetch(`/api/cohorts/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to delete cohort');
  }
}

// Config API
export async function generateCurrentConfig(appId: string): Promise<ConfigArtifact> {
  const response = await fetch('/api/config/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ appId }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to generate current config');
  }
  return response.json();
}

export async function getPublishedConfig(appIdentifier: string): Promise<{ config: any | null; lastModified?: Date; etag?: string }> {
  const response = await fetch('/api/config/published', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ appIdentifier }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch published config');
  }
  return response.json();
}

// Validation API
export interface ValidationResult {
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  type: string;
  message: string;
  flagKey?: string;
  cohortKey?: string;
}

export interface ValidationWarning {
  type: string;
  message: string;
  flagKey?: string;
  cohortKey?: string;
}

export async function validateConfig(appId: string): Promise<ValidationResult> {
  const response = await fetch('/api/config/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ appId }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to validate configuration');
  }
  return response.json();
}

// Publish API
export async function publishConfig(appId: string, changelog: string): Promise<{ version: string; publishedAt: string; message: string }> {
  const response = await fetch('/api/config/publish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ appId, changelog }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to publish configuration');
  }
  return response.json();
}

// Publish History API
export interface PublishHistoryItem {
  id: string;
  version: string;
  publishedAt: string;
  publishedBy: string;
  changelog: string;
  flagCount: number;
  cohortCount: number;
  changes?: Array<{
    type: 'flag' | 'cohort';
    action: 'added' | 'modified' | 'removed';
    key: string;
    name: string;
  }>;
}

export async function getPublishHistory(appId: string, limit: number = 10): Promise<PublishHistoryItem[]> {
  const response = await fetch('/api/config/history', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ appId, limit }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch publish history');
  }
  return response.json();
}

export async function downloadConfig(appIdentifier: string): Promise<void> {
  const response = await fetch('/api/config/download', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ appIdentifier }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to download configuration');
  }
  
  // Get the filename from the response headers
  const contentDisposition = response.headers.get('Content-Disposition');
  const filename = contentDisposition 
    ? contentDisposition.split('filename="')[1]?.replace('"', '') || 'config.json'
    : 'config.json';
  
  // Create blob and download
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}