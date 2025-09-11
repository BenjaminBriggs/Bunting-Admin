'use client';

import { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Button,
  Typography,
  TextField,
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
import { TargetingRule, RuleCondition } from '@/types/rules';
import { ConditionBuilder } from './condition-builder';

interface TargetingRuleBuilderProps {
  rule: TargetingRule;
  onChange: (rule: TargetingRule) => void;
  onDelete: () => void;
  flagType: 'bool' | 'string' | 'int' | 'double' | 'date' | 'json';
  canDelete?: boolean;
  index: number;
}

export function TargetingRuleBuilder({ 
  rule, 
  onChange, 
  onDelete, 
  flagType, 
  canDelete = true,
  index
}: TargetingRuleBuilderProps) {
  const [expanded, setExpanded] = useState(true);

  const generateConditionId = () => {
    return `condition_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  const handleAddCondition = () => {
    const newCondition: RuleCondition = {
      id: generateConditionId(),
      type: 'environment',
      operator: 'equals',
      values: []
    };

    onChange({
      ...rule,
      conditions: [...rule.conditions, newCondition]
    });
  };

  const handleConditionChange = (conditionId: string, updatedCondition: RuleCondition) => {
    const newConditions = rule.conditions.map(condition =>
      condition.id === conditionId ? updatedCondition : condition
    );

    onChange({
      ...rule,
      conditions: newConditions
    });
  };

  const handleRemoveCondition = (conditionId: string) => {
    const newConditions = rule.conditions.filter(condition => condition.id !== conditionId);
    
    onChange({
      ...rule,
      conditions: newConditions
    });
  };

  const handleValueChange = (value: any) => {
    // Convert value based on flag type
    let convertedValue = value;
    switch (flagType) {
      case 'bool':
        convertedValue = value === 'true';
        break;
      case 'int':
        convertedValue = parseInt(value) || 0;
        break;
      case 'double':
        convertedValue = parseFloat(value) || 0;
        break;
      case 'json':
        try {
          convertedValue = JSON.parse(value);
        } catch {
          convertedValue = value; // Keep as string if invalid JSON
        }
        break;
      default:
        convertedValue = value;
    }

    onChange({
      ...rule,
      value: convertedValue
    });
  };

  const getValueInput = () => {
    switch (flagType) {
      case 'bool':
        return (
          <FormControl fullWidth>
            <InputLabel>Value</InputLabel>
            <Select
              value={String(rule.value)}
              label="Value"
              onChange={(e) => handleValueChange(e.target.value)}
            >
              <MenuItem value="true">true</MenuItem>
              <MenuItem value="false">false</MenuItem>
            </Select>
          </FormControl>
        );
      case 'int':
      case 'double':
        return (
          <TextField
            label="Value"
            type="number"
            value={rule.value || ''}
            onChange={(e) => handleValueChange(e.target.value)}
            fullWidth
          />
        );
      case 'json':
        return (
          <TextField
            label="JSON Value"
            multiline
            rows={3}
            value={typeof rule.value === 'string' ? rule.value : JSON.stringify(rule.value, null, 2)}
            onChange={(e) => handleValueChange(e.target.value)}
            fullWidth
            InputProps={{
              sx: { fontFamily: 'monospace' }
            }}
            placeholder='{"enabled": true}'
          />
        );
      default:
        return (
          <TextField
            label="Value"
            value={rule.value || ''}
            onChange={(e) => handleValueChange(e.target.value)}
            fullWidth
          />
        );
    }
  };

  const hasEmptyConditions = rule.conditions.some(condition => 
    condition.values.length === 0 || 
    (condition.type === 'custom_attribute' && !condition.attribute)
  );

  return (
    <Card variant="outlined" sx={{ mb: 2 }}>
      <CardContent sx={{ p: 2 }}>
        {/* Rule Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <DragIndicator sx={{ color: 'text.secondary', mr: 1 }} />
          
          <Chip 
            label={`Rule ${index + 1}`} 
            size="small" 
            color="primary" 
            sx={{ mr: 2 }}
          />
          
          <Typography variant="h6" sx={{ flexGrow: 1, mr: 2 }}>
            Rule {index + 1}
          </Typography>

          <FormControlLabel
            control={
              <Switch
                checked={rule.enabled}
                onChange={(e) => onChange({ ...rule, enabled: e.target.checked })}
                size="small"
              />
            }
            label="Enabled"
            sx={{ mr: 1 }}
          />

          <IconButton 
            onClick={() => setExpanded(!expanded)}
            size="small"
            sx={{ mr: 1 }}
          >
            {expanded ? <ExpandLess /> : <ExpandMore />}
          </IconButton>

          {canDelete && (
            <IconButton onClick={onDelete} color="error" size="small">
              <Delete />
            </IconButton>
          )}
        </Box>

        <Collapse in={expanded}>
          <Stack spacing={3}>

            {/* Conditions */}
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                  Conditions
                </Typography>
                
                {rule.conditions.length > 1 && (
                  <FormControl size="small" sx={{ minWidth: 100 }}>
                    <InputLabel>Logic</InputLabel>
                    <Select
                      value={rule.conditionLogic}
                      label="Logic"
                      onChange={(e) => onChange({ ...rule, conditionLogic: e.target.value as 'AND' | 'OR' })}
                    >
                      <MenuItem value="AND">AND</MenuItem>
                      <MenuItem value="OR">OR</MenuItem>
                    </Select>
                  </FormControl>
                )}
              </Box>

              {rule.conditions.length === 0 ? (
                <Alert severity="info" sx={{ mb: 2 }}>
                  No conditions defined. This rule will never match any users.
                </Alert>
              ) : (
                <Stack spacing={2}>
                  {rule.conditions.map((condition, index) => (
                    <Box key={condition.id}>
                      {index > 0 && (
                        <Box sx={{ display: 'flex', justifyContent: 'center', my: 1 }}>
                          <Chip 
                            label={rule.conditionLogic} 
                            size="small" 
                            variant="outlined"
                          />
                        </Box>
                      )}
                      <ConditionBuilder
                        condition={condition}
                        onChange={(updatedCondition) => handleConditionChange(condition.id, updatedCondition)}
                        onDelete={() => handleRemoveCondition(condition.id)}
                        canDelete={rule.conditions.length > 1}
                      />
                    </Box>
                  ))}
                </Stack>
              )}

              <Button
                startIcon={<Add />}
                onClick={handleAddCondition}
                variant="outlined"
                size="small"
                sx={{ mt: 2 }}
              >
                Add Condition
              </Button>
            </Box>

            <Divider />

            {/* Return Value */}
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 500, mb: 2 }}>
                Return Value
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Value to return when all conditions match
              </Typography>
              
              {getValueInput()}
            </Box>


            {/* Warnings */}
            {hasEmptyConditions && (
              <Alert severity="warning" icon={<Warning />}>
                Some conditions are incomplete. Please fill in all condition values.
              </Alert>
            )}
          </Stack>
        </Collapse>
      </CardContent>
    </Card>
  );
}