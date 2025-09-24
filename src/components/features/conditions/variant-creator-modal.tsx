'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
  Alert,
  Stack,
  Switch,
  FormControlLabel,
  Chip,
  IconButton,
  Paper
} from '@mui/material';
import { Add, Remove, Edit } from '@mui/icons-material';
import { RuleCondition } from '@/types/rules';
import { Environment, ConditionalVariant, FlagValue, FlagType } from '@/types';
import { generateId } from '@/lib/utils';
import FlagValueInput from '../flags/flag-value-input';
import { ConditionBuilderModal, ConditionsProvider } from './index';

interface VariantCreatorModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (variant: ConditionalVariant) => void;
  environment: Environment;
  flagType: FlagType;
  flagId: string;
  appId?: string;
  existingVariant?: ConditionalVariant;
}

export function VariantCreatorModal({
  open,
  onClose,
  onSave,
  environment,
  flagType,
  flagId,
  appId,
  existingVariant,
}: VariantCreatorModalProps) {
  const [variantValue, setVariantValue] = useState<FlagValue>('');
  const [conditions, setConditions] = useState<RuleCondition[]>([]);
  const [conditionLogic, setConditionLogic] = useState<'AND' | 'OR'>('AND');
  const [order, setOrder] = useState(1);
  const [errors, setErrors] = useState<string[]>([]);
  
  // State for condition builder modal
  const [conditionModalOpen, setConditionModalOpen] = useState(false);
  const [editingConditionIndex, setEditingConditionIndex] = useState<number | null>(null);
  const [editingCondition, setEditingCondition] = useState<RuleCondition | undefined>(undefined);

  useEffect(() => {
    if (existingVariant) {
      setVariantValue(existingVariant.value);
      setConditions(existingVariant.conditions);
      setOrder(existingVariant.order);
    } else {
      resetForm();
    }
  }, [existingVariant, open]);

  const resetForm = () => {
    setVariantValue(getDefaultValue());
    setConditions([]);
    setConditionLogic('AND');
    setOrder(1);
    setErrors([]);
  };

  const getDefaultValue = (): FlagValue => {
    switch (flagType) {
      case 'bool':
        return false;
      case 'string':
        return '';
      case 'int':
      case 'double':
        return 0;
      case 'date':
        return new Date().toISOString().split('T')[0];
      case 'json':
        return {};
      default:
        return '';
    }
  };


  const generateVariantName = (conditions: RuleCondition[]): string => {
    if (conditions.length === 0) return 'Variant';
    
    const descriptions = conditions.map(condition => {
      if (condition.type === 'app_version') {
        return `v${condition.values.join('/')}`;
      } else if (condition.type === 'platform') {
        return condition.values.join('/');
      } else if (condition.type === 'cohort') {
        return condition.values.join('/');
      } else {
        return `${condition.type}:${condition.values.join('/')}`;
      }
    });
    
    return descriptions.join(' + ');
  };

  const handleAddCondition = () => {
    setEditingConditionIndex(null);
    setEditingCondition(undefined);
    setConditionModalOpen(true);
  };

  const handleEditCondition = (index: number) => {
    setEditingConditionIndex(index);
    setEditingCondition(conditions[index]);
    setConditionModalOpen(true);
  };

  const handleRemoveCondition = (index: number) => {
    if (conditions.length > 1) {
      setConditions(conditions.filter((_, i) => i !== index));
      // Clear validation errors when user makes changes
      if (errors.length > 0) {
        setErrors([]);
      }
    }
  };

  const handleConditionSave = (condition: RuleCondition) => {
    if (editingConditionIndex !== null) {
      // Update existing condition
      const newConditions = [...conditions];
      newConditions[editingConditionIndex] = condition;
      setConditions(newConditions);
    } else {
      // Add new condition
      setConditions([...conditions, condition]);
    }
    setConditionModalOpen(false);
    setEditingConditionIndex(null);

    // Clear validation errors when user makes changes
    if (errors.length > 0) {
      setErrors([]);
    }
  };

  const handleVariantValueChange = (value: FlagValue) => {
    setVariantValue(value);
    // Clear validation errors when user makes changes
    if (errors.length > 0) {
      setErrors([]);
    }
  };

  const handleConditionLogicChange = (logic: 'AND' | 'OR') => {
    setConditionLogic(logic);
    // Clear validation errors when user makes changes
    if (errors.length > 0) {
      setErrors([]);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: string[] = [];

    if (flagType === 'string' && !String(variantValue).trim()) {
      newErrors.push('Variant value is required for string flags');
    }

    if (flagType === 'json') {
      try {
        JSON.parse(String(variantValue));
      } catch {
        newErrors.push('Variant value must be valid JSON');
      }
    }

    if (conditions.length === 0) {
      newErrors.push('At least one condition is required for conditional variants');
    }

    if (conditions.some(c => c.values.length === 0)) {
      newErrors.push('All conditions must have at least one value');
    }

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const handleSave = () => {
    if (!validateForm()) return;

    const variant: ConditionalVariant = {
      id: existingVariant?.id || generateId(),
      name: generateVariantName(conditions),
      type: 'conditional', // Explicit type for consistency
      conditions,
      value: variantValue,
      order,
    };

    onSave(variant);
    onClose();
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <ConditionsProvider appId={appId}>
      <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
        <DialogTitle>
          {existingVariant ? 'Edit Conditional Variant' : 'Create Conditional Variant'} - {environment}
        </DialogTitle>
        
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            {errors.length > 0 && (
              <Alert severity="error">
                <ul style={{ margin: 0, paddingLeft: 16 }}>
                  {errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </Alert>
            )}

            <Alert severity="info">
              This variant will be applied in the <strong>{environment}</strong> environment 
              when all conditions are met. Variants are evaluated in order, with the first 
              matching variant taking precedence. The name will be auto-generated from your conditions.
            </Alert>

            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Value ({flagType})
              </Typography>
              <FlagValueInput
                flagType={flagType}
                value={variantValue}
                onChange={handleVariantValueChange}
                label={`${flagType.charAt(0).toUpperCase()}${flagType.slice(1)} Value`}
                fullWidth
                helperText="The value to return when this variant's conditions are met"
              />
            </Box>

            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Order Priority
              </Typography>
              <TextField
                type="number"
                value={order}
                onChange={(e) => setOrder(parseInt(e.target.value, 10) || 1)}
                inputProps={{ min: 1 }}
                helperText="Lower numbers = higher priority (1 = highest)"
              />
            </Box>

            <Divider />

            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">Targeting Conditions</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <FormControl size="small">
                    <InputLabel>Logic</InputLabel>
                    <Select
                      value={conditionLogic}
                      label="Logic"
                      onChange={(e) => handleConditionLogicChange(e.target.value as 'AND' | 'OR')}
                    >
                      <MenuItem value="AND">AND (all must match)</MenuItem>
                      <MenuItem value="OR">OR (any must match)</MenuItem>
                    </Select>
                  </FormControl>
                  <Button
                    startIcon={<Add />}
                    onClick={handleAddCondition}
                    variant="outlined"
                    size="small"
                  >
                    Add Condition
                  </Button>
                </Box>
              </Box>

              <Stack spacing={2}>
                {conditions.map((condition, index) => (
                  <Box key={condition.id}>
                    <Paper variant="outlined" sx={{ p: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                          {condition.type === 'app_version' ? 'App Version' :
                           condition.type === 'os_version' ? 'OS Version' :
                           condition.type === 'platform' ? 'Platform' :
                           condition.type === 'region' ? 'Country' :
                           condition.type === 'cohort' ? 'Cohort' : condition.type}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <IconButton size="small" onClick={() => handleEditCondition(index)}>
                            <Edit />
                          </IconButton>
                          {conditions.length > 1 && (
                            <IconButton size="small" onClick={() => handleRemoveCondition(index)} color="error">
                              <Remove />
                            </IconButton>
                          )}
                        </Box>
                      </Box>
                      
                      <Typography variant="body2" color="text.secondary">
                        {condition.operator} {condition.values.join(', ')}
                      </Typography>
                    </Paper>
                    
                    {index < conditions.length - 1 && (
                      <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
                        <Chip
                          label={conditionLogic}
                          size="small"
                          color="primary"
                          variant="outlined"
                        />
                      </Box>
                    )}
                  </Box>
                ))}
              </Stack>

              {conditions.length === 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                  No conditions defined. Add at least one condition to target this variant.
                </Typography>
              )}
            </Box>
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button onClick={handleSave} variant="contained">
            {existingVariant ? 'Update' : 'Create'} Variant
          </Button>
        </DialogActions>

        {/* Condition Builder Modal */}
        <ConditionBuilderModal
          open={conditionModalOpen}
          onClose={() => {
            setConditionModalOpen(false);
            setEditingConditionIndex(null);
            setEditingCondition(undefined);
          }}
          onSave={handleConditionSave}
          existingCondition={editingCondition}
          contextType="flag_variant"
        />
      </Dialog>
    </ConditionsProvider>
  );
}