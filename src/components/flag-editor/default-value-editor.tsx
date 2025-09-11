'use client';

import { useState } from 'react';
import { FlagType, FlagValue } from '@/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface DefaultValueEditorProps {
  type: FlagType;
  value: FlagValue;
  onChange: (value: FlagValue) => void;
  disabled?: boolean;
}

export function DefaultValueEditor({ type, value, onChange, disabled = false }: DefaultValueEditorProps) {
  const [jsonError, setJsonError] = useState<string | null>(null);

  const handleBoolChange = (newValue: boolean) => {
    onChange(newValue);
  };

  const handleStringChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    if (inputValue === '') {
      onChange(type === 'int' ? 0 : 0.0);
      return;
    }
    
    const numValue = type === 'int' ? parseInt(inputValue, 10) : parseFloat(inputValue);
    if (!isNaN(numValue)) {
      onChange(numValue);
    }
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    if (inputValue) {
      // Convert HTML datetime-local to ISO8601
      const isoValue = new Date(inputValue).toISOString();
      onChange(isoValue);
    }
  };

  const handleJsonChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const inputValue = e.target.value;
    setJsonError(null);
    
    if (!inputValue.trim()) {
      onChange({});
      return;
    }
    
    try {
      const parsed = JSON.parse(inputValue);
      onChange(parsed);
    } catch (error) {
      setJsonError('Invalid JSON syntax');
    }
  };

  const formatDateForInput = (isoString: string): string => {
    return isoString.slice(0, 16); // Remove seconds and timezone for datetime-local input
  };

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium leading-none">
        Default Value
      </label>
      
      {type === 'bool' && (
        <div className="flex space-x-4">
          <Button
            type="button"
            variant={value === true ? 'default' : 'outline'}
            onClick={() => handleBoolChange(true)}
            disabled={disabled}
            className={cn(value === true && 'ring-2 ring-ring ring-offset-2')}
          >
            True
          </Button>
          <Button
            type="button"
            variant={value === false ? 'default' : 'outline'}
            onClick={() => handleBoolChange(false)}
            disabled={disabled}
            className={cn(value === false && 'ring-2 ring-ring ring-offset-2')}
          >
            False
          </Button>
        </div>
      )}
      
      {type === 'string' && (
        <Input
          type="text"
          value={value as string}
          onChange={handleStringChange}
          placeholder="Enter default string value"
          disabled={disabled}
        />
      )}
      
      {(type === 'int' || type === 'double') && (
        <Input
          type="number"
          value={value as number}
          onChange={handleNumberChange}
          placeholder={type === 'int' ? 'Enter default integer' : 'Enter default number'}
          step={type === 'double' ? 'any' : '1'}
          disabled={disabled}
        />
      )}
      
      {type === 'date' && (
        <Input
          type="datetime-local"
          value={typeof value === 'string' ? formatDateForInput(value) : ''}
          onChange={handleDateChange}
          disabled={disabled}
        />
      )}
      
      {type === 'json' && (
        <div className="space-y-2">
          <textarea
            className={cn(
              "flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-mono",
              jsonError && 'border-destructive focus-visible:ring-destructive'
            )}
            value={JSON.stringify(value, null, 2)}
            onChange={handleJsonChange}
            placeholder='{"key": "value"}'
            disabled={disabled}
          />
          {jsonError && (
            <p className="text-sm text-destructive">{jsonError}</p>
          )}
        </div>
      )}
      
      <p className="text-sm text-muted-foreground">
        This value will be returned when no rules match or when rules cannot be evaluated.
      </p>
    </div>
  );
}