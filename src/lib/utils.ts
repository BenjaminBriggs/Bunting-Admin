import { type ClassValue, clsx } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

// Flag key normalization according to spec
export function normalizeKey(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\/\s]/g, '') // Remove special chars except / and spaces
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .replace(/_{2,}/g, '_') // Collapse multiple underscores
    .replace(/^_|_$/g, '') // Trim leading/trailing underscores
    .replace(/\/+/g, '/') // Collapse multiple slashes
    .replace(/^\//g, '') // Remove leading slash
    .replace(/\/$/g, ''); // Remove trailing slash
}

// Validate normalized flag key
export function validateKey(key: string): { valid: boolean; error?: string } {
  if (!key) {
    return { valid: false, error: 'Flag key cannot be empty' };
  }

  if (!/^[a-z][a-z0-9_]*(?:\/[a-z][a-z0-9_]*)*$/.test(key)) {
    return { 
      valid: false, 
      error: 'Flag key must start with a letter and contain only lowercase letters, numbers, underscores, and forward slashes for namespacing' 
    };
  }

  // Check for reserved words or patterns
  const segments = key.split('/');
  for (const segment of segments) {
    if (segment.length > 50) {
      return { valid: false, error: 'Flag key segments must be 50 characters or less' };
    }
    if (segment.endsWith('_')) {
      return { valid: false, error: 'Flag key segments cannot end with underscore' };
    }
  }

  return { valid: true };
}

// Generate display name from flag key
export function generateDisplayName(key: string): string {
  return key
    .split('/')
    .map(segment => 
      segment
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
    )
    .join(' / ');
}

// Generate config version in YYYY-MM-DD.N format
export function generateConfigVersion(): string {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
  
  // In a real implementation, this would check existing versions for the day
  // and increment the sequence number
  return `${dateStr}.1`;
}

// Format timestamp for display
export function formatTimestamp(timestamp: string): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(new Date(timestamp));
}