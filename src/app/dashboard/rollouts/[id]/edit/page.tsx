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
  CircularProgress,
  Autocomplete,
  Slider,
  Paper,
} from '@mui/material';
import { ArrowBack, Save, Pause, PlayArrow, CheckCircle, Cancel } from '@mui/icons-material';
import Link from 'next/link';
import { fetchTestRollout, updateTestRollout, archiveTestRollout, fetchFlags } from '@/lib/api';
import { useChanges } from '@/lib/changes-context';
import { TargetingRule } from '@/types/rules';
import { RulesContainer } from '@/components';

export default function EditRolloutPage() {
  const params = useParams();
  const router = useRouter();
  const { markChangesDetected } = useChanges();
  const rolloutId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rollout, setRollout] = useState<any>(null);
  
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [percentage, setPercentage] = useState(0);
  const [targetFlags, setTargetFlags] = useState<string[]>([]);
  const [conditions, setConditions] = useState<TargetingRule[]>([]);
  const [archived, setArchived] = useState(false);
  
  const [flags, setFlags] = useState<any[]>([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const rolloutData = await fetchTestRollout(rolloutId);
        const flagsData = await fetchFlags(rolloutData?.appId || '');
        
        setRollout(rolloutData);
        setFlags(flagsData);
        setName(rolloutData.name);
        setDescription(rolloutData.description || '');
        setPercentage(rolloutData.percentage || 0);
        setTargetFlags(rolloutData.flagIds || []);
        setArchived(rolloutData.archived);
        
        setConditions(rolloutData.conditions ? [{
          enabled: true,
          conditions: rolloutData.conditions,
          conditionLogic: 'AND',
          value: true,
          priority: 1
        }] : []);
        
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load rollout');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [rolloutId]);

  const handlePercentageChange = (_: Event, newValue: number | number[]) => {
    const newPercentage = Array.isArray(newValue) ? newValue[0] : newValue;
    setPercentage(newPercentage);
  };

  const handleSave = async () => {
    if (!rollout) return;

    try {
      setSaving(true);
      setError(null);

      await updateTestRollout(rolloutId, {
        name,
        description,
        percentage,
        conditions: conditions.length > 0 ? conditions.flatMap(rule => rule.conditions) : [],
        flagIds: targetFlags,
        archived,
      });

      markChangesDetected();
      router.push('/dashboard/rollouts');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update rollout');
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async (type: 'cancel' | 'complete') => {
    if (!rollout) return;

    try {
      await archiveTestRollout(rolloutId, type);
      markChangesDetected();
      router.push('/dashboard/rollouts');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to archive rollout');
    }
  };

  const getPercentageColor = () => {
    if (percentage === 0) return 'warning';
    if (percentage === 100) return 'success';
    return 'primary';
  };

  const getStatusChip = () => {
    if (archived) return { label: 'Archived', color: 'default' as const };
    if (percentage === 0) return { label: 'Paused', color: 'warning' as const };
    if (percentage === 100) return { label: 'Complete', color: 'success' as const };
    return { label: 'Active', color: 'success' as const };
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress sx={{ mr: 2 }} />
        <Typography>Loading rollout...</Typography>
      </Box>
    );
  }

  if (error && !rollout) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <Alert severity="error" sx={{ mb: 3, maxWidth: 600, mx: 'auto' }}>
          {error}
        </Alert>
        <Button component={Link} href="/dashboard/rollouts">
          Back to Rollouts
        </Button>
      </Box>
    );
  }

  if (!rollout) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <Typography variant="h5" sx={{ mb: 2 }}>
          Rollout Not Found
        </Typography>
        <Button component={Link} href="/dashboard/rollouts">
          Back to Rollouts
        </Button>
      </Box>
    );
  }

  const isValid = name && percentage >= 0 && percentage <= 100;
  const hasChanges = name !== rollout.name || 
                    description !== (rollout.description || '') ||
                    percentage !== (rollout.percentage || 0) ||
                    JSON.stringify(targetFlags.sort()) !== JSON.stringify((rollout.flagIds || []).sort());

  const statusChip = getStatusChip();

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Button
            startIcon={<ArrowBack />}
            component={Link}
            href="/dashboard/rollouts"
            sx={{ mr: 2 }}
          >
            Back to Rollouts
          </Button>
          <Box>
            <Typography variant="h4" component="h2" sx={{ mb: 1 }}>
              Edit Rollout
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Modify the configuration for {rollout.name}
            </Typography>
          </Box>
        </Box>

        {!archived && (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              onClick={() => handleArchive('cancel')}
              startIcon={<Cancel />}
              color="error"
              size="small"
            >
              Cancel (0%)
            </Button>
            <Button
              variant="outlined"
              onClick={() => handleArchive('complete')}
              startIcon={<CheckCircle />}
              color="success"
              size="small"
            >
              Complete (100%)
            </Button>
          </Box>
        )}
      </Box>

      {archived && (
        <Alert severity="info" sx={{ mb: 3 }}>
          This rollout is archived and no longer active.
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
                    label="Rollout Name"
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
                        helperText="Flags affected by this rollout"
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

            {/* Rollout Percentage */}
            <Card>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Rollout Percentage
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Control what percentage of eligible users receive the new features
                </Typography>

                <Box sx={{ px: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="subtitle1">
                      Current Rollout
                    </Typography>
                    <Typography variant="h4" color={`${getPercentageColor()}.main`}>
                      {percentage}%
                    </Typography>
                  </Box>
                  
                  <Slider
                    value={percentage}
                    onChange={handlePercentageChange}
                    min={0}
                    max={100}
                    step={5}
                    disabled={archived}
                    marks={[
                      { value: 0, label: '0%' },
                      { value: 25, label: '25%' },
                      { value: 50, label: '50%' },
                      { value: 75, label: '75%' },
                      { value: 100, label: '100%' },
                    ]}
                    sx={{
                      color: percentage === 0 ? 'warning.main' : 
                             percentage === 100 ? 'success.main' : 'primary.main',
                      '& .MuiSlider-thumb': {
                        width: 20,
                        height: 20,
                      },
                      '& .MuiSlider-track': {
                        height: 6,
                      },
                      '& .MuiSlider-rail': {
                        height: 6,
                      }
                    }}
                  />

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      {percentage === 0 && 'Rollout paused - no users will see new features'}
                      {percentage > 0 && percentage < 100 && `${percentage}% of eligible users will see new features`}
                      {percentage === 100 && 'Full rollout - all eligible users will see new features'}
                    </Typography>
                  </Box>
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
                  Users must meet these conditions to be eligible for the rollout
                </Typography>
                <RulesContainer
                  rules={conditions}
                  onChange={setConditions}
                  flagType="bool"
                  defaultValue={true}
                  appId={rollout?.appId || ''}
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
                  Rollout Status
                </Typography>
                
                <Stack spacing={2}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Current Status
                    </Typography>
                    <Box sx={{ mt: 0.5 }}>
                      <Chip
                        label={statusChip.label}
                        color={statusChip.color}
                        size="small"
                      />
                    </Box>
                  </Box>

                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Progress
                    </Typography>
                    <Box sx={{ mt: 1 }}>
                      <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50' }}>
                        <Box
                          sx={{
                            width: '100%',
                            height: 8,
                            bgcolor: 'grey.200',
                            borderRadius: 1,
                            overflow: 'hidden',
                          }}
                        >
                          <Box
                            sx={{
                              width: `${percentage}%`,
                              height: '100%',
                              bgcolor: percentage === 0 ? 'warning.main' : 
                                      percentage === 100 ? 'success.main' : 'primary.main',
                              transition: 'width 0.3s ease',
                            }}
                          />
                        </Box>
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block', textAlign: 'center' }}>
                          {percentage}% of eligible users
                        </Typography>
                      </Paper>
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

                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Entry Conditions
                    </Typography>
                    <Typography variant="body2">
                      {conditions.length === 0 ? 'All users eligible' : `${conditions.length} targeting rule${conditions.length === 1 ? '' : 's'}`}
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
                href="/dashboard/rollouts"
                fullWidth
              >
                Back to Rollouts
              </Button>
            </Stack>
          </Stack>
        </Grid>
      </Grid>
    </Box>
  );
}