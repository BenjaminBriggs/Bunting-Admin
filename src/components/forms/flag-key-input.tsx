'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { validateIdentifierKey, normalizeToIdentifierKey, generateDisplayName } from '@/lib/validation';
import { AlertCircle, Check } from 'lucide-react';

interface FlagKeyInputProps {
  value: string;
  onChange: (value: string, normalizedKey: string, displayName: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function FlagKeyInput({ 
  value, 
  onChange, 
  placeholder = "e.g., Store: Use New Paywall Design",
  disabled = false 
}: FlagKeyInputProps) {
  const [inputValue, setInputValue] = useState(value);
  const [normalizedKey, setNormalizedKey] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [validation, setValidation] = useState<{ valid: boolean; error?: string }>({ valid: true });
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (inputValue) {
      const normalized = normalizeToIdentifierKey(inputValue);
      const display = generateDisplayName(normalized);
      const validationResult = validateIdentifierKey(normalized);

      setNormalizedKey(normalized);
      setDisplayName(display);
      setValidation(validationResult);
      setShowPreview(true);

      if (validationResult.valid) {
        onChange(inputValue, normalized, display);
      }
    } else {
      setNormalizedKey('');
      setDisplayName('');
      setValidation({ valid: true });
      setShowPreview(false);
      onChange('', '', '');
    }
  }, [inputValue, onChange]);

  return (
    <div className="space-y-3">
      <div>
        <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
          Flag Name
        </label>
        <div className="relative mt-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            className={validation.valid ? '' : 'border-destructive focus-visible:ring-destructive'}
          />
          {validation.valid && normalizedKey && (
            <Check className="absolute right-3 top-3 h-4 w-4 text-green-500" />
          )}
          {!validation.valid && (
            <AlertCircle className="absolute right-3 top-3 h-4 w-4 text-destructive" />
          )}
        </div>
      </div>

      {/* Key Preview */}
      {showPreview && (
        <div className="space-y-2 p-3 bg-muted rounded-lg">
          <div className="text-sm">
            <span className="text-muted-foreground">Key:</span>
            <code className="ml-2 px-2 py-1 bg-background rounded text-sm">
              {normalizedKey}
            </code>
          </div>
          
          <div className="text-sm">
            <span className="text-muted-foreground">Display Name:</span>
            <span className="ml-2 font-medium">{displayName}</span>
          </div>
          
          <div className="text-sm">
            <span className="text-muted-foreground">Swift Accessor:</span>
            <code className="ml-2 px-2 py-1 bg-background rounded text-sm">
              Bunting.shared.{normalizedKey.replace(/\//g, '.').replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())}
            </code>
          </div>
        </div>
      )}

      {/* Validation Error */}
      {!validation.valid && validation.error && (
        <div className="flex items-center space-x-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          <span>{validation.error}</span>
        </div>
      )}

      {/* Help Text */}
      <p className="text-sm text-muted-foreground">
        Enter a natural name - it will be converted to a JSON Spec compliant key.
        Keys must contain only lowercase letters and underscores, max 64 characters.
      </p>
    </div>
  );
}