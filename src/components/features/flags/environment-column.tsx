"use client";

import { useState } from "react";
import {
  Box,
  Typography,
  Button,
  Paper,
  Stack,
  Divider,
  IconButton,
  Chip,
} from "@mui/material";
import { Add, Delete } from "@mui/icons-material";
import { Environment, ConditionalVariant, FlagValue } from "@/types";
import { EnvironmentChip } from "../../ui/environment-chips";
import { formatValueForDisplay } from "./flag-value-input";

interface EnvironmentColumnProps {
  environment: Environment;
  flagId: string;
  flagType: string;
  defaultValue: FlagValue;
  variants: ConditionalVariant[];
  activeTests: Array<{
    id: string;
    name: string;
    variants: Record<string, { percentage: number; value: any }>;
  }>;
  activeRollouts: Array<{
    id: string;
    name: string;
    percentage: number;
  }>;
  onVariantAdd: () => void;
  onVariantEdit: (variant: ConditionalVariant) => void;
  onVariantDelete: (variant: ConditionalVariant) => void;
  onTestRolloutAdd: () => void;
  onTestRolloutEdit: (type: "test" | "rollout", id: string) => void;
  onDefaultValueEdit: () => void;
}

export default function EnvironmentColumn({
  environment,
  flagId,
  flagType,
  defaultValue,
  variants,
  activeTests,
  activeRollouts,
  onVariantAdd,
  onVariantEdit,
  onVariantDelete,
  onTestRolloutAdd,
  onTestRolloutEdit,
  onDefaultValueEdit,
}: EnvironmentColumnProps) {
  const formatValue = (value: FlagValue): string => {
    return formatValueForDisplay(value, flagType as any);
  };

  const getTestVariantValues = (test: any): string => {
    const values: string[] = [];
    
    if (test.variants && typeof test.variants === 'object') {
      Object.entries(test.variants).forEach(([variantName, variant]: [string, any]) => {
        let displayValue = 'undefined';
        
        // Check if the variant has values for this environment and flag
        if (variant.values && variant.values[environment] && variant.values[environment][flagId] !== undefined) {
          displayValue = formatValueForDisplay(variant.values[environment][flagId], flagType as any);
        }
        
        values.push(displayValue);
      });
    }
    
    return values.join('/');
  };

  const formatVariantSummary = (variant: ConditionalVariant): string => {
    const conditions = variant.conditions || [];
    if (conditions.length === 0) {
      return "No conditions";
    }

    // Generate intelligent summaries for common patterns
    if (conditions.length === 1) {
      return formatSingleCondition(conditions[0]);
    }

    // For multiple conditions, show abbreviated summary
    if (conditions.length <= 3) {
      return conditions.map(formatSingleCondition).join(", ");
    }

    // For many conditions, group by type
    const grouped = conditions.reduce((acc, condition) => {
      acc[condition.type] = (acc[condition.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const parts = Object.entries(grouped).map(([type, count]) => {
      const typeName = formatConditionType(type);
      return count === 1 ? typeName : `${count} ${typeName}`;
    });

    return parts.join(", ");
  };

  const formatSingleCondition = (condition: any): string => {
    const { type, operator, values } = condition;
    
    switch (type) {
      case 'environment':
        return `${formatOperator(operator)} ${values.join(", ")}`;
      
      case 'app_version':
        if (operator === 'greater_than_or_equal') {
          return `v${values[0]}+`;
        }
        if (operator === 'less_than') {
          return `< v${values[0]}`;
        }
        return `${formatOperator(operator)} v${values.join(", ")}`;
      
      case 'platform':
        return formatOperator(operator) === 'equals' 
          ? values.join(", ")
          : `${formatOperator(operator)} ${values.join(", ")}`;
      
      case 'region':
        return `${formatOperator(operator)} ${values.join(", ")}`;
      
      case 'cohort':
        return `in ${values.join(", ")}`;
      
      default:
        return `${formatConditionType(type)} ${formatOperator(operator)} ${values.join(", ")}`;
    }
  };

  const formatConditionType = (type: string): string => {
    const typeMap: Record<string, string> = {
      'environment': 'env',
      'app_version': 'version',
      'os_version': 'OS',
      'platform': 'platform',
      'region': 'region',
      'cohort': 'cohort'
    };
    return typeMap[type] || type;
  };

  const formatOperator = (operator: string): string => {
    const operatorMap: Record<string, string> = {
      'equals': 'is',
      'not_equals': 'not',
      'greater_than': '>',
      'less_than': '<',
      'greater_than_or_equal': '>=',
      'less_than_or_equal': '<=',
      'in': 'in',
      'not_in': 'not in'
    };
    return operatorMap[operator] || operator;
  };

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        // minHeight: 60, // Ensure consistent height
        display: "flex",
        flexDirection: "column",
        borderRadius: 0.5,
      }}
    >
      {/* Environment Header */}
      <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
        <EnvironmentChip environment={environment} />
      </Box>

      {/* Rollouts & Tests Section */}
      <Box sx={{ mb: 2 }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            mb: 1,
          }}
        >
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            Rollouts & Tests
          </Typography>
          <IconButton
            size="small"
            onClick={onTestRolloutAdd}
            sx={{
              bgcolor: "primary.main",
              color: "white",
              width: 20,
              height: 20,
              "&:hover": { bgcolor: "primary.dark" },
            }}
          >
            <Add sx={{ fontSize: 14 }} />
          </IconButton>
        </Box>

        <Stack spacing={1}>
          {/* Active Rollouts */}
          {activeRollouts.map((rollout) => (
            <Box key={rollout.id}>
              <Typography variant="caption" color="text.secondary">
                Rollout {rollout.percentage}%
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  cursor: "pointer",
                  "&:hover": { color: "primary.main" },
                }}
                onClick={() => onTestRolloutEdit("rollout", rollout.id)}
              >
                {formatValue(defaultValue)}
              </Typography>
            </Box>
          ))}

          {/* Active Tests */}
          {activeTests.map((test) => (
            <Box key={test.id}>
              <Typography variant="caption" color="text.secondary">
                {test.name}
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  cursor: "pointer",
                  "&:hover": { color: "primary.main" },
                }}
                onClick={() => onTestRolloutEdit("test", test.id)}
              >
                {getTestVariantValues(test)}
              </Typography>
            </Box>
          ))}
        </Stack>
      </Box>

      {/* Variants Section */}
      <Box sx={{ mb: 2, flexGrow: 1 }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            mb: 1,
          }}
        >
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            Variants
          </Typography>
          <IconButton
            size="small"
            onClick={onVariantAdd}
            sx={{
              bgcolor: "primary.main",
              color: "white",
              width: 20,
              height: 20,
              "&:hover": { bgcolor: "primary.dark" },
            }}
          >
            <Add sx={{ fontSize: 14 }} />
          </IconButton>
        </Box>

        {variants.map((variant, index) => (
          <Stack key={variant.id || index} spacing={1}>
            <Box key={variant.id}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <Box sx={{ flexGrow: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    {formatVariantSummary(variant)}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      cursor: "pointer",
                      "&:hover": { color: "primary.main" },
                    }}
                    onClick={() => onVariantEdit(variant)}
                  >
                    {formatValue(variant.value)}
                  </Typography>
                </Box>
                <IconButton
                  size="small"
                  onClick={() => onVariantDelete(variant)}
                  sx={{
                    color: "error.main",
                    opacity: 0.7,
                    "&:hover": { opacity: 1, bgcolor: "error.main", color: "white" },
                    ml: 1,
                    flexShrink: 0,
                  }}
                >
                  <Delete sx={{ fontSize: 16 }} />
                </IconButton>
              </Box>
              {index < variants.length - 1 && <Divider sx={{ my: 0.5 }} />}
            </Box>
          </Stack>
        ))}
      </Box>

      {/* Default Section */}
      <Box
        sx={{
          mt: "auto",
          pt: 2,
          borderTop: "1px solid",
          borderColor: "divider",
        }}
      >
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: "block", mb: 0.5 }}
        >
          Default
        </Typography>
        <Typography
          variant="body1"
          sx={{
            cursor: "pointer",
            fontWeight: 500,
            "&:hover": { color: "primary.main" },
          }}
          onClick={onDefaultValueEdit}
        >
          {formatValue(defaultValue)}
        </Typography>
      </Box>
    </Paper>
  );
}
