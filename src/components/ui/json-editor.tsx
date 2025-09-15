"use client";

import { useState } from "react";
import {
  Box,
  TextField,
  Paper,
  Typography,
  IconButton,
  Collapse,
} from "@mui/material";
import {
  ExpandMore,
  ExpandLess,
  CheckCircle,
  Error as ErrorIcon,
} from "@mui/icons-material";

interface JSONEditorProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  rows?: number;
  error?: string;
  helperText?: string;
  fullWidth?: boolean;
  disabled?: boolean;
}

export default function JSONEditor({
  value,
  onChange,
  label = "JSON Value",
  placeholder = '{\n  "key": "value"\n}',
  rows = 6,
  error,
  helperText = "Enter valid JSON",
  fullWidth = true,
  disabled = false,
}: JSONEditorProps) {
  const [expanded, setExpanded] = useState(false);
  const [jsonError, setJsonError] = useState<string | null>(null);

  const validateJSON = (jsonString: string): string | null => {
    try {
      JSON.parse(jsonString);
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : "Invalid JSON";
    }
  };

  const getJSONSummary = (jsonString: string): string => {
    try {
      const parsed = JSON.parse(jsonString);
      if (typeof parsed === "object" && parsed !== null) {
        const keys = Object.keys(parsed);
        if (keys.length === 0) return "{}";
        if (keys.length === 1) return `{ ${keys[0]}: ... }`;
        return `{ ${keys[0]}, ${keys[1]}${keys.length > 2 ? ", ..." : ""} }`;
      }
      return jsonString.length > 30
        ? jsonString.substring(0, 30) + "..."
        : jsonString;
    } catch {
      return jsonString.length > 30
        ? jsonString.substring(0, 30) + "..."
        : jsonString;
    }
  };

  const handleChange = (newValue: string) => {
    onChange(newValue);
    const validationError = validateJSON(newValue);
    setJsonError(validationError);
  };

  const hasError = Boolean(error || jsonError);
  const displayError = error || jsonError;

  return (
    <Box>
      <Paper
        variant="outlined"
        sx={{
          p: 1,
          cursor: disabled ? "default" : "pointer",
          "&:hover": disabled ? {} : { bgcolor: "grey.50" },
          borderColor: hasError ? "error.main" : "divider",
        }}
        onClick={disabled ? undefined : () => setExpanded(!expanded)}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              flexGrow: 1,
            }}
          >
            <Typography variant="body2" color="text.secondary">
              {label}:
            </Typography>
            <Typography
              variant="body2"
              sx={{
                fontFamily: "monospace",
                flexGrow: 1,
                color: hasError ? "error.main" : "text.primary",
              }}
            >
              {getJSONSummary(value)}
            </Typography>
            {hasError ? (
              <ErrorIcon color="error" sx={{ fontSize: 16 }} />
            ) : (
              <CheckCircle color="success" sx={{ fontSize: 16 }} />
            )}
          </Box>
          {!disabled && (
            <IconButton size="small">
              {expanded ? <ExpandLess /> : <ExpandMore />}
            </IconButton>
          )}
        </Box>
      </Paper>

      <Collapse in={expanded}>
        <Box sx={{ mt: 1 }}>
          <TextField
            multiline
            rows={rows}
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={placeholder}
            fullWidth={fullWidth}
            error={hasError}
            helperText={displayError || helperText}
            disabled={disabled}
            InputProps={{
              sx: { fontFamily: "monospace", fontSize: "0.875rem" },
            }}
          />
        </Box>
      </Collapse>
    </Box>
  );
}