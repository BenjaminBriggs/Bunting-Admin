'use client';

import { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Button,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Stack,
  Chip,
  Alert,
  Divider,
  IconButton,
  Collapse
} from '@mui/material';
import { 
  Add, 
  Delete, 
  ExpandMore, 
  ExpandLess, 
  DragIndicator,
  Warning
} from '@mui/icons-material';
import { CohortTargetingRule, RuleCondition } from '@/types/rules';
import { ConditionBuilder } from './condition-builder';

interface CohortRuleBuilderProps {
  rule: CohortTargetingRule;
  onChange: (rule: CohortTargetingRule) => void;
  onDelete: () => void;
  canDelete?: boolean;
  index: number;
  appId?: string;
}

export function CohortRuleBuilder({ 
  rule, 
  onChange, 
  onDelete, 
  canDelete = true,
  index,
  appId
}: CohortRuleBuilderProps) {
  const [expanded, setExpanded] = useState(true);

  const handleToggle = (checked: boolean) => {
    onChange({ ...rule, enabled: checked });
  };

  const handleConditionLogicChange = (logic: 'AND' | 'OR') => {
    onChange({ ...rule, conditionLogic: logic });
  };

  const handleConditionChange = (conditionId: string, updatedCondition: RuleCondition) => {
    const newConditions = rule.conditions.map(condition =>
      condition.id === conditionId ? updatedCondition : condition
    );
    onChange({ ...rule, conditions: newConditions });
  };

  const handleDeleteCondition = (conditionId: string) => {
    const newConditions = rule.conditions.filter(condition => condition.id !== conditionId);
    onChange({ ...rule, conditions: newConditions });
  };

  const handleAddCondition = () => {
    const generateConditionId = () => {
      return `condition_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    };

    const newCondition: RuleCondition = {
      id: generateConditionId(),
      type: 'environment',
      operator: 'in',
      values: []
    };

    onChange({ 
      ...rule, 
      conditions: [...rule.conditions, newCondition] 
    });
  };

  const hasIncompleteConditions = rule.conditions.some(condition => condition.values.length === 0);
  const hasMultipleConditions = rule.conditions.length > 1;

  return (
    <Card 
      variant="outlined" 
      sx={{ 
        opacity: rule.enabled ? 1 : 0.6,
        border: hasIncompleteConditions ? '2px solid' : '1px solid',
        borderColor: hasIncompleteConditions ? 'warning.main' : 'divider'
      }}
    >
      <CardContent sx={{ p: 2 }}>
        {/* Rule Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <DragIndicator sx={{ color: 'text.disabled', cursor: 'grab' }} />
          
          <Chip 
            label={`Rule ${index + 1}`} 
            size="small" 
            variant="outlined"
            color={rule.enabled ? 'primary' : 'default'}
          />
          
          <FormControlLabel
            control={
              <Switch 
                checked={rule.enabled} 
                onChange={(e) => handleToggle(e.target.checked)}
                size="small"
              />
            }
            label="Enabled"
            sx={{ ml: 'auto' }}
          />
          
          <IconButton
            onClick={() => setExpanded(!expanded)}
            size="small"
          >
            {expanded ? <ExpandLess /> : <ExpandMore />}
          </IconButton>
          
          {canDelete && (
            <IconButton 
              onClick={onDelete}
              size="small"
              color="error"
            >
              <Delete />
            </IconButton>
          )}
        </Box>

        <Collapse in={expanded}>
          <Stack spacing={2}>
            {/* Rule Description */}
            <Typography variant="body2" color="text.secondary">
              Users matching these conditions will be included in this cohort:
            </Typography>

            {/* Validation Warning */}
            {hasIncompleteConditions && (
              <Alert severity="warning" size="small">
                <Typography variant="body2">
                  This rule has incomplete conditions. Please specify values for all conditions.
                </Typography>
              </Alert>
            )}

            {/* Condition Logic Selector */}
            {hasMultipleConditions && (
              <FormControl size="small" sx={{ width: 200 }}>
                <InputLabel>Condition Logic</InputLabel>
                <Select
                  value={rule.conditionLogic}
                  label="Condition Logic"
                  onChange={(e) => handleConditionLogicChange(e.target.value as 'AND' | 'OR')}
                >
                  <MenuItem value="AND">
                    <Box>
                      <Typography variant="body2">ALL conditions must match</Typography>
                      <Typography variant="caption" color="text.secondary">AND logic</Typography>
                    </Box>
                  </MenuItem>
                  <MenuItem value="OR">
                    <Box>
                      <Typography variant="body2">ANY condition can match</Typography>
                      <Typography variant="caption" color="text.secondary">OR logic</Typography>
                    </Box>
                  </MenuItem>
                </Select>
              </FormControl>
            )}

            {/* Conditions */}
            <Stack spacing={1}>
              {rule.conditions.map((condition, conditionIndex) => (
                <Box key={condition.id}>
                  {conditionIndex > 0 && (
                    <Box sx={{ display: 'flex', alignItems: 'center', my: 1 }}>
                      <Divider sx={{ flex: 1 }} />
                      <Chip 
                        label={rule.conditionLogic} 
                        size="small" 
                        sx={{ mx: 2 }}
                        color="primary"
                        variant="outlined"
                      />
                      <Divider sx={{ flex: 1 }} />
                    </Box>
                  )}
                  
                  <ConditionBuilder
                    condition={condition}
                    onChange={(updatedCondition) => handleConditionChange(condition.id, updatedCondition)}
                    onDelete={() => handleDeleteCondition(condition.id)}
                    canDelete={rule.conditions.length > 1}
                    appId={appId}
                    showCohortConditions={false} // Cohorts can't reference other cohorts
                  />
                </Box>
              ))}
            </Stack>

            {/* Add Condition Button */}
            <Button
              startIcon={<Add />}
              onClick={handleAddCondition}
              variant="outlined"
              size="small"
              sx={{ alignSelf: 'flex-start' }}
            >
              Add Condition
            </Button>
          </Stack>
        </Collapse>
      </CardContent>
    </Card>
  );
}