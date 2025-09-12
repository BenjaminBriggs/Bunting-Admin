// API utility functions for making requests to our backend

export interface App {
  id: string;
  name: string;
  identifier: string;
  artifactUrl: string;
  publicKeys: Array<{ kid: string; pem: string }>;
  fetchPolicy: { min_interval_seconds: number; hard_ttl_days: number };
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