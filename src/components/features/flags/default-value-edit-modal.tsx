"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Paper,
  Collapse,
  IconButton,
  CircularProgress,
} from "@mui/material";
import { Save, ExpandMore, ExpandLess, CheckCircle, Error as ErrorIcon } from "@mui/icons-material";
import { Environment } from "@/types";
import { updateFlag } from "@/lib/api";
import FlagValueInput, { getDefaultValueForType as getBaseDefaultValue, processValueForType, validateValue } from "./flag-value-input";

interface DefaultValueEditModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (newValue: any) => void;
  environment: Environment;
  flagId: string;
  flagType: string;
  currentValue: any;
  flagName: string;
  allDefaultValues: Record<string, any>; // Full defaultValues object for all environments
}

const getEnvironmentColor = (env: Environment) => {
  switch (env) {
    case 'development': return 'info';
    case 'staging': return 'warning'; 
    case 'production': return 'success';
    default: return 'default';
  }
};


export default function DefaultValueEditModal({
  open,
  onClose,
  onSave,
  environment,
  flagId,
  flagType,
  currentValue,
  flagName,
  allDefaultValues,
}: DefaultValueEditModalProps) {
  const [value, setValue] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setValue(currentValue !== undefined && currentValue !== null ? currentValue : getBaseDefaultValue(flagType as any));
      setSaveError(null);
    }
  }, [open, flagType, currentValue]);


  const handleSave = async () => {
    if (!isValid()) return;

    setSaving(true);
    setSaveError(null);

    try {
      const processedValue = processValueForType(value, flagType as any);

      // Preserve all environment values, only update the current one
      const updatedDefaultValues = {
        ...allDefaultValues,
        [environment]: processedValue
      };

      // Update the flag with the new default value for this environment
      await updateFlag(flagId, {
        defaultValues: updatedDefaultValues as any
      });

      onSave(processedValue);
      onClose();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to update default value');
    } finally {
      setSaving(false);
    }
  };

  const isValid = () => {
    return validateValue(value, flagType as any).isValid;
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Edit Default Value - {environment.charAt(0).toUpperCase() + environment.slice(1)}
      </DialogTitle>
      
      <DialogContent>
        <Box sx={{ mt: 1 }}>
          <Alert severity="info" sx={{ mb: 3 }}>
            Editing the default value for <strong>{flagName}</strong> in the{" "}
            <strong>{environment}</strong> environment. This value will be returned when no targeting rules match.
          </Alert>

          {saveError && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {saveError}
            </Alert>
          )}

          {/* Value Editor */}
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 2 }}>
              Default Value ({flagType})
            </Typography>

            <FlagValueInput
              flagType={flagType as any}
              value={value}
              onChange={setValue}
              label="Default Value"
              helperText="Value returned when no targeting rules match"
              fullWidth
              required
            />
          </Box>

          {/* Preview */}
          <Box sx={{ mt: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Preview
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              How this value will appear in your configuration:
            </Typography>
            <Box
              component="pre"
              sx={{
                fontFamily: 'monospace',
                fontSize: '0.75rem',
                bgcolor: 'white',
                p: 1.5,
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'divider',
                overflow: 'auto',
                whiteSpace: 'pre-wrap'
              }}
            >
              {JSON.stringify({
                [environment]: {
                  default: (() => {
                    try {
                      return processValueForType(value, flagType as any);
                    } catch {
                      return value;
                    }
                  })()
                }
              }, null, 2)}
            </Box>
          </Box>
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button 
          onClick={handleSave} 
          variant="contained" 
          disabled={!isValid() || saving}
          startIcon={saving ? <CircularProgress size={20} /> : <Save />}
        >
          {saving ? 'Saving...' : 'Save Default Value'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}