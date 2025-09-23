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
  Warning,
  Edit
} from '@mui/icons-material';
import { CohortTargetingRule, RuleCondition } from '@/types/rules';
import { ConditionBuilderModal, ConditionsProvider } from '../conditions';

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
  const [conditionModalOpen, setConditionModalOpen] = useState(false);
  const [editingConditionIndex, setEditingConditionIndex] = useState<number | null>(null);

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
    setEditingConditionIndex(null);
    setConditionModalOpen(true);
  };

  const handleEditCondition = (index: number) => {
    setEditingConditionIndex(index);
    setConditionModalOpen(true);
  };

  const handleConditionSave = (condition: RuleCondition) => {
    if (editingConditionIndex !== null) {
      // Update existing condition
      const newConditions = [...rule.conditions];
      newConditions[editingConditionIndex] = condition;
      onChange({ ...rule, conditions: newConditions });
    } else {
      // Add new condition
      onChange({ 
        ...rule, 
        conditions: [...rule.conditions, condition] 
      });
    }
    setConditionModalOpen(false);
    setEditingConditionIndex(null);
  };

  const hasIncompleteConditions = rule.conditions.some(condition => condition.values.length === 0);
  const hasMultipleConditions = rule.conditions.length > 1;

  return (
    <ConditionsProvider appId={appId}>
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
                  
                  <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                        {condition.type === 'app_version' ? 'App Version' :
                         condition.type === 'os_version' ? 'OS Version' :
                         condition.type === 'platform' ? 'Platform' :
                         condition.type === 'country' ? 'Country' : condition.type}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <IconButton size="small" onClick={() => handleEditCondition(conditionIndex)}>
                          <Edit />
                        </IconButton>
                        {rule.conditions.length > 1 && (
                          <IconButton size="small" onClick={() => handleDeleteCondition(condition.id)} color="error">
                            <Delete />
                          </IconButton>
                        )}
                      </Box>
                    </Box>
                    
                    <Typography variant="body2" color="text.secondary">
                      {condition.operator} {condition.values.length > 0 ? condition.values.join(', ') : '(no values set)'}
                    </Typography>
                    
                    {condition.values.length === 0 && (
                      <Alert severity="warning" size="small" sx={{ mt: 1 }}>
                        This condition needs values to be configured.
                      </Alert>
                    )}
                  </Box>
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

    {/* Condition Builder Modal */}
    <ConditionBuilderModal
      open={conditionModalOpen}
      onClose={() => {
        setConditionModalOpen(false);
        setEditingConditionIndex(null);
      }}
      onSave={handleConditionSave}
      existingCondition={editingConditionIndex !== null ? rule.conditions[editingConditionIndex] : undefined}
      contextType="cohort"
    />
  </ConditionsProvider>
  );
}