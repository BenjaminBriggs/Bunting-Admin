'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Box,
  Card,
  CardContent,
  Button,
  Typography,
  TextField,
  Stack,
  Grid,
  Alert,
  Chip,
  IconButton,
  CircularProgress,
  Autocomplete,
  Slider,
  Paper,
} from '@mui/material';
import { ArrowBack, Save, Add, Delete, Archive } from '@mui/icons-material';
import Link from 'next/link';
import { fetchTestRollout, updateTestRollout, archiveTestRollout, fetchFlags } from '@/lib/api';
import { useChanges } from '@/lib/changes-context';
import { TargetingRule } from '@/types/rules';
import { RulesContainer } from '@/components';
import FlagValueInput from '@/components/features/flags/flag-value-input';

interface Variant {
  name: string;
  percentage: number;
  value: any;
}

export default function EditTestPage() {
  const params = useParams();
  const router = useRouter();
  const { markChangesDetected } = useChanges();
  const testId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [test, setTest] = useState<any>(null);
  
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [targetFlags, setTargetFlags] = useState<string[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [conditions, setConditions] = useState<TargetingRule[]>([]);
  const [archived, setArchived] = useState(false);
  
  const [flags, setFlags] = useState<any[]>([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [testData, flagsData] = await Promise.all([
          fetchTestRollout(testId),
          fetchFlags(testData?.appId || '')
        ]);
        
        setTest(testData);
        setFlags(flagsData);
        setName(testData.name);
        setDescription(testData.description || '');
        setTargetFlags(testData.flagIds || []);
        setArchived(testData.archived);
        
        // Convert variants object to array
        if (testData.variants && typeof testData.variants === 'object') {
          const variantArray = Object.entries(testData.variants).map(([name, data]: [string, any]) => ({
            name,
            percentage: data.percentage || 0,
            value: data.value
          }));
          setVariants(variantArray);
        }
        
        setConditions(testData.conditions ? [{
          enabled: true,
          conditions: testData.conditions,
          conditionLogic: 'AND',
          value: true,
          priority: 1
        }] : []);
        
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load test');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [testId]);

  const addVariant = () => {
    const newVariant: Variant = {
      name: `Variant ${variants.length + 1}`,
      percentage: 0,
      value: false
    };
    setVariants([...variants, newVariant]);
    redistributePercentages([...variants, newVariant]);
  };

  const removeVariant = (index: number) => {
    if (variants.length <= 2) return;
    const newVariants = variants.filter((_, i) => i !== index);
    setVariants(newVariants);
    redistributePercentages(newVariants);
  };

  const redistributePercentages = (variantList: Variant[]) => {
    const equalPercentage = Math.floor(100 / variantList.length);
    const remainder = 100 % variantList.length;
    
    const updatedVariants = variantList.map((variant, index) => ({
      ...variant,
      percentage: equalPercentage + (index < remainder ? 1 : 0)
    }));
    
    setVariants(updatedVariants);
  };

  const updateVariantPercentage = (index: number, percentage: number) => {
    const newVariants = [...variants];
    newVariants[index].percentage = percentage;
    setVariants(newVariants);
  };

  const updateVariantValue = (index: number, value: any) => {
    const newVariants = [...variants];
    newVariants[index].value = value;
    setVariants(newVariants);
  };

  const updateVariantName = (index: number, name: string) => {
    const newVariants = [...variants];
    newVariants[index].name = name;
    setVariants(newVariants);
  };

  const getTotalPercentage = () => {
    return variants.reduce((sum, variant) => sum + variant.percentage, 0);
  };

  const handleSave = async () => {
    if (!test) return;

    const totalPercentage = getTotalPercentage();
    if (totalPercentage !== 100) {
      setError(`Traffic allocation must total 100% (currently ${totalPercentage}%)`);
      return;
    }

    try {
      setSaving(true);
      setError(null);

      await updateTestRollout(testId, {
        name,
        description,
        variants: variants.reduce((acc, variant) => {
          acc[variant.name] = {
            percentage: variant.percentage,
            value: variant.value
          };
          return acc;
        }, {} as Record<string, { percentage: number; value: any }>),
        conditions: conditions.length > 0 ? conditions.flatMap(rule => rule.conditions) : [],
        flagIds: targetFlags,
        archived,
      });

      markChangesDetected();
      router.push('/dashboard/tests');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update test');
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async (type: 'cancel' | 'complete') => {
    if (!test) return;

    try {
      await archiveTestRollout(testId, type);
      markChangesDetected();
      router.push('/dashboard/tests');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to archive test');
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress sx={{ mr: 2 }} />
        <Typography>Loading test...</Typography>
      </Box>
    );
  }

  if (error && !test) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <Alert severity="error" sx={{ mb: 3, maxWidth: 600, mx: 'auto' }}>
          {error}
        </Alert>
        <Button component={Link} href="/dashboard/tests">
          Back to Tests
        </Button>
      </Box>
    );
  }

  if (!test) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <Typography variant="h5" sx={{ mb: 2 }}>
          Test Not Found
        </Typography>
        <Button component={Link} href="/dashboard/tests">
          Back to Tests
        </Button>
      </Box>
    );
  }

  const isValid = name && getTotalPercentage() === 100;
  const hasChanges = name !== test.name || 
                    description !== (test.description || '') ||
                    JSON.stringify(targetFlags.sort()) !== JSON.stringify((test.flagIds || []).sort()) ||
                    JSON.stringify(variants) !== JSON.stringify(Object.entries(test.variants || {}).map(([name, data]: [string, any]) => ({
                      name,
                      percentage: data.percentage || 0,
                      value: data.value
                    })));

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Button
            startIcon={<ArrowBack />}
            component={Link}
            href="/dashboard/tests"
            sx={{ mr: 2 }}
          >
            Back to Tests
          </Button>
          <Box>
            <Typography variant="h4" component="h2" sx={{ mb: 1 }}>
              Edit A/B Test
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Modify the configuration for {test.name}
            </Typography>
          </Box>
        </Box>

        {!archived && (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              onClick={() => handleArchive('cancel')}
              color="error"
              size="small"
            >
              Cancel Test (0%)
            </Button>
            <Button
              variant="outlined"
              onClick={() => handleArchive('complete')}
              color="success"
              size="small"
            >
              Complete Test (100%)
            </Button>
          </Box>
        )}
      </Box>

      {archived && (
        <Alert severity="info" sx={{ mb: 3 }}>
          This test is archived and no longer active.
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Main Configuration */}
        <Grid item xs={12} md={8}>
          <Stack spacing={3}>
            {/* Basic Configuration */}
            <Card>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Basic Configuration
                </Typography>
                
                <Stack spacing={3}>
                  <TextField
                    label="Test Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    fullWidth
                    required
                    disabled={archived}
                  />

                  <TextField
                    label="Description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    multiline
                    rows={3}
                    fullWidth
                    disabled={archived}
                  />

                  <Autocomplete
                    multiple
                    options={flags}
                    getOptionLabel={(flag) => `${flag.displayName} (${flag.key})`}
                    value={flags.filter(flag => targetFlags.includes(flag.id))}
                    onChange={(_, newValue) => {
                      setTargetFlags(newValue.map(flag => flag.id));
                    }}
                    disabled={archived}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Target Flags"
                        helperText="Flags affected by this test"
                      />
                    )}
                    renderTags={(value, getTagProps) =>
                      value.map((flag, index) => (
                        <Chip
                          key={flag.id}
                          label={flag.displayName}
                          size="small"
                          {...getTagProps({ index })}
                        />
                      ))
                    }
                  />
                </Stack>
              </CardContent>
            </Card>

            {/* Variants Configuration */}
            <Card>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6">
                    Test Variants
                  </Typography>
                  {!archived && (
                    <Button
                      startIcon={<Add />}
                      onClick={addVariant}
                      size="small"
                      variant="outlined"
                    >
                      Add Variant
                    </Button>
                  )}
                </Box>

                <Stack spacing={2}>
                  {variants.map((variant, index) => (
                    <Paper key={index} variant="outlined" sx={{ p: 3 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                        <TextField
                          label="Variant Name"
                          value={variant.name}
                          onChange={(e) => updateVariantName(index, e.target.value)}
                          size="small"
                          sx={{ minWidth: 200 }}
                          disabled={archived}
                        />
                        {!archived && (
                          <IconButton
                            onClick={() => removeVariant(index)}
                            disabled={variants.length <= 2}
                            color="error"
                            size="small"
                          >
                            <Delete />
                          </IconButton>
                        )}
                      </Box>

                      <Box sx={{ mb: 2 }}>
                        <Typography variant="body2" sx={{ mb: 1 }}>
                          Traffic Allocation: {variant.percentage}%
                        </Typography>
                        <Slider
                          value={variant.percentage}
                          onChange={(_, value) => updateVariantPercentage(index, value as number)}
                          min={0}
                          max={100}
                          step={1}
                          disabled={archived}
                          marks={[
                            { value: 0, label: '0%' },
                            { value: 25, label: '25%' },
                            { value: 50, label: '50%' },
                            { value: 75, label: '75%' },
                            { value: 100, label: '100%' }
                          ]}
                          sx={{ mb: 1 }}
                        />
                      </Box>

                      <FlagValueInput
                        flagType="json"
                        value={variant.value}
                        onChange={(value) => updateVariantValue(index, value)}
                        label="Variant Value"
                        helperText="Value for this test variant - use JSON for complex values"
                        fullWidth
                        size="small"
                        disabled={archived}
                      />
                    </Paper>
                  ))}
                </Stack>

                <Box sx={{ mt: 2, p: 2, bgcolor: getTotalPercentage() === 100 ? 'success.light' : 'warning.light', borderRadius: 1 }}>
                  <Typography variant="body2" sx={{ textAlign: 'center' }}>
                    Total Traffic: {getTotalPercentage()}% 
                    {getTotalPercentage() !== 100 && (
                      <span style={{ color: 'red' }}> (Must equal 100%)</span>
                    )}
                  </Typography>
                </Box>
              </CardContent>
            </Card>

            {/* Entry Conditions */}
            <Card>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Entry Conditions
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Users must meet these conditions to enter the test
                </Typography>
                <RulesContainer
                  rules={conditions}
                  onChange={setConditions}
                  flagType="bool"
                  defaultValue={true}
                  appId={test?.appId || ''}
                  disabled={archived}
                />
              </CardContent>
            </Card>
          </Stack>
        </Grid>

        {/* Preview & Actions */}
        <Grid item xs={12} md={4}>
          <Stack spacing={3}>
            <Card>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Test Status
                </Typography>
                
                <Stack spacing={2}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Current Status
                    </Typography>
                    <Box sx={{ mt: 0.5 }}>
                      <Chip
                        label={archived ? 'Archived' : 'Active'}
                        color={archived ? 'default' : 'success'}
                        size="small"
                      />
                    </Box>
                  </Box>

                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Variants
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 0.5 }}>
                      {variants.map((variant, index) => (
                        <Box key={index} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="body2">
                            {variant.name}
                          </Typography>
                          <Chip
                            label={`${variant.percentage}%`}
                            size="small"
                            color="primary"
                            variant="outlined"
                          />
                        </Box>
                      ))}
                    </Box>
                  </Box>

                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Target Flags
                    </Typography>
                    <Typography variant="body2">
                      {targetFlags.length} flag{targetFlags.length === 1 ? '' : 's'} affected
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>

            {/* Actions */}
            <Stack spacing={2}>
              <Button
                variant="contained"
                startIcon={saving ? <CircularProgress size={20} /> : <Save />}
                onClick={handleSave}
                disabled={!isValid || !hasChanges || saving || archived}
                fullWidth
                size="large"
              >
                {saving ? 'Saving...' : !hasChanges ? 'No Changes to Save' : 'Save Changes'}
              </Button>
              <Button
                variant="outlined"
                component={Link}
                href="/dashboard/tests"
                fullWidth
              >
                Back to Tests
              </Button>
            </Stack>
          </Stack>
        </Grid>
      </Grid>
    </Box>
  );
}