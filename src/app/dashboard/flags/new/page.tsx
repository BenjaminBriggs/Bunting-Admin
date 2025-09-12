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
  Collapse,
  IconButton,
  Paper,
  CircularProgress
} from '@mui/material';
import { ArrowBack, Save, ExpandMore, ExpandLess, CheckCircle, Error as ErrorIcon } from '@mui/icons-material';
import Link from 'next/link';
import { normalizeKey, validateKey } from '@/lib/utils';
import { TargetingRule } from '@/types/rules';
import { RulesContainer } from '@/components/rule-builder/rules-container';
import { createFlag } from '@/lib/api';
import { useApp } from '@/lib/app-context';
import { useChanges } from '@/lib/changes-context';

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
  const [defaultValue, setDefaultValue] = useState('false');
  const [description, setDescription] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [jsonExpanded, setJsonExpanded] = useState(false);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [rules, setRules] = useState<TargetingRule[]>([]);
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

  const getDefaultValueForType = (flagType: string) => {
    switch (flagType) {
      case 'bool': return 'false';
      case 'string': return '';
      case 'int': return '0';
      case 'double': return '0.0';
      case 'date': return new Date().toISOString().split('T')[0];
      case 'json': return '{}';
      default: return '';
    }
  };

  const handleTypeChange = (newType: string) => {
    setType(newType);
    const newDefaultValue = getDefaultValueForType(newType);
    setDefaultValue(newDefaultValue);
    setJsonError(null);
    setJsonExpanded(false);
    
    // Update existing rule values to match new type
    const updatedRules = rules.map(rule => ({
      ...rule,
      value: newDefaultValue
    }));
    setRules(updatedRules);
  };

  const validateJSON = (jsonString: string): string | null => {
    try {
      JSON.parse(jsonString);
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : 'Invalid JSON';
    }
  };

  const getJSONSummary = (jsonString: string): string => {
    try {
      const parsed = JSON.parse(jsonString);
      if (typeof parsed === 'object' && parsed !== null) {
        const keys = Object.keys(parsed);
        if (keys.length === 0) return '{}';
        if (keys.length === 1) return `{ ${keys[0]}: ... }`;
        return `{ ${keys[0]}, ${keys[1]}${keys.length > 2 ? ', ...' : ''} }`;
      }
      return jsonString.length > 30 ? jsonString.substring(0, 30) + '...' : jsonString;
    } catch {
      return jsonString.length > 30 ? jsonString.substring(0, 30) + '...' : jsonString;
    }
  };

  const handleJSONChange = (value: string) => {
    setDefaultValue(value);
    const error = validateJSON(value);
    setJsonError(error);
  };

  const handleSave = async () => {
    if (validationError || !selectedApp) return;
    
    setSaving(true);
    setSaveError(null);
    
    try {
      const processedDefaultValue = type === 'bool' ? defaultValue === 'true' : 
                                   type === 'int' ? parseInt(defaultValue) :
                                   type === 'double' ? parseFloat(defaultValue) :
                                   type === 'json' ? JSON.parse(defaultValue) : defaultValue;

      await createFlag({
        appId: selectedApp.id,
        key: normalizedKey,
        displayName,
        type,
        defaultValue: processedDefaultValue,
        description,
        rules: rules
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

  const isValid = !validationError && !jsonError && displayName && defaultValue !== '' && selectedApp;

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Button
          startIcon={<ArrowBack />}
          component={Link}
          href="/dashboard/flags"
          sx={{ mr: 2 }}
        >
          Back to Flags
        </Button>
        <Box>
          <Typography variant="h4" component="h2" sx={{ mb: 1 }}>
            Create Feature Flag
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Define a new feature flag with its default configuration
          </Typography>
        </Box>
      </Box>

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


                  {/* Type and Default Value */}
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <FormControl sx={{ minWidth: 200 }}>
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

                    {type === 'bool' ? (
                      <FormControl sx={{ flexGrow: 1 }}>
                        <InputLabel>Default Value</InputLabel>
                        <Select
                          value={defaultValue}
                          label="Default Value"
                          onChange={(e) => setDefaultValue(e.target.value)}
                        >
                          <MenuItem value="false">false</MenuItem>
                          <MenuItem value="true">true</MenuItem>
                        </Select>
                      </FormControl>
                    ) : type === 'json' ? (
                      <Box sx={{ flexGrow: 1 }}>
                        <Paper 
                          variant="outlined" 
                          sx={{ 
                            p: 1, 
                            cursor: 'pointer',
                            '&:hover': { bgcolor: 'grey.50' }
                          }}
                          onClick={() => setJsonExpanded(!jsonExpanded)}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexGrow: 1 }}>
                              <Typography variant="body2" color="text.secondary">
                                JSON Value:
                              </Typography>
                              <Typography 
                                variant="body2" 
                                sx={{ 
                                  fontFamily: 'monospace',
                                  flexGrow: 1,
                                  color: jsonError ? 'error.main' : 'text.primary'
                                }}
                              >
                                {getJSONSummary(defaultValue)}
                              </Typography>
                              {jsonError ? (
                                <ErrorIcon color="error" sx={{ fontSize: 16 }} />
                              ) : (
                                <CheckCircle color="success" sx={{ fontSize: 16 }} />
                              )}
                            </Box>
                            <IconButton size="small">
                              {jsonExpanded ? <ExpandLess /> : <ExpandMore />}
                            </IconButton>
                          </Box>
                        </Paper>
                        
                        <Collapse in={jsonExpanded}>
                          <Box sx={{ mt: 1 }}>
                            <TextField
                              multiline
                              rows={6}
                              value={defaultValue}
                              onChange={(e) => handleJSONChange(e.target.value)}
                              placeholder='{\n  "enabled": true,\n  "limit": 100\n}'
                              fullWidth
                              error={Boolean(jsonError)}
                              helperText={jsonError || "Enter valid JSON"}
                              InputProps={{
                                sx: { fontFamily: 'monospace', fontSize: '0.875rem' }
                              }}
                            />
                          </Box>
                        </Collapse>
                      </Box>
                    ) : (
                      <TextField
                        label="Default Value"
                        value={defaultValue}
                        onChange={(e) => setDefaultValue(e.target.value)}
                        sx={{ flexGrow: 1 }}
                        required
                        helperText="Value returned when no targeting rules match"
                        type={type === 'int' || type === 'double' ? 'number' : 
                             type === 'date' ? 'date' : 'text'}
                      />
                    )}
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

            {/* Targeting Rules */}
            <RulesContainer
              rules={rules}
              onChange={setRules}
              flagType={type as any}
              defaultValue={type === 'bool' ? defaultValue === 'true' : 
                           type === 'int' ? parseInt(defaultValue) :
                           type === 'double' ? parseFloat(defaultValue) :
                           type === 'json' ? (jsonError ? defaultValue : JSON.parse(defaultValue)) : defaultValue}
              appId={selectedApp?.id || ''}
            />
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
                          [normalizedKey]: {
                            type,
                            default: type === 'bool' ? defaultValue === 'true' : 
                                     type === 'int' ? parseInt(defaultValue) :
                                     type === 'double' ? parseFloat(defaultValue) :
                                     type === 'json' ? (jsonError ? defaultValue : JSON.parse(defaultValue)) : defaultValue,
                            rules: rules.map(rule => ({
                              enabled: rule.enabled,
                              conditions: rule.conditions.map(condition => ({
                                type: condition.type,
                                operator: condition.operator,
                                values: condition.values
                              })),
                              conditionLogic: rule.conditionLogic,
                              value: rule.value,
                              priority: rule.priority
                            })),
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