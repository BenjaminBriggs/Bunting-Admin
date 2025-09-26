"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Stack,
  TextField,
  FormControl,
  Select,
  MenuItem,
  Alert,
  Chip,
  Grid,
  Paper,
  CircularProgress,
} from "@mui/material";
import { Save, Science, Rocket } from "@mui/icons-material";
import { Environment, DBTestRollout } from "@/types";
import { updateFlag } from "@/lib/api";
import FlagValueInput, { getDefaultValueForType, processValueForType, validateValue } from "./flag-value-input";

interface FlagTestAssignmentModalProps {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  environment: Environment;
  flagId: string;
  flagName: string;
  flagType: string;
  selectedTests: DBTestRollout[];
  selectedRollouts: DBTestRollout[];
}

interface TestGroupValue {
  testId: string;
  testName: string;
  groupName: string;
  value: any;
}

export default function FlagTestAssignmentModal({
  open,
  onClose,
  onSave,
  environment,
  flagId,
  flagName,
  flagType,
  selectedTests,
  selectedRollouts,
}: FlagTestAssignmentModalProps) {
  const [groupValues, setGroupValues] = useState<TestGroupValue[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      // Initialize values for all test groups
      const initialValues: TestGroupValue[] = [];
      
      selectedTests.forEach(test => {
        if (test.variants && typeof test.variants === 'object') {
          Object.keys(test.variants).forEach(groupName => {
            initialValues.push({
              testId: test.id,
              testName: test.name,
              groupName,
              value: getDefaultValueForType(flagType as any)
            });
          });
        }
      });

      setGroupValues(initialValues);
      setError(null);
    }
  }, [open, selectedTests, flagType]);


  const handleValueChange = (testId: string, groupName: string, value: any) => {
    setGroupValues(prev => prev.map(gv => 
      gv.testId === testId && gv.groupName === groupName 
        ? { ...gv, value }
        : gv
    ));
  };


  const validateValues = (): boolean => {
    return groupValues.every(gv => validateValue(gv.value, flagType as any).isValid);
  };

  const handleSave = async () => {
    if (!validateValues()) {
      setError('Please fix JSON validation errors before saving');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      console.log('Starting flag assignment save process...', {
        selectedTests: selectedTests.length,
        selectedRollouts: selectedRollouts.length,
        environment,
        flagId,
        groupValues
      });

      // Group values by test
      const testUpdates: Record<string, any> = {};
      
      groupValues.forEach(gv => {
        if (!testUpdates[gv.testId]) {
          testUpdates[gv.testId] = {};
        }
        testUpdates[gv.testId][gv.groupName] = processValueForType(gv.value, flagType as any);
      });

      console.log('Test updates to apply:', testUpdates);

      // Update each test's variants to include this flag's values
      for (const testId of Object.keys(testUpdates)) {
        const test = selectedTests.find(t => t.id === testId);
        if (test && test.variants) {
          const updatedVariants = { ...test.variants };
          
          Object.keys(testUpdates[testId]).forEach(groupName => {
            if (updatedVariants[groupName]) {
              // Initialize values object if it doesn't exist
              if (!updatedVariants[groupName].values) {
                updatedVariants[groupName].values = {
                  development: {},
                  staging: {},
                  production: {}
                };
              }
              
              // Initialize environment object if it doesn't exist
              if (!updatedVariants[groupName].values[environment]) {
                updatedVariants[groupName].values[environment] = {};
              }
              
              // Update the variant's values for this environment
              (updatedVariants[groupName].values as any)[environment][flagId] = testUpdates[testId][groupName];
            }
          });

          // Update the test with new variants and add flagId if not present
          const updatedFlagIds = test.flagIds.includes(flagId) 
            ? test.flagIds 
            : [...test.flagIds, flagId];

          // Call API to update the test
          console.log(`Updating test ${testId} with:`, {
            variants: updatedVariants,
            flagIds: updatedFlagIds
          });

          const response = await fetch(`/api/tests/${testId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              variants: updatedVariants,
              flagIds: updatedFlagIds
            }),
          });

          console.log(`Test ${testId} update response:`, response.status);

          if (!response.ok) {
            const errorText = await response.text();
            console.error(`Failed to update test ${test.name}:`, errorText);
            throw new Error(`Failed to update test ${test.name}: ${errorText}`);
          }
        }
      }

      // Also handle rollouts (simpler - just one value per rollout)
      for (const rollout of selectedRollouts) {
        const rolloutValue = getDefaultValueForType(flagType as any);
        
        const updatedRolloutValues = {
          development: {},
          staging: {},
          production: {},
          ...rollout.rolloutValues,
          [environment]: {
            ...(rollout.rolloutValues as any)?.[environment],
            [flagId]: processValueForType(rolloutValue, flagType as any)
          }
        };

        const updatedFlagIds = rollout.flagIds.includes(flagId) 
          ? rollout.flagIds 
          : [...rollout.flagIds, flagId];

        // Call API to update the rollout
        const response = await fetch(`/api/rollouts/${rollout.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rolloutValues: updatedRolloutValues,
            flagIds: updatedFlagIds
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to update rollout ${rollout.name}`);
        }
      }

      console.log('Flag assignment completed successfully');
      onSave();
      onClose();
    } catch (err) {
      console.error('Flag assignment failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to assign flag to tests');
    } finally {
      setSaving(false);
    }
  };

  const getTestGroupsByTest = () => {
    const testGroups: Record<string, TestGroupValue[]> = {};
    groupValues.forEach(gv => {
      if (!testGroups[gv.testId]) {
        testGroups[gv.testId] = [];
      }
      testGroups[gv.testId].push(gv);
    });
    return testGroups;
  };

  const renderValueInput = (groupValue: TestGroupValue) => {
    const { testId, groupName, value } = groupValue;
    
    return (
      <FlagValueInput
        flagType={flagType as any}
        value={value}
        onChange={(newValue) => handleValueChange(testId, groupName, newValue)}
        size="small"
        fullWidth
      />
    );
  };

  const testGroupsByTest = getTestGroupsByTest();

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Configure Flag Values - {environment.charAt(0).toUpperCase() + environment.slice(1)}
      </DialogTitle>
      
      <DialogContent>
        <Box sx={{ mt: 1 }}>
          <Alert severity="info" sx={{ mb: 3 }}>
            Configure values for <strong>{flagName}</strong> ({flagType}) in each test group.
            These values will be used when users are assigned to each test variant.
          </Alert>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          <Stack spacing={3}>
            {selectedTests.length > 0 && (
              <Box>
                <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Science color="primary" />
                  A/B Tests
                </Typography>
                
                <Stack spacing={3}>
                  {Object.entries(testGroupsByTest).map(([testId, groups]) => {
                    const test = selectedTests.find(t => t.id === testId);
                    if (!test) return null;
                    
                    return (
                      <Paper key={testId} variant="outlined" sx={{ p: 3 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                          {test.name}
                        </Typography>
                        
                        <Grid container spacing={2}>
                          {groups.map((groupValue) => (
                            <Grid key={`${groupValue.testId}-${groupValue.groupName}`} size={{ xs: 12, sm: 6, md: 4 }}>
                              <Box>
                                <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                                  {groupValue.groupName}
                                </Typography>
                                {renderValueInput(groupValue)}
                              </Box>
                            </Grid>
                          ))}
                        </Grid>
                      </Paper>
                    );
                  })}
                </Stack>
              </Box>
            )}

            {selectedRollouts.length > 0 && (
              <Box>
                <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Rocket color="secondary" />
                  Rollouts
                </Typography>
                
                <Stack spacing={2}>
                  {selectedRollouts.map((rollout) => (
                    <Paper key={rollout.id} variant="outlined" sx={{ p: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Typography variant="subtitle2" sx={{ minWidth: 150 }}>
                          {rollout.name}
                        </Typography>
                        <Box sx={{ flexGrow: 1 }}>
                          {renderValueInput({
                            testId: rollout.id,
                            testName: rollout.name,
                            groupName: 'rollout',
                            value: getDefaultValueForType(flagType as any)
                          })}
                        </Box>
                      </Box>
                    </Paper>
                  ))}
                </Stack>
              </Box>
            )}
          </Stack>
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button 
          onClick={handleSave} 
          variant="contained" 
          disabled={saving || !validateValues()}
          startIcon={saving ? <CircularProgress size={20} /> : <Save />}
        >
          {saving ? 'Assigning...' : `Assign Flag to ${selectedTests.length + selectedRollouts.length} Item${selectedTests.length + selectedRollouts.length !== 1 ? 's' : ''}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}