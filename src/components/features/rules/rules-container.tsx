'use client';

import { useState } from 'react';
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
import { TargetingRule, RuleValidationError } from '@/types/rules';
import { TargetingRuleBuilder } from './targeting-rule-builder';

interface RulesContainerProps {
  rules: TargetingRule[];
  onChange: (rules: TargetingRule[]) => void;
  flagType: 'bool' | 'string' | 'int' | 'double' | 'date' | 'json';
  defaultValue: any;
  appId?: string;
}

export function RulesContainer({ rules, onChange, flagType, defaultValue, appId }: RulesContainerProps) {

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

    const newRule: TargetingRule = {
      id: generateRuleId(),
      enabled: true,
      conditions: [firstCondition],
      conditionLogic: 'AND',
      value: defaultValue,
      priority: rules.length
    };

    onChange([...rules, newRule]);
  };

  const handleRuleChange = (ruleId: string, updatedRule: TargetingRule) => {
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

    // Check for unreachable rules (rules that come after a rule with no conditions)
    const enabledRules = rules.filter(rule => rule.enabled);
    for (let i = 0; i < enabledRules.length - 1; i++) {
      const currentRule = enabledRules[i];
      if (currentRule.conditions.length === 0) {
        errors.push({
          ruleId: currentRule.id,
          message: `Rules after Rule ${rules.indexOf(currentRule) + 1} may be unreachable because this rule has no conditions`,
          type: 'warning'
        });
        break;
      }
    }

    return errors;
  };

  const validationErrors = validateRules();
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
          Define when this flag should return different values based on user attributes and conditions.
          Rules are evaluated in order, and the first matching rule determines the value.
        </Typography>

        <Stack spacing={3}>
            {/* Validation Results */}
            {validationErrors.length > 0 && (
              <Stack spacing={1}>
                {validationErrors.filter(e => e.type === 'error').map((error, index) => (
                  <Alert key={index} severity="error">
                    {error.message}
                  </Alert>
                ))}
                {validationErrors.filter(e => e.type === 'warning').map((warning, index) => (
                  <Alert key={index} severity="warning">
                    {warning.message}
                  </Alert>
                ))}
              </Stack>
            )}

            {/* Rules */}
            {rules.length === 0 ? (
              <Alert severity="info" icon={<Info />}>
                No targeting rules defined. This flag will return its default value for all users.
                <br />
                Add rules to conditionally return different values based on user attributes.
              </Alert>
            ) : (
              <Stack spacing={2}>
                <Alert severity="info">
                  Rules are evaluated from top to bottom. The first rule with matching conditions determines the returned value.
                </Alert>
                
                {rules.map((rule, index) => (
                  <TargetingRuleBuilder
                    key={rule.id}
                    rule={rule}
                    onChange={(updatedRule) => handleRuleChange(rule.id, updatedRule)}
                    onDelete={() => handleDeleteRule(rule.id)}
                    flagType={flagType}
                    canDelete={true}
                    index={index}
                    appId={appId}
                  />
                ))}
              </Stack>
            )}

            {/* Default Value Notice */}
            <Alert severity="info">
              <Typography variant="body2">
                <strong>Default Value:</strong> {JSON.stringify(defaultValue)}
                <br />
                {rules.length === 0 
                  ? 'This value will be returned for all users since no targeting rules are defined.'
                  : 'This value will be returned when no rules match or all rules are disabled.'
                }
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