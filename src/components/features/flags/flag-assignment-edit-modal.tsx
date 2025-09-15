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
  Stack,
  TextField,
  FormControl,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
} from "@mui/material";
import { Save, Science, Rocket } from "@mui/icons-material";
import { Environment, DBTestRollout } from "@/types";
import { fetchTest, fetchRollout, updateTest, updateRollout } from "@/lib/api";
import FlagValueInput, { getDefaultValueForType, processValueForType, validateValue } from "./flag-value-input";

interface FlagAssignmentEditModalProps {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  type: "test" | "rollout";
  itemId: string;
  flagId: string;
  flagName: string;
  flagType: string;
  environment: Environment;
}

export default function FlagAssignmentEditModal({
  open,
  onClose,
  onSave,
  type,
  itemId,
  flagId,
  flagName,
  flagType,
  environment,
}: FlagAssignmentEditModalProps) {
  const [item, setItem] = useState<DBTestRollout | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flagValues, setFlagValues] = useState<Record<string, any>>({});

  useEffect(() => {
    const loadItem = async () => {
      if (!open || !itemId) return;
      
      setLoading(true);
      setError(null);
      
      try {
        const data = type === "test" ? await fetchTest(itemId) : await fetchRollout(itemId);
        setItem(data);
        
        // Extract current flag values
        const currentValues: Record<string, any> = {};
        
        if (type === "test" && data.variants) {
          // For tests, get values from each variant
          Object.entries(data.variants).forEach(([variantName, variant]: [string, any]) => {
            if (variant.values?.[environment]?.[flagId] !== undefined) {
              currentValues[variantName] = variant.values[environment][flagId];
            } else {
              currentValues[variantName] = getDefaultValueForType(flagType);
            }
          });
        } else if (type === "rollout" && data.rolloutValues) {
          // For rollouts, get the single value
          if (data.rolloutValues[environment]?.[flagId] !== undefined) {
            currentValues.rollout = data.rolloutValues[environment][flagId];
          } else {
            currentValues.rollout = getDefaultValueForType(flagType);
          }
        }
        
        setFlagValues(currentValues);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load item');
      } finally {
        setLoading(false);
      }
    };

    loadItem();
  }, [open, itemId, type, environment, flagId, flagType]);

  const validateValues = (): boolean => {
    return Object.values(flagValues).every(value => validateValue(value, flagType as any).isValid);
  };

  const handleValueChange = (key: string, value: any) => {
    setFlagValues(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSave = async () => {
    if (!validateValues() || !item) {
      setError('Please fix validation errors before saving');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      if (type === "test") {
        // Update test variants
        const updatedVariants = { ...item.variants };
        
        Object.entries(flagValues).forEach(([variantName, value]) => {
          if (updatedVariants[variantName]) {
            if (!updatedVariants[variantName].values) {
              updatedVariants[variantName].values = {
                development: {},
                staging: {},
                production: {}
              };
            }
            if (!updatedVariants[variantName].values[environment]) {
              updatedVariants[variantName].values[environment] = {};
            }
            updatedVariants[variantName].values[environment][flagId] = processValueForType(value, flagType);
          }
        });

        await updateTest(itemId, { variants: updatedVariants });
      } else {
        // Update rollout values
        const updatedRolloutValues = {
          ...item.rolloutValues,
          [environment]: {
            ...item.rolloutValues?.[environment],
            [flagId]: processValueForType(flagValues.rollout, flagType)
          }
        };

        await updateRollout(itemId, { rolloutValues: updatedRolloutValues });
      }

      onSave();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update flag values');
    } finally {
      setSaving(false);
    }
  };

  const renderValueInput = (key: string, value: any) => {
    return (
      <FlagValueInput
        flagType={flagType as any}
        value={value}
        onChange={(newValue) => handleValueChange(key, newValue)}
        size="small"
        fullWidth
      />
    );
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {type === "test" ? <Science color="primary" /> : <Rocket color="secondary" />}
          Edit Flag Values - {environment.charAt(0).toUpperCase() + environment.slice(1)}
        </Box>
      </DialogTitle>
      
      <DialogContent>
        <Box sx={{ mt: 1 }}>
          {loading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress sx={{ mr: 2 }} />
              <Typography>Loading {type}...</Typography>
            </Box>
          )}

          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          {item && !loading && (
            <>
              <Alert severity="info" sx={{ mb: 3 }}>
                Edit values for <strong>{flagName}</strong> ({flagType}) in <strong>{item.name}</strong>
              </Alert>

              <Stack spacing={3}>
                {Object.entries(flagValues).map(([key, value]) => (
                  <Box key={key}>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                      {type === "test" ? `${key} Group` : "Rollout Value"}
                    </Typography>
                    {renderValueInput(key, value)}
                  </Box>
                ))}
              </Stack>
            </>
          )}
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button 
          onClick={handleSave} 
          variant="contained" 
          disabled={saving || !validateValues() || loading}
          startIcon={saving ? <CircularProgress size={20} /> : <Save />}
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}