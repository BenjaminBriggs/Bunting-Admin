'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  IconButton,
  Typography,
  Autocomplete,
  Stack,
  Paper
} from '@mui/material';
import { Delete } from '@mui/icons-material';
import {
  Condition,
  ConditionType,
  ConditionOperator,
  CONDITION_OPERATORS,
  PLATFORM_OPTIONS,
  COUNTRY_OPTIONS
} from '@/types';
import { fetchCohorts, type Cohort } from '@/lib/api';

interface ConditionEditorProps {
  condition: Condition;
  onChange: (condition: Condition) => void;
  onDelete: () => void;
  canDelete?: boolean;
  appId?: string;
}

const CONDITION_TYPE_LABELS: Record<ConditionType, string> = {
  app_version: 'App Version',
  os_version: 'OS Version',
  platform: 'Platform',
  country: 'Country',
  cohort: 'Cohort'
};

const OPERATOR_LABELS: Record<ConditionOperator, string> = {
  equals: 'equals',
  not_equals: 'does not equal',
  greater_than: 'is greater than',
  greater_than_or_equal: 'is greater than or equal to',
  less_than: 'is less than',
  less_than_or_equal: 'is less than or equal to',
  between: 'is between',
  in: 'is one of',
  not_in: 'is not one of'
};

export function ConditionEditor({
  condition,
  onChange,
  onDelete,
  canDelete = true,
  appId
}: ConditionEditorProps) {
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [loadingCohorts, setLoadingCohorts] = useState(false);

  // Load cohorts when type is 'cohort'
  useEffect(() => {
    if (condition.type === 'cohort' && appId) {
      setLoadingCohorts(true);
      fetchCohorts(appId).then(cohortsData => {
        setCohorts(cohortsData);
        setLoadingCohorts(false);
      }).catch(() => {
        setLoadingCohorts(false);
      });
    }
  }, [condition.type, appId]);

  const handleTypeChange = (newType: ConditionType) => {
    const firstOperator = CONDITION_OPERATORS[newType][0];
    onChange({
      ...condition,
      type: newType,
      operator: firstOperator,
      values: []
    });
  };

  const handleOperatorChange = (newOperator: ConditionOperator) => {
    onChange({
      ...condition,
      operator: newOperator,
      values: newOperator === 'between' ? ['', ''] : []
    });
  };

  const handleValuesChange = (newValues: string[]) => {
    onChange({
      ...condition,
      values: newValues
    });
  };

  const renderValueInput = () => {
    const isBetween = condition.operator === 'between';
    const isListType = ['platform', 'country', 'cohort'].includes(condition.type);
    
    if (isListType) {
      let options: { value: string; label: string; }[] = [];
      
      if (condition.type === 'platform') {
        options = PLATFORM_OPTIONS;
      } else if (condition.type === 'country') {
        options = COUNTRY_OPTIONS;
      } else if (condition.type === 'cohort') {
        options = cohorts.map(c => ({ value: c.key, label: c.name }));
      }

      return (
        <Autocomplete
          multiple
          options={options}
          value={options.filter(opt => condition.values.includes(opt.value))}
          onChange={(_, newValue) => {
            handleValuesChange(newValue.map(item => item.value));
          }}
          getOptionLabel={(option) => option.label}
          loading={condition.type === 'cohort' && loadingCohorts}
          renderInput={(params) => (
            <TextField
              {...params}
              label={`Select ${CONDITION_TYPE_LABELS[condition.type]}`}
              placeholder={`Choose ${CONDITION_TYPE_LABELS[condition.type].toLowerCase()}...`}
            />
          )}
          sx={{ minWidth: 200 }}
        />
      );
    }

    if (isBetween) {
      return (
        <Stack direction="row" spacing={1} alignItems="center">
          <TextField
            label="Min Version"
            value={condition.values[0] || ''}
            onChange={(e) => handleValuesChange([e.target.value, condition.values[1] || ''])}
            placeholder="e.g., 1.0.0"
            size="small"
            sx={{ width: 120 }}
          />
          <Typography variant="body2" color="text.secondary">and</Typography>
          <TextField
            label="Max Version"
            value={condition.values[1] || ''}
            onChange={(e) => handleValuesChange([condition.values[0] || '', e.target.value])}
            placeholder="e.g., 2.0.0"
            size="small"
            sx={{ width: 120 }}
          />
        </Stack>
      );
    }

    // Single version input
    return (
      <TextField
        label={`${CONDITION_TYPE_LABELS[condition.type]} Value`}
        value={condition.values[0] || ''}
        onChange={(e) => handleValuesChange([e.target.value])}
        placeholder={condition.type.includes('version') ? 'e.g., 1.0.0' : 'Enter value'}
        size="small"
        sx={{ minWidth: 150 }}
      />
    );
  };

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack direction="row" spacing={2} alignItems="flex-start">
        {/* Condition Type */}
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Condition</InputLabel>
          <Select
            value={condition.type}
            onChange={(e) => handleTypeChange(e.target.value as ConditionType)}
            label="Condition"
          >
            {Object.entries(CONDITION_TYPE_LABELS).map(([value, label]) => (
              <MenuItem key={value} value={value}>
                {label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Operator */}
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Operator</InputLabel>
          <Select
            value={condition.operator}
            onChange={(e) => handleOperatorChange(e.target.value as ConditionOperator)}
            label="Operator"
          >
            {CONDITION_OPERATORS[condition.type].map((op) => (
              <MenuItem key={op} value={op}>
                {OPERATOR_LABELS[op]}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Values */}
        <Box sx={{ flex: 1 }}>
          {renderValueInput()}
        </Box>

        {/* Delete Button */}
        {canDelete && (
          <IconButton 
            onClick={onDelete} 
            color="error" 
            size="small"
            sx={{ mt: 0.5 }}
          >
            <Delete />
          </IconButton>
        )}
      </Stack>
    </Paper>
  );
}