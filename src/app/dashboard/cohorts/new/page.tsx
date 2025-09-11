'use client';

import { useState } from 'react';
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
  Alert,
  Chip,
  LinearProgress
} from '@mui/material';
import { ArrowBack, Save, Shuffle } from '@mui/icons-material';
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

export default function NewCohortPage() {
  const [name, setName] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [description, setDescription] = useState('');
  const [percentage, setPercentage] = useState(10);
  const [salt, setSalt] = useState(generateSalt());
  const [estimatedUsers, setEstimatedUsers] = useState(0);

  // Mock total user count - would come from API
  const totalUsers = 12500;

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
    const cohort = {
      name,
      identifier,
      description,
      percentage,
      salt,
      estimatedUsers
    };

    console.log('Would save cohort:', cohort);
    // TODO: Implement API call to save cohort
  };

  const isValid = name && percentage > 0 && percentage <= 100;

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
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
            Create Cohort
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Define a user group for percentage-based feature rollouts
          </Typography>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {/* Main Configuration */}
        <Grid item xs={12} md={8}>
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
                
{name ? (
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
                        Auto-generated Identifier
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
) : (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                      Enter a cohort name to see preview
                    </Typography>
                  </Box>
                )}
              </CardContent>
            </Card>

            {/* Actions */}
            <Stack spacing={2}>
              <Button
                variant="contained"
                startIcon={<Save />}
                onClick={handleSave}
                disabled={!isValid}
                fullWidth
              >
                Create Cohort
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