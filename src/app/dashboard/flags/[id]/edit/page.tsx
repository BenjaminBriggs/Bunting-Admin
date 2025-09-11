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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Chip,
  Stack,
  Grid,
  Switch,
  FormControlLabel,
  Collapse,
  IconButton,
  Paper
} from '@mui/material';
import { ArrowBack, Save, Archive, Delete, ExpandMore, ExpandLess, CheckCircle, Error as ErrorIcon } from '@mui/icons-material';
import Link from 'next/link';
import { normalizeKey, validateKey } from '@/lib/utils';
import { TargetingRule } from '@/types/rules';
import { RulesContainer } from '@/components/rule-builder/rules-container';

const flagTypes = [
  { value: 'bool', label: 'Boolean' },
  { value: 'string', label: 'String' },
  { value: 'int', label: 'Integer' },
  { value: 'double', label: 'Double' },
  { value: 'date', label: 'Date' },
  { value: 'json', label: 'JSON' }
];

// Mock data - would come from API
const mockFlags = [
  {
    id: '1',
    key: 'store/use_new_paywall_design',
    displayName: 'Store / Use New Paywall Design',
    type: 'bool' as const,
    defaultValue: false,
    description: 'Enable the new paywall UI design',
    archived: false,
    updatedAt: '2025-09-11T15:30:00Z',
    rules: []
  },
  {
    id: '2', 
    key: 'onboarding/show_welcome_banner',
    displayName: 'Onboarding / Show Welcome Banner',
    type: 'bool' as const,
    defaultValue: true,
    description: 'Display welcome banner for new users',
    archived: false,
    updatedAt: '2025-09-11T14:20:00Z',
    rules: []
  },
  {
    id: '3',
    key: 'checkout/retry_limit',
    displayName: 'Checkout / Retry Limit',
    type: 'int' as const,
    defaultValue: 3,
    description: 'Maximum number of payment retry attempts',
    archived: true,
    updatedAt: '2025-09-10T10:15:00Z',
    rules: []
  }
];

export default function EditFlagPage() {
  const params = useParams();
  const flagId = params?.id as string;
  
  const [loading, setLoading] = useState(true);
  const [flag, setFlag] = useState<any>(null);
  const [displayName, setDisplayName] = useState('');
  const [key, setKey] = useState('');
  const [originalKey, setOriginalKey] = useState('');
  const [normalizedKey, setNormalizedKey] = useState('');
  const [type, setType] = useState('bool');
  const [defaultValue, setDefaultValue] = useState('false');
  const [description, setDescription] = useState('');
  const [archived, setArchived] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [jsonExpanded, setJsonExpanded] = useState(false);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [rules, setRules] = useState<TargetingRule[]>([]);

  useEffect(() => {
    // Mock API call - replace with actual API
    const loadFlag = () => {
      const foundFlag = mockFlags.find(f => f.id === flagId);
      if (foundFlag) {
        setFlag(foundFlag);
        setDisplayName(foundFlag.displayName);
        setKey(foundFlag.key);
        setOriginalKey(foundFlag.key);
        setNormalizedKey(foundFlag.key);
        setType(foundFlag.type);
        setDefaultValue(String(foundFlag.defaultValue));
        setDescription(foundFlag.description || '');
        setArchived(foundFlag.archived);
        setRules(foundFlag.rules || []);
      }
      setLoading(false);
    };

    loadFlag();
  }, [flagId]);

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
    if (validationError) return;
    
    const updatedFlag = {
      ...flag,
      key: normalizedKey,
      displayName,
      type,
      defaultValue: type === 'bool' ? defaultValue === 'true' : 
                   type === 'int' ? parseInt(defaultValue) :
                   type === 'double' ? parseFloat(defaultValue) :
                   type === 'json' ? JSON.parse(defaultValue) : defaultValue,
      description,
      archived
    };

    console.log('Would update flag:', updatedFlag);
    // TODO: Implement API call to update flag
  };

  const handleArchive = async () => {
    setArchived(!archived);
    // Auto-save when archiving
    setTimeout(handleSave, 100);
  };

  const handleDelete = async () => {
    if (confirm('Are you sure you want to delete this flag? This action cannot be undone.')) {
      console.log('Would delete flag:', flagId);
      // TODO: Implement API call to delete flag
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <Typography>Loading flag...</Typography>
      </Box>
    );
  }

  if (!flag) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <Typography variant="h5" sx={{ mb: 2 }}>Flag Not Found</Typography>
        <Button component={Link} href="/dashboard/flags">
          Back to Flags
        </Button>
      </Box>
    );
  }

  const isValid = !validationError && !jsonError && displayName && defaultValue !== '';
  const hasChanges = displayName !== flag.displayName || 
                    normalizedKey !== originalKey ||
                    type !== flag.type ||
                    defaultValue !== String(flag.defaultValue) ||
                    description !== (flag.description || '') ||
                    archived !== flag.archived ||
                    JSON.stringify(rules) !== JSON.stringify(flag.rules || []);

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
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
              Edit Feature Flag
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Modify the configuration for {flag.displayName}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<Archive />}
            onClick={handleArchive}
            color={archived ? "primary" : "warning"}
          >
            {archived ? 'Unarchive' : 'Archive'}
          </Button>
          <Button
            variant="outlined"
            startIcon={<Delete />}
            onClick={handleDelete}
            color="error"
          >
            Delete
          </Button>
        </Box>
      </Box>

      {archived && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          This flag is archived and will not be included in published configurations.
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

                  {/* Auto-generated Key Display */}
                  <Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      Auto-generated Key
                    </Typography>
                    <Box
                      sx={{
                        fontFamily: 'monospace',
                        fontSize: '0.875rem',
                        bgcolor: 'grey.100',
                        p: 1.5,
                        borderRadius: 1,
                        border: '1px solid',
                        borderColor: validationError ? 'error.main' : 'divider'
                      }}
                    >
                      {normalizedKey}
                    </Box>
                    {validationError && (
                      <Typography variant="caption" color="error" sx={{ mt: 0.5, display: 'block' }}>
                        {validationError}
                      </Typography>
                    )}

                    {originalKey !== normalizedKey && (
                      <Alert severity="warning" sx={{ mt: 2 }}>
                        <Typography variant="body2" sx={{ fontWeight: 500, mb: 1 }}>
                          Key will change from <code>{originalKey}</code> to <code>{normalizedKey}</code>
                        </Typography>
                        <Typography variant="body2">
                          This will require updating your code that references this flag. Make sure to update all places where you use this flag before publishing.
                        </Typography>
                      </Alert>
                    )}
                  </Box>

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

                  {/* Archive Status */}
                  <FormControlLabel
                    control={
                      <Switch
                        checked={archived}
                        onChange={(e) => setArchived(e.target.checked)}
                      />
                    }
                    label="Archived"
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
            />
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
                  How this flag will appear in your configuration
                </Typography>
                
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
                      Key
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
                          default: type === 'bool' ? defaultValue === 'true' : defaultValue,
                          rules: [],
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
                    {displayName !== flag.displayName && (
                      <Typography variant="body2">
                        • Display name: <code>{flag.displayName}</code> → <code>{displayName}</code>
                      </Typography>
                    )}
                    {normalizedKey !== originalKey && (
                      <Typography variant="body2">
                        • Key: <code>{originalKey}</code> → <code>{normalizedKey}</code>
                      </Typography>
                    )}
                    {type !== flag.type && (
                      <Typography variant="body2">
                        • Type: <code>{flag.type}</code> → <code>{type}</code>
                      </Typography>
                    )}
                    {defaultValue !== String(flag.defaultValue) && (
                      <Typography variant="body2">
                        • Default value: <code>{JSON.stringify(flag.defaultValue)}</code> → <code>{type === 'bool' ? defaultValue : JSON.stringify(defaultValue)}</code>
                      </Typography>
                    )}
                    {description !== (flag.description || '') && (
                      <Typography variant="body2">
                        • Description updated
                      </Typography>
                    )}
                    {archived !== flag.archived && (
                      <Typography variant="body2">
                        • Status: {flag.archived ? 'Archived' : 'Active'} → {archived ? 'Archived' : 'Active'}
                      </Typography>
                    )}
                    {JSON.stringify(rules) !== JSON.stringify(flag.rules || []) && (
                      <Typography variant="body2">
                        • Targeting rules updated ({rules.length} rule{rules.length !== 1 ? 's' : ''})
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
                href="/dashboard/flags"
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