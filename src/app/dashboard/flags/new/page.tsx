'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
  Alert,
  Chip,
  Stack,
  Divider,
  Grid,
  CircularProgress,
  Tabs,
  Tab
} from '@mui/material';
import { Save } from '@mui/icons-material';
import { normalizeKey, validateKey } from '@/lib/utils';
import { createFlag } from '@/lib/api';
import { useApp } from '@/lib/app-context';
import { useChanges } from '@/lib/changes-context';
import { PageHeader } from '@/components';
import FlagValueInput, { getDefaultValueForType, processValueForType, validateValue } from '@/components/features/flags/flag-value-input';
import Link from 'next/link';

const flagTypes = [
  { value: 'bool', label: 'Boolean' },
  { value: 'string', label: 'String' },
  { value: 'int', label: 'Integer' },
  { value: 'double', label: 'Double' },
  { value: 'date', label: 'Date' },
  { value: 'json', label: 'JSON' }
];

export default function NewFlagPage() {
  const router = useRouter();
  const { selectedApp } = useApp();
  const { markChangesDetected } = useChanges();
  const [displayName, setDisplayName] = useState('');
  const [key, setKey] = useState('');
  const [normalizedKey, setNormalizedKey] = useState('');
  const [type, setType] = useState('bool');
  const [defaultValues, setDefaultValues] = useState({
    development: false,
    staging: false, 
    production: false
  });
  const [activeTab, setActiveTab] = useState(0);
  const [description, setDescription] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Redirect if no app is selected
  useEffect(() => {
    if (!selectedApp) {
      router.push('/dashboard');
    }
  }, [selectedApp, router]);

  const handleDisplayNameChange = (value: string) => {
    setDisplayName(value);
    const normalized = normalizeKey(value);
    setKey(value);
    setNormalizedKey(normalized);
    
    const validation = validateKey(normalized);
    setValidationError(validation.valid ? null : validation.error || 'Invalid key');
  };


  const handleTypeChange = (newType: string) => {
    setType(newType);
    const newDefaultValue = getDefaultValueForType(newType as any);
    setDefaultValues({
      development: newDefaultValue,
      staging: newDefaultValue,
      production: newDefaultValue
    });
  };

  const handleEnvironmentValueChange = (environment: string, value: any) => {
    setDefaultValues(prev => ({ ...prev, [environment]: value }));
  };

  const getCurrentEnvironment = () => {
    const environments = ['development', 'staging', 'production'];
    return environments[activeTab];
  };

  const getEnvironmentColor = (env: string) => {
    switch (env) {
      case 'development': return 'info';
      case 'staging': return 'warning'; 
      case 'production': return 'success';
      default: return 'default';
    }
  };



  const handleSave = async () => {
    if (validationError || !selectedApp) return;
    
    // Validate all environment values
    const hasValidationErrors = ['development', 'staging', 'production'].some(env => {
      const value = defaultValues[env as keyof typeof defaultValues];
      return !validateValue(value, type as any).isValid;
    });
    if (hasValidationErrors) return;
    
    setSaving(true);
    setSaveError(null);
    
    try {
      const processDefaultValues = () => {
        const processed: any = {};
        ['development', 'staging', 'production'].forEach(env => {
          const value = defaultValues[env as keyof typeof defaultValues];
          processed[env] = processValueForType(value, type as any);
        });
        return processed;
      };

      await createFlag({
        appId: selectedApp.id,
        key: normalizedKey,
        displayName,
        type,
        defaultValues: processDefaultValues(),
        description
      });

      // Trigger change detection
      markChangesDetected();
      router.push('/dashboard/flags');
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to create flag');
    } finally {
      setSaving(false);
    }
  };

  const isValid = !validationError && 
                 displayName && 
                 ['development', 'staging', 'production'].every(env => {
                   const value = defaultValues[env as keyof typeof defaultValues];
                   return validateValue(value, type as any).isValid;
                 }) && 
                 selectedApp;

  return (
    <Box>
      <PageHeader
        title="Create Feature Flag"
        subtitle="Define a new feature flag with environment-specific default values"
        backHref="/dashboard/flags"
        backLabel="Back to Flags"
      />

      {/* Error Alert */}
      {saveError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {saveError}
        </Alert>
      )}

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
                  {/* Display Name */}
                  <TextField
                    label="Display Name"
                    value={displayName}
                    onChange={(e) => handleDisplayNameChange(e.target.value)}
                    placeholder="e.g., Store / Use New Paywall Design"
                    helperText="Human-readable name that will appear in the dashboard"
                    fullWidth
                    required
                  />


                  {/* Type Selection */}
                  <FormControl sx={{ maxWidth: 200 }}>
                    <InputLabel>Type</InputLabel>
                    <Select
                      value={type}
                      label="Type"
                      onChange={(e) => handleTypeChange(e.target.value)}
                    >
                      {flagTypes.map((flagType) => (
                        <MenuItem key={flagType.value} value={flagType.value}>
                          {flagType.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <Divider />

                  {/* Environment-Specific Default Values */}
                  <Box>
                    <Typography variant="h6" sx={{ mb: 2 }}>
                      Environment Default Values
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Set different default values for each environment
                    </Typography>
                    
                    <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)} sx={{ mb: 3 }}>
                      <Tab label="Development" />
                      <Tab label="Staging" />
                      <Tab label="Production" />
                    </Tabs>

                    {['development', 'staging', 'production'].map((env, index) => (
                      <Box key={env} sx={{ display: index === activeTab ? 'block' : 'none' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                          <Chip 
                            label={env.charAt(0).toUpperCase() + env.slice(1)} 
                            size="small" 
                            color={getEnvironmentColor(env)}
                          />
                          <Typography variant="body2" color="text.secondary">
                            Default value for {env} environment
                          </Typography>
                        </Box>
                        
                        <FlagValueInput
                          flagType={type as any}
                          value={defaultValues[env as keyof typeof defaultValues]}
                          onChange={(value) => handleEnvironmentValueChange(env, value)}
                          label="Default Value"
                          helperText="Value returned when no targeting rules match"
                          fullWidth
                          required
                        />
                      </Box>
                    ))}
                  </Box>



                  {/* Description */}
                  <TextField
                    label="Description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe what this flag controls and when it should be used"
                    multiline
                    rows={3}
                    fullWidth
                  />
                </Stack>
              </CardContent>
            </Card>

          </Stack>
        </Grid>

        {/* Preview & Actions */}
        <Grid item xs={12} md={4}>
          <Box sx={{ position: 'sticky', top: 24 }}>
            <Stack spacing={3}>
              <Card>
                <CardContent sx={{ p: 3, maxHeight: 'calc(100vh - 100px)', overflow: 'auto' }}>
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    Preview
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    How this flag will appear in your configuration
                  </Typography>
                
                {displayName ? (
                  <Stack spacing={2}>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Display Name
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 500 }}>
                        {displayName}
                      </Typography>
                    </Box>
                    
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Auto-generated Key
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
                        {normalizedKey}
                      </Box>
                    </Box>
                    
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        JSON Configuration (Environment-First)
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
                          [normalizedKey]: {
                            type,
                            defaultValues: (() => {
                              const processed: any = {};
                              ['development', 'staging', 'production'].forEach(env => {
                                const value = defaultValues[env as keyof typeof defaultValues];
                                processed[env] = processValueForType(value, type as any);
                              });
                              return processed;
                            })(),
                            variants: {
                              development: [],
                              staging: [],
                              production: []
                            },
                            ...(description && { description })
                          }
                        }, null, 2)}
                      </Box>
                    </Box>
                  </Stack>
                ) : (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                      Enter a flag name to see preview
                    </Typography>
                  </Box>
                )}
              </CardContent>
            </Card>

            {/* Actions */}
            <Stack spacing={2}>
              <Button
                variant="contained"
                startIcon={saving ? <CircularProgress size={20} /> : <Save />}
                onClick={handleSave}
                disabled={!isValid || saving}
                fullWidth
              >
                {saving ? 'Creating...' : 'Create Flag'}
              </Button>
              <Button
                variant="outlined"
                component={Link}
                href="/dashboard/flags"
                fullWidth
              >
                Cancel
              </Button>
            </Stack>
          </Stack>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
}