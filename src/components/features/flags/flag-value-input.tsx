"use client";

import { useState, useEffect } from "react";
import {
  TextField,
  FormControl,
  Select,
  MenuItem,
  InputLabel,
  FormHelperText,
  Box,
  IconButton,
  Typography,
  Paper,
  Collapse,
} from "@mui/material";
import {
  CheckCircle,
  Error as ErrorIcon,
  ExpandMore,
  ExpandLess,
} from "@mui/icons-material";

export type FlagType = 'bool' | 'string' | 'int' | 'double' | 'date' | 'json' | 'BOOL' | 'STRING' | 'INT' | 'DOUBLE' | 'DATE' | 'JSON';

interface FlagValueInputProps {
  flagType: FlagType;
  value: any;
  onChange: (value: any) => void;
  label?: string;
  placeholder?: string;
  error?: boolean;
  helperText?: string;
  disabled?: boolean;
  required?: boolean;
  size?: 'small' | 'medium';
  fullWidth?: boolean;
  autoFocus?: boolean;
  onKeyDown?: (event: React.KeyboardEvent) => void;
}

export function getDefaultValueForType(flagType: FlagType): any {
  const normalizedType = flagType.toLowerCase() as FlagType;
  switch (normalizedType) {
    case 'bool': return false;
    case 'string': return '';
    case 'int': return 0;
    case 'double': return 0.0;
    case 'date': return new Date().toISOString().split('T')[0];
    case 'json': return '{}';
    default: return '';
  }
}

export function processValueForType(value: any, flagType: FlagType): any {
  const normalizedType = flagType.toLowerCase() as FlagType;
  switch (normalizedType) {
    case 'bool': 
      return value === 'true' || value === true;
    case 'int': 
      return parseInt(value) || 0;
    case 'double': 
      return parseFloat(value) || 0.0;
    case 'json': 
      try {
        return typeof value === 'string' ? JSON.parse(value) : value;
      } catch {
        return {};
      }
    case 'string':
    case 'date':
    default: 
      return value;
  }
}

export function formatValueForDisplay(value: any, flagType: FlagType): string {
  if (value === null || value === undefined) {
    return 'undefined';
  }
  
  const normalizedType = flagType.toLowerCase() as FlagType;
  switch (normalizedType) {
    case 'bool':
      return String(Boolean(value));
    case 'json':
      return typeof value === 'object' ? JSON.stringify(value) : String(value);
    case 'string':
    case 'date':
      return String(value);
    case 'int':
    case 'double':
      return String(Number(value));
    default:
      return String(value);
  }
}

export function getJSONSummary(jsonString: string): string {
  try {
    const parsed = JSON.parse(jsonString);
    if (typeof parsed === "object" && parsed !== null) {
      const keys = Object.keys(parsed);
      if (keys.length === 0) return "{}";
      if (keys.length === 1) return `{ ${keys[0]}: ... }`;
      return `{ ${keys[0]}, ${keys[1]}${keys.length > 2 ? ", ..." : ""} }`;
    }
    return jsonString.length > 30 ? jsonString.substring(0, 30) + "..." : jsonString;
  } catch {
    return jsonString.length > 30 ? jsonString.substring(0, 30) + "..." : jsonString;
  }
}

export function validateValue(value: any, flagType: FlagType): { isValid: boolean; error?: string } {
  const normalizedType = flagType.toLowerCase() as FlagType;
  switch (normalizedType) {
    case 'json':
      try {
        if (typeof value === 'string' && value.trim()) {
          JSON.parse(value);
        }
        return { isValid: true };
      } catch {
        return { isValid: false, error: 'Invalid JSON format' };
      }
    case 'int':
      if (value === '' || value === null || value === undefined) {
        return { isValid: true };
      }
      const intValue = parseInt(value);
      if (isNaN(intValue)) {
        return { isValid: false, error: 'Must be a valid integer' };
      }
      return { isValid: true };
    case 'double':
      if (value === '' || value === null || value === undefined) {
        return { isValid: true };
      }
      const floatValue = parseFloat(value);
      if (isNaN(floatValue)) {
        return { isValid: false, error: 'Must be a valid number' };
      }
      return { isValid: true };
    default:
      return { isValid: true };
  }
}

export default function FlagValueInput({
  flagType,
  value,
  onChange,
  label,
  placeholder,
  error,
  helperText,
  disabled = false,
  required = false,
  size = 'small',
  fullWidth = true,
  autoFocus = false,
  onKeyDown,
}: FlagValueInputProps) {
  const [jsonExpanded, setJsonExpanded] = useState(false);
  const [stringValue, setStringValue] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);

  useEffect(() => {
    // Convert value to string representation for editing
    if (flagType === "json") {
      setStringValue(typeof value === "object" ? JSON.stringify(value, null, 2) : String(value));
    } else {
      setStringValue(String(value));
    }
  }, [value, flagType]);

  const validation = validateValue(value, flagType);
  const isError = error || !validation.isValid;
  const displayHelperText = helperText || validation.error;

  // Normalize flag type to lowercase for consistency
  const normalizedFlagType = flagType.toLowerCase() as FlagType;

  // Boolean input
  if (normalizedFlagType === 'bool') {
    return (
      <FormControl fullWidth={fullWidth} size={size} error={isError} disabled={disabled}>
        {label && <InputLabel>{label}</InputLabel>}
        <Select
          value={value?.toString() || 'false'}
          onChange={(e) => onChange(e.target.value === 'true')}
          label={label}
          autoFocus={autoFocus}
        >
          <MenuItem value="false">false</MenuItem>
          <MenuItem value="true">true</MenuItem>
        </Select>
        {displayHelperText && (
          <FormHelperText>{displayHelperText}</FormHelperText>
        )}
      </FormControl>
    );
  }

  // JSON input with collapsible UI
  if (normalizedFlagType === 'json') {
    const handleJSONChange = (newValue: string) => {
      setStringValue(newValue);
      const jsonErr = validateValue(newValue, 'json');
      setJsonError(jsonErr.isValid ? null : jsonErr.error || 'Invalid JSON');
      
      if (jsonErr.isValid) {
        try {
          const parsed = JSON.parse(newValue);
          onChange(parsed);
        } catch {
          // Ignore parsing errors during typing
        }
      }
    };

    return (
      <Box>
        <Paper 
          variant="outlined" 
          sx={{ 
            p: 1, 
            cursor: 'pointer',
            '&:hover': { bgcolor: 'grey.50' }
          }}
          onClick={() => setJsonExpanded(!jsonExpanded)}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexGrow: 1 }}>
              <Typography variant="body2" color="text.secondary">
                {label || 'JSON Value'}:
              </Typography>
              <Typography 
                variant="body2" 
                sx={{ 
                  fontFamily: 'monospace',
                  flexGrow: 1,
                  color: jsonError ? 'error.main' : 'text.primary'
                }}
              >
                {getJSONSummary(stringValue)}
              </Typography>
              {jsonError ? (
                <ErrorIcon color="error" sx={{ fontSize: 16 }} />
              ) : (
                <CheckCircle color="success" sx={{ fontSize: 16 }} />
              )}
            </Box>
            <IconButton size="small">
              {jsonExpanded ? <ExpandLess /> : <ExpandMore />}
            </IconButton>
          </Box>
        </Paper>
        
        <Collapse in={jsonExpanded}>
          <Box sx={{ mt: 1 }}>
            <TextField
              multiline
              rows={6}
              value={stringValue}
              onChange={(e) => handleJSONChange(e.target.value)}
              placeholder={placeholder || '{}'}
              fullWidth={fullWidth}
              error={Boolean(jsonError)}
              helperText={jsonError || displayHelperText || "Enter valid JSON"}
              disabled={disabled}
              autoFocus={autoFocus}
              onKeyDown={onKeyDown}
              InputProps={{
                sx: { fontFamily: 'monospace', fontSize: '0.875rem' }
              }}
            />
          </Box>
        </Collapse>
      </Box>
    );
  }

  // Number inputs
  if (normalizedFlagType === 'int' || normalizedFlagType === 'double') {
    return (
      <TextField
        label={label}
        type="number"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        fullWidth={fullWidth}
        size={size}
        error={isError}
        helperText={displayHelperText}
        disabled={disabled}
        required={required}
        autoFocus={autoFocus}
        onKeyDown={onKeyDown}
        inputProps={{
          step: normalizedFlagType === 'double' ? 'any' : 1
        }}
      />
    );
  }

  // Date input
  if (normalizedFlagType === 'date') {
    return (
      <TextField
        label={label}
        type="date"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        fullWidth={fullWidth}
        size={size}
        error={isError}
        helperText={displayHelperText}
        disabled={disabled}
        required={required}
        autoFocus={autoFocus}
        onKeyDown={onKeyDown}
        InputLabelProps={{
          shrink: true,
        }}
      />
    );
  }

  // String input (default)
  return (
    <TextField
      label={label}
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      fullWidth={fullWidth}
      size={size}
      error={isError}
      helperText={displayHelperText}
      disabled={disabled}
      required={required}
      autoFocus={autoFocus}
      onKeyDown={onKeyDown}
    />
  );
}