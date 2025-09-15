'use client';

import { FlagType } from '@/types';
// import { Button } from '@/components/ui/button'; // TODO: Fix this import
import { cn } from '@/lib/utils';

interface FlagTypeSelectorProps {
  value: FlagType;
  onChange: (type: FlagType) => void;
  disabled?: boolean;
}

const flagTypes: { value: FlagType; label: string; description: string; example: string }[] = [
  {
    value: 'bool',
    label: 'Boolean',
    description: 'True/false values',
    example: 'true'
  },
  {
    value: 'string',
    label: 'String',
    description: 'Text values',
    example: '"Welcome!"'
  },
  {
    value: 'int',
    label: 'Integer',
    description: 'Whole numbers',
    example: '42'
  },
  {
    value: 'double',
    label: 'Number',
    description: 'Decimal numbers',
    example: '3.14'
  },
  {
    value: 'date',
    label: 'Date',
    description: 'ISO8601 timestamps',
    example: '2025-09-11T15:30:00Z'
  },
  {
    value: 'json',
    label: 'JSON',
    description: 'Complex objects',
    example: '{"key": "value"}'
  }
];

export function FlagTypeSelector({ value, onChange, disabled = false }: FlagTypeSelectorProps) {
  return (
    <div className="space-y-3">
      <label className="text-sm font-medium leading-none">
        Flag Type
      </label>
      
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {flagTypes.map((type) => (
          <Button
            key={type.value}
            variant={value === type.value ? 'default' : 'outline'}
            className={cn(
              'h-auto p-4 flex flex-col items-start space-y-2',
              value === type.value && 'ring-2 ring-ring ring-offset-2'
            )}
            onClick={() => onChange(type.value)}
            disabled={disabled}
          >
            <div className="font-medium text-left">{type.label}</div>
            <div className="text-xs text-muted-foreground text-left">
              {type.description}
            </div>
            <code className="text-xs bg-muted px-2 py-1 rounded">
              {type.example}
            </code>
          </Button>
        ))}
      </div>
      
      <p className="text-sm text-muted-foreground">
        Choose the data type for your flag values. This affects how values are validated and displayed.
      </p>
    </div>
  );
}