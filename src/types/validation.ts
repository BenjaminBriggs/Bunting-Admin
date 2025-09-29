// Validation and error types

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  type: 'schema' | 'reference' | 'type' | 'format';
  field: string;
  message: string;
}

export interface ValidationWarning {
  type: 'unreachable' | 'deprecated' | 'performance';
  field: string;
  message: string;
}