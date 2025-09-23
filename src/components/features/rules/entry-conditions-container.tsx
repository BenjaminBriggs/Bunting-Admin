'use client';

import { useState, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Button,
  Typography,
  Alert,
  Stack,
  Chip
} from '@mui/material';
import { 
  Add, 
  Warning,
  CheckCircle,
  Info
} from '@mui/icons-material';
import { CohortTargetingRule, RuleValidationError } from '@/types/rules';
import { CohortRuleBuilder } from './cohort-rule-builder';

interface EntryConditionsContainerProps {
  rules: CohortTargetingRule[];
  onChange: (rules: CohortTargetingRule[]) => void;
  appId?: string;
  title?: string;
  description?: string;
  disabled?: boolean;
}

export function EntryConditionsContainer({ 
  rules, 
  onChange, 
  appId,
  title = "Entry Conditions",
  description = "Define the criteria users must meet to be included",
  disabled = false
}: EntryConditionsContainerProps) {

  const generateRuleId = () => {
    return `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  const handleAddRule = () => {
    const newRule: CohortTargetingRule = {
      id: generateRuleId(),
      enabled: true,
      conditions: [],
      conditionLogic: 'AND',
      priority: rules.length + 1
    };

    onChange([...rules, newRule]);
  };

  const handleRuleChange = (ruleId: string, updatedRule: CohortTargetingRule) => {
    const newRules = rules.map(rule => 
      rule.id === ruleId ? updatedRule : rule
    );
    onChange(newRules);
  };

  const handleDeleteRule = (ruleId: string) => {
    const newRules = rules.filter(rule => rule.id !== ruleId);
    onChange(newRules);
  };

  // Validation
  const validateRules = (): RuleValidationError[] => {
    const errors: RuleValidationError[] = [];
    
    rules.forEach((rule, ruleIndex) => {
      if (rule.conditions.length === 0) {
        errors.push({
          ruleId: rule.id,
          message: `Rule ${ruleIndex + 1} has no conditions`,
          type: 'error'
        });
      }

      rule.conditions.forEach((condition, condIndex) => {
        if (condition.values.length === 0) {
          errors.push({
            ruleId: rule.id,
            conditionId: condition.id,
            message: `Rule ${ruleIndex + 1}, Condition ${condIndex + 1} has no values`,
            type: 'error'
          });
        }
      });
    });

    return errors;
  };

  const validationErrors = useMemo(() => validateRules(), [rules]);
  const hasErrors = validationErrors.filter(e => e.type === 'error').length > 0;
  const hasWarnings = validationErrors.filter(e => e.type === 'warning').length > 0;

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h6" sx={{ mb: 1 }}>
            {title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {description}
          </Typography>
        </Box>

        <Button
          startIcon={<Add />}
          onClick={handleAddRule}
          variant="outlined"
          disabled={disabled}
        >
          Add Condition Group
        </Button>
      </Box>

      {/* Validation Messages */}
      {validationErrors.length > 0 && (
        <Stack spacing={1} sx={{ mb: 2 }}>
          {validationErrors.map((error, index) => (
            <Alert 
              key={index}
              severity={error.type}
              icon={error.type === 'error' ? <Warning /> : <Info />}
            >
              {error.message}
            </Alert>
          ))}
        </Stack>
      )}

      {/* Rules */}
      <Stack spacing={2}>
        {rules.length === 0 ? (
          <Alert severity="info">
            No entry conditions defined. All users will be eligible.
          </Alert>
        ) : (
          rules.map((rule, index) => (
            <CohortRuleBuilder
              key={rule.id}
              rule={rule}
              onChange={(updatedRule) => handleRuleChange(rule.id, updatedRule)}
              onDelete={() => handleDeleteRule(rule.id)}
              canDelete={rules.length > 1}
              index={index}
              appId={appId}
            />
          ))
        )}
      </Stack>

      {/* Summary */}
      {rules.length > 0 && (
        <Card variant="outlined" sx={{ mt: 3, bgcolor: 'grey.50' }}>
          <CardContent sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <CheckCircle color={hasErrors ? 'error' : 'success'} />
              <Box>
                <Typography variant="subtitle2">
                  {rules.length} condition group{rules.length === 1 ? '' : 's'} defined
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {hasErrors ? 'Some conditions need attention' : 'All conditions are properly configured'}
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}