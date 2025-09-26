"use client";

import { useState, useEffect, useCallback } from "react";
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
} from "@mui/material";
import { Add, Remove } from "@mui/icons-material";
import { ConditionBuilder } from "../rules/condition-builder";
import { RuleCondition, RuleConditionType } from "@/types/rules";
import { Environment, ConditionalVariant, FlagValue, FlagType } from "@/types";
import { generateId } from "@/lib/utils";
import ValueInput from "../../ui/value-input";

interface ConditionCreatorModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (variant: ConditionalVariant) => void;
  environment: Environment;
  flagType: FlagType;
  flagId: string;
  appId?: string;
  existingVariant?: ConditionalVariant;
}

export default function ConditionCreatorModal({
  open,
  onClose,
  onSave,
  environment,
  flagType,
  flagId,
  appId,
  existingVariant,
}: ConditionCreatorModalProps) {
  // Remove name requirement - auto-generate from conditions
  const [variantValue, setVariantValue] = useState<FlagValue>("");
  const [conditions, setConditions] = useState<RuleCondition[]>([]);
  const [conditionLogic, setConditionLogic] = useState<"AND" | "OR">("AND");
  const [order, setOrder] = useState(1);
  const [errors, setErrors] = useState<string[]>([]);

  const getDefaultValue = useCallback((): FlagValue => {
    switch (flagType as any) {
      case "bool":
        return false;
      case "string":
        return "";
      case "int":
      case "double":
        return 0;
      case "date":
        return new Date().toISOString().split("T")[0];
      case "json":
        return {};
      default:
        return "";
    }
  }, [flagType]);

  const createDefaultCondition = useCallback((): RuleCondition => ({
    id: generateId(),
    type: "environment" as any,
    operator: "in",
    values: [environment],
  }), [environment]);

  const generateVariantName = (conditions: RuleCondition[]): string => {
    if (conditions.length === 0) return "Variant";
    
    // Generate a descriptive name from conditions
    const descriptions = conditions.map(condition => {
      if ((condition.type as any) === "environment") {
        return condition.values.join("/");
      } else if (condition.type === "app_version") {
        return `v${condition.values.join("/")}`;
      } else if (condition.type === "platform") {
        return condition.values.join("/");
      } else if (condition.type === "cohort") {
        return condition.values.join("/");
      } else {
        return `${condition.type}:${condition.values.join("/")}`;
      }
    });
    
    return descriptions.join(" + ");
  };

  const handleAddCondition = () => {
    setConditions([...conditions, createDefaultCondition()]);
    // Clear validation errors when user makes changes
    if (errors.length > 0) {
      setErrors([]);
    }
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

  const handleConditionChange = (index: number, condition: RuleCondition) => {
    const newConditions = [...conditions];
    newConditions[index] = condition;
    setConditions(newConditions);
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

  const handleConditionLogicChange = (logic: "AND" | "OR") => {
    setConditionLogic(logic);
    // Clear validation errors when user makes changes
    if (errors.length > 0) {
      setErrors([]);
    }
  };

  const handleOrderChange = (order: number) => {
    setOrder(order);
    // Clear validation errors when user makes changes
    if (errors.length > 0) {
      setErrors([]);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: string[] = [];

    if (flagType === "string" && !String(variantValue).trim()) {
      newErrors.push("Variant value is required for string flags");
    }

    if (flagType === "json") {
      try {
        JSON.parse(String(variantValue));
      } catch {
        newErrors.push("Variant value must be valid JSON");
      }
    }

    if (conditions.some(c => c.values.length === 0)) {
      newErrors.push("All conditions must have at least one value");
    }

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const resetForm = useCallback(() => {
    setVariantValue(getDefaultValue());
    setConditions([createDefaultCondition()]);
    setConditionLogic("AND");
    setOrder(1);
    setErrors([]);
  }, [getDefaultValue, createDefaultCondition]);

  const handleSave = () => {
    if (!validateForm()) return;

    const variant: ConditionalVariant = {
      id: existingVariant?.id || generateId(),
      name: generateVariantName(conditions),
      type: 'conditional',
      conditions: conditions as any,
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
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {existingVariant ? "Edit Conditional Variant" : "Create Conditional Variant"} - {environment}
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
            <ValueInput
              type={flagType}
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
              onChange={(e) => handleOrderChange(parseInt(e.target.value, 10) || 1)}
              inputProps={{ min: 1 }}
              helperText="Lower numbers = higher priority (1 = highest)"
            />
          </Box>

          <Divider />

          <Box>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
              <Typography variant="h6">Targeting Conditions</Typography>
              <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                <FormControl size="small">
                  <InputLabel>Logic</InputLabel>
                  <Select
                    value={conditionLogic}
                    label="Logic"
                    onChange={(e) => handleConditionLogicChange(e.target.value as "AND" | "OR")}
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
                  <ConditionBuilder
                    condition={condition}
                    onChange={(newCondition) => handleConditionChange(index, newCondition)}
                    onDelete={() => handleRemoveCondition(index)}
                    canDelete={conditions.length > 1}
                    appId={appId}
                  />
                  
                  {index < conditions.length - 1 && (
                    <Box sx={{ display: "flex", justifyContent: "center", py: 1 }}>
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
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", py: 2 }}>
                No conditions defined. Add at least one condition to target this variant.
              </Typography>
            )}
          </Box>
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button onClick={handleSave} variant="contained">
          {existingVariant ? "Update" : "Create"} Variant
        </Button>
      </DialogActions>
    </Dialog>
  );
}