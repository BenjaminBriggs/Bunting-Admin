'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  Box,
  Card,
  CardContent,
  Button,
  Typography,
  TextField,
  Slider,
  Stack,
  Grid,
  Chip,
  LinearProgress,
  Alert,
  Paper
} from '@mui/material';
import { ArrowBack, Save, Shuffle, Delete } from '@mui/icons-material';
import Link from 'next/link';

// Generate a random salt for cohort calculations
function generateSalt(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Normalize cohort identifier
function normalizeCohortId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

// Mock data for cohorts - would come from API
const mockCohorts = [
  {
    id: '1',
    name: 'Beta Users',
    identifier: 'beta_users',
    description: 'Users enrolled in beta testing program',
    percentage: 10,
    userCount: 1250,
    salt: 'abc123def456',
    updatedAt: '2025-09-11T15:30:00Z'
  },
  {
    id: '2',
    name: 'Premium Subscribers',
    identifier: 'premium_subscribers',
    description: 'Users with active premium subscriptions',
    percentage: 25,
    userCount: 3200,
    salt: 'xyz789uvw012',
    updatedAt: '2025-09-11T14:20:00Z'
  },
  {
    id: '3',
    name: 'Early Adopters',
    identifier: 'early_adopters',
    description: 'Users who signed up in the first month',
    percentage: 5,
    userCount: 680,
    salt: 'mno345pqr678',
    updatedAt: '2025-09-10T10:15:00Z'
  }
];

export default function EditCohortPage() {
  const params = useParams();
  const cohortId = params?.id as string;
  
  const [loading, setLoading] = useState(true);
  const [cohort, setCohort] = useState<any>(null);
  const [name, setName] = useState('');
  const [originalName, setOriginalName] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [originalIdentifier, setOriginalIdentifier] = useState('');
  const [description, setDescription] = useState('');
  const [percentage, setPercentage] = useState(10);
  const [salt, setSalt] = useState('');
  const [estimatedUsers, setEstimatedUsers] = useState(0);

  // Mock total user count - would come from API
  const totalUsers = 12500;

  useEffect(() => {
    // Mock API call - replace with actual API
    const loadCohort = () => {
      const foundCohort = mockCohorts.find(c => c.id === cohortId);
      if (foundCohort) {
        setCohort(foundCohort);
        setName(foundCohort.name);
        setOriginalName(foundCohort.name);
        setIdentifier(foundCohort.identifier);
        setOriginalIdentifier(foundCohort.identifier);
        setDescription(foundCohort.description || '');
        setPercentage(foundCohort.percentage);
        setSalt(foundCohort.salt);
        setEstimatedUsers(Math.round(totalUsers * (foundCohort.percentage / 100)));
      }
      setLoading(false);
    };

    loadCohort();
  }, [cohortId]);

  const handleNameChange = (value: string) => {
    setName(value);
    setIdentifier(normalizeCohortId(value));
  };

  const handlePercentageChange = (_: Event, newValue: number | number[]) => {
    const newPercentage = Array.isArray(newValue) ? newValue[0] : newValue;
    setPercentage(newPercentage);
    setEstimatedUsers(Math.round(totalUsers * (newPercentage / 100)));
  };

  const handleGenerateNewSalt = () => {
    setSalt(generateSalt());
  };

  const handleSave = async () => {
    const updatedCohort = {
      ...cohort,
      name,
      identifier,
      description,
      percentage,
      salt,
      estimatedUsers
    };

    console.log('Would update cohort:', updatedCohort);
    // TODO: Implement API call to update cohort
  };

  const handleDelete = async () => {
    if (confirm('Are you sure you want to delete this cohort? This action cannot be undone.')) {
      console.log('Would delete cohort:', cohortId);
      // TODO: Implement API call to delete cohort
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <Typography>Loading cohort...</Typography>
      </Box>
    );
  }

  if (!cohort) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <Typography variant="h5" sx={{ mb: 2 }}>Cohort Not Found</Typography>
        <Button component={Link} href="/dashboard/cohorts">
          Back to Cohorts
        </Button>
      </Box>
    );
  }

  const isValid = name && percentage > 0 && percentage <= 100;
  const hasChanges = name !== originalName || 
                    description !== (cohort.description || '') ||
                    percentage !== cohort.percentage ||
                    salt !== cohort.salt;

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Button
            startIcon={<ArrowBack />}
            component={Link}
            href="/dashboard/cohorts"
            sx={{ mr: 2 }}
          >
            Back to Cohorts
          </Button>
          <Box>
            <Typography variant="h4" component="h2" sx={{ mb: 1 }}>
              Edit Cohort
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Modify the configuration for {cohort.name}
            </Typography>
          </Box>
        </Box>

        <Button
          variant="outlined"
          startIcon={<Delete />}
          onClick={handleDelete}
          color="error"
        >
          Delete
        </Button>
      </Box>

      <Grid container spacing={3}>
        {/* Main Configuration */}
        <Grid item xs={12} md={8}>
          <Stack spacing={3}>
            <Card>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Basic Configuration
                </Typography>
                
                <Stack spacing={3}>
                  {/* Name */}
                  <TextField
                    label="Cohort Name"
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="e.g., Beta Users"
                    helperText="Human-readable name for this cohort"
                    fullWidth
                    required
                  />

                  {/* Auto-generated Identifier Display */}
                  <Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      Auto-generated Identifier
                    </Typography>
                    <Box
                      sx={{
                        fontFamily: 'monospace',
                        fontSize: '0.875rem',
                        bgcolor: 'grey.100',
                        p: 1.5,
                        borderRadius: 1,
                        border: '1px solid',
                        borderColor: 'divider'
                      }}
                    >
                      {identifier}
                    </Box>

                    {originalIdentifier !== identifier && (
                      <Alert severity="warning" sx={{ mt: 2 }}>
                        <Typography variant="body2" sx={{ fontWeight: 500, mb: 1 }}>
                          Identifier will change from <code>{originalIdentifier}</code> to <code>{identifier}</code>
                        </Typography>
                        <Typography variant="body2">
                          This will require updating your code that references this cohort. Make sure to update all places where you use this cohort before publishing.
                        </Typography>
                      </Alert>
                    )}
                  </Box>

                  {/* Description */}
                  <TextField
                    label="Description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe the purpose of this cohort"
                    multiline
                    rows={3}
                    fullWidth
                  />

                  {/* Percentage Slider */}
                  <Box>
                    <Typography variant="body1" sx={{ mb: 2 }}>
                      Rollout Percentage: {percentage}%
                    </Typography>
                    <Slider
                      value={percentage}
                      onChange={handlePercentageChange}
                      step={1}
                      min={1}
                      max={100}
                      valueLabelDisplay="auto"
                      marks={[
                        { value: 1, label: '1%' },
                        { value: 25, label: '25%' },
                        { value: 50, label: '50%' },
                        { value: 75, label: '75%' },
                        { value: 100, label: '100%' }
                      ]}
                    />
                  </Box>

                  {/* Salt Configuration */}
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                      <Typography variant="body1">
                        Salt Value
                      </Typography>
                      <Button
                        size="small"
                        startIcon={<Shuffle />}
                        onClick={handleGenerateNewSalt}
                      >
                        Generate New
                      </Button>
                    </Box>
                    <TextField
                      value={salt}
                      onChange={(e) => setSalt(e.target.value)}
                      fullWidth
                      InputProps={{
                        sx: { fontFamily: 'monospace' }
                      }}
                      helperText="Random string used for consistent user assignment to cohorts"
                    />
                    <Alert severity="info" sx={{ mt: 2 }}>
                      The salt ensures users are consistently assigned to the same cohort across sessions. 
                      Changing the salt will reassign users to different cohorts.
                    </Alert>
                  </Box>
                </Stack>
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
                  Preview
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  How this cohort will appear in your configuration
                </Typography>
                
                <Stack spacing={2}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Name
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                      {name}
                    </Typography>
                  </Box>
                  
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Identifier
                    </Typography>
                    <Box
                      sx={{
                        fontFamily: 'monospace',
                        fontSize: '0.875rem',
                        bgcolor: 'grey.100',
                        p: 1,
                        borderRadius: 1,
                        mt: 0.5
                      }}
                    >
                      {identifier}
                    </Box>
                  </Box>

                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Coverage
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                      <Chip 
                        label={`${percentage}%`}
                        size="small"
                        color="primary"
                      />
                      <Typography variant="body2" color="text.secondary">
                        of users
                      </Typography>
                    </Box>
                  </Box>
                  
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      JSON Configuration
                    </Typography>
                    <Box
                      component="pre"
                      sx={{
                        fontFamily: 'monospace',
                        fontSize: '0.75rem',
                        bgcolor: 'grey.100',
                        p: 1.5,
                        borderRadius: 1,
                        mt: 0.5,
                        overflow: 'auto',
                        whiteSpace: 'pre-wrap'
                      }}
                    >
                      {JSON.stringify({
                        [identifier]: {
                          percentage,
                          salt,
                          ...(description && { description })
                        }
                      }, null, 2)}
                    </Box>
                  </Box>
                </Stack>
              </CardContent>
            </Card>

            {/* Change Summary */}
            {hasChanges && (
              <Card>
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    Pending Changes
                  </Typography>
                  <Stack spacing={1}>
                    {name !== originalName && (
                      <Typography variant="body2">
                        • Name: <code>{originalName}</code> → <code>{name}</code>
                      </Typography>
                    )}
                    {identifier !== originalIdentifier && (
                      <Typography variant="body2">
                        • Identifier: <code>{originalIdentifier}</code> → <code>{identifier}</code>
                      </Typography>
                    )}
                    {description !== (cohort.description || '') && (
                      <Typography variant="body2">
                        • Description updated
                      </Typography>
                    )}
                    {percentage !== cohort.percentage && (
                      <Typography variant="body2">
                        • Percentage: <code>{cohort.percentage}%</code> → <code>{percentage}%</code>
                      </Typography>
                    )}
                    {salt !== cohort.salt && (
                      <Typography variant="body2">
                        • Salt regenerated
                      </Typography>
                    )}
                  </Stack>
                </CardContent>
              </Card>
            )}

            {/* Actions */}
            <Stack spacing={2}>
              <Button
                variant="contained"
                startIcon={<Save />}
                onClick={handleSave}
                disabled={!isValid || !hasChanges}
                fullWidth
                size="large"
              >
                {!hasChanges ? 'No Changes to Save' : 'Save Changes'}
              </Button>
              <Button
                variant="outlined"
                component={Link}
                href="/dashboard/cohorts"
                fullWidth
              >
                Cancel
              </Button>
            </Stack>
          </Stack>
        </Grid>
      </Grid>
    </Box>
  );
}