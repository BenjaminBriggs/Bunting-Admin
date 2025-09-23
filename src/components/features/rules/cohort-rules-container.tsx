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

interface CohortRulesContainerProps {
  rules: CohortTargetingRule[];
  onChange: (rules: CohortTargetingRule[]) => void;
  appId?: string;
}

export function CohortRulesContainer({ rules, onChange, appId }: CohortRulesContainerProps) {

  const generateRuleId = () => {
    return `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  const handleAddRule = () => {
    const generateConditionId = () => {
      return `condition_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    };

    const firstCondition = {
      id: generateConditionId(),
      type: 'app_version' as const,
      operator: 'in' as const,
      values: []
    };

    const newRule: CohortTargetingRule = {
      id: generateRuleId(),
      enabled: true,
      conditions: [firstCondition],
      conditionLogic: 'AND',
      priority: rules.length
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
    const newRules = rules.filter(rule => rule.id !== ruleId)
      .map((rule, index) => ({ ...rule, priority: index })); // Reorder priorities
    onChange(newRules);
  };

  const validateRules = (): RuleValidationError[] => {
    const errors: RuleValidationError[] = [];

    rules.forEach((rule, ruleIndex) => {
      // Check for incomplete conditions
      rule.conditions.forEach((condition, conditionIndex) => {
        if (condition.values.length === 0) {
          errors.push({
            ruleId: rule.id,
            conditionId: condition.id,
            message: `Rule ${ruleIndex + 1}, Condition ${conditionIndex + 1}: No values specified`,
            type: 'error'
          });
        }
      });

      // Check for disabled rules
      if (!rule.enabled) {
        errors.push({
          ruleId: rule.id,
          message: `Rule ${ruleIndex + 1} is disabled and will not be evaluated`,
          type: 'warning'
        });
      }

      // Check for empty rules (no conditions) - this should not happen
      if (rule.conditions.length === 0) {
        errors.push({
          ruleId: rule.id,
          message: `Rule ${ruleIndex + 1} has no conditions. Every rule must have at least one condition.`,
          type: 'error'
        });
      }
    });

    return errors;
  };

  const validationErrors = useMemo(() => validateRules(), [rules]);
  const hasErrors = validationErrors.some(error => error.type === 'error');
  const hasWarnings = validationErrors.some(error => error.type === 'warning');

  return (
    <Card>
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <Typography variant="h6">
            Targeting Rules
          </Typography>
          
          {rules.length > 0 && (
            <Chip 
              label={`${rules.filter(r => r.enabled).length} active`}
              size="small"
              color={hasErrors ? 'error' : hasWarnings ? 'warning' : 'success'}
              icon={hasErrors ? <Warning /> : hasWarnings ? <Warning /> : <CheckCircle />}
            />
          )}
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Define the conditions that determine which users belong to this cohort.
          Users matching any of these rules will be included in this cohort (regardless of percentage rollout).
        </Typography>

        <Stack spacing={3}>
            {/* Validation Results */}
            {validationErrors.length > 0 && (
              <Stack spacing={1}>
                {validationErrors.filter(e => e.type === 'error').map((error, index) => (
                  <Alert key={index} severity="error" size="small">
                    {error.message}
                  </Alert>
                ))}
                {validationErrors.filter(e => e.type === 'warning').map((warning, index) => (
                  <Alert key={index} severity="warning" size="small">
                    {warning.message}
                  </Alert>
                ))}
              </Stack>
            )}

            {/* Rules */}
            {rules.length === 0 ? (
              <Alert severity="info" icon={<Info />}>
                No targeting rules defined. This cohort will only use percentage-based rollout.
                <br />
                Add rules to include specific users based on their attributes (e.g., iOS 18 users, beta testers).
              </Alert>
            ) : (
              <Stack spacing={2}>
                <Alert severity="info" size="small">
                  Users matching ANY of these rules will be included in this cohort. 
                  Rules work together with percentage rollout - if a user matches a rule OR falls within the rollout percentage, they're in the cohort.
                </Alert>
                
                {rules.map((rule, index) => (
                  <CohortRuleBuilder
                    key={rule.id}
                    rule={rule}
                    onChange={(updatedRule) => handleRuleChange(rule.id, updatedRule)}
                    onDelete={() => handleDeleteRule(rule.id)}
                    canDelete={true}
                    index={index}
                    appId={appId}
                  />
                ))}
              </Stack>
            )}

            {/* Percentage Rollout Notice */}
            <Alert severity="info" size="small">
              <Typography variant="body2">
                <strong>Cohort Logic:</strong> Users are included in this cohort if they either:
                <br />
                • Match any of the targeting rules above, OR
                <br />
                • Fall within the percentage rollout (determined by hashing their device ID with the cohort salt)
              </Typography>
            </Alert>

            {/* Add Rule Button */}
          <Button
            startIcon={<Add />}
            onClick={handleAddRule}
            variant="outlined"
            fullWidth
          >
            Add Targeting Rule
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}