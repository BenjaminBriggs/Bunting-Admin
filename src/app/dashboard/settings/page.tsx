'use client';

import { useState } from 'react';
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
  Divider,
  Switch,
  FormControlLabel,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Tab,
  Tabs
} from '@mui/material';
import { 
  Save, 
  Key, 
  Cloud, 
  Security, 
  Notifications,
  Storage,
  Code,
  ContentCopy
} from '@mui/icons-material';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`settings-tabpanel-${index}`}
      aria-labelledby={`settings-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState(0);
  
  // General settings
  const [appName, setAppName] = useState('Bunting Admin');
  const [appIdentifier, setAppIdentifier] = useState('com.example.myapp');
  const [enableNotifications, setEnableNotifications] = useState(true);
  
  // Storage settings
  const [storageProvider, setStorageProvider] = useState('s3');
  const [s3Bucket, setS3Bucket] = useState('bunting-configs');
  const [s3Region, setS3Region] = useState('us-east-1');
  const [cdnUrl, setCdnUrl] = useState('https://cdn.example.com');
  
  // Security settings
  const [signingEnabled, setSigningEnabled] = useState(true);
  const [keyRotationDays, setKeyRotationDays] = useState(90);
  
  // API settings
  const [apiBaseUrl, setApiBaseUrl] = useState('https://api.example.com');
  const [apiTimeout, setApiTimeout] = useState(30);

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleSave = () => {
    console.log('Saving settings...');
    // TODO: Implement settings save
  };

  const handleCopySDKSnippet = () => {
    const snippet = `// iOS (Swift)
import Bunting

let bunting = Bunting(
    appIdentifier: "${appIdentifier}",
    configURL: "${cdnUrl}/config.json"
)

// Check a feature flag
if bunting.isEnabled("store/use_new_paywall_design") {
    // Show new paywall design
}`;
    
    navigator.clipboard.writeText(snippet);
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
          <Typography variant="h4" component="h2" sx={{ mb: 1 }}>
            Settings
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Configure your Bunting admin interface and integrations
          </Typography>
        </Box>
        <Button 
          variant="contained" 
          startIcon={<Save />}
          onClick={handleSave}
        >
          Save Changes
        </Button>
      </Box>

      <Card>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={activeTab} onChange={handleTabChange}>
            <Tab label="General" icon={<Security />} iconPosition="start" />
            <Tab label="Storage" icon={<Storage />} iconPosition="start" />
            <Tab label="Security" icon={<Key />} iconPosition="start" />
            <Tab label="SDK Setup" icon={<Code />} iconPosition="start" />
          </Tabs>
        </Box>

        <TabPanel value={activeTab} index={0}>
          {/* General Settings */}
          <CardContent sx={{ p: 3 }}>
            <Stack spacing={3}>
              <Typography variant="h6">General Configuration</Typography>
              
              <TextField
                label="Application Name"
                value={appName}
                onChange={(e) => setAppName(e.target.value)}
                helperText="Display name for your application"
                fullWidth
              />
              
              <TextField
                label="App Identifier"
                value={appIdentifier}
                onChange={(e) => setAppIdentifier(e.target.value)}
                helperText="Unique identifier for your app (e.g., bundle ID)"
                fullWidth
                InputProps={{
                  sx: { fontFamily: 'monospace' }
                }}
              />

              <Divider />

              <Typography variant="h6">Preferences</Typography>
              
              <FormControlLabel
                control={
                  <Switch
                    checked={enableNotifications}
                    onChange={(e) => setEnableNotifications(e.target.checked)}
                  />
                }
                label="Enable email notifications for publishes"
              />
            </Stack>
          </CardContent>
        </TabPanel>

        <TabPanel value={activeTab} index={1}>
          {/* Storage Settings */}
          <CardContent sx={{ p: 3 }}>
            <Stack spacing={3}>
              <Typography variant="h6">Storage Configuration</Typography>
              
              <FormControl fullWidth>
                <InputLabel>Storage Provider</InputLabel>
                <Select
                  value={storageProvider}
                  label="Storage Provider"
                  onChange={(e) => setStorageProvider(e.target.value)}
                >
                  <MenuItem value="s3">Amazon S3</MenuItem>
                  <MenuItem value="gcs">Google Cloud Storage</MenuItem>
                  <MenuItem value="azure">Azure Blob Storage</MenuItem>
                  <MenuItem value="b2">Backblaze B2</MenuItem>
                </Select>
              </FormControl>

              {storageProvider === 's3' && (
                <>
                  <TextField
                    label="S3 Bucket"
                    value={s3Bucket}
                    onChange={(e) => setS3Bucket(e.target.value)}
                    helperText="Name of the S3 bucket to store configurations"
                    fullWidth
                  />
                  
                  <TextField
                    label="AWS Region"
                    value={s3Region}
                    onChange={(e) => setS3Region(e.target.value)}
                    helperText="AWS region where your bucket is located"
                    fullWidth
                  />
                </>
              )}

              <Divider />

              <Typography variant="h6">CDN Configuration</Typography>
              
              <TextField
                label="CDN Base URL"
                value={cdnUrl}
                onChange={(e) => setCdnUrl(e.target.value)}
                helperText="Base URL where your configurations will be served"
                fullWidth
                InputProps={{
                  sx: { fontFamily: 'monospace' }
                }}
              />

              <Alert severity="info">
                Configuration files will be available at: <br />
                <code>{cdnUrl}/config.json</code> (main configuration)<br />
                <code>{cdnUrl}/config.json.sig</code> (JWS signature)
              </Alert>
            </Stack>
          </CardContent>
        </TabPanel>

        <TabPanel value={activeTab} index={2}>
          {/* Security Settings */}
          <CardContent sx={{ p: 3 }}>
            <Stack spacing={3}>
              <Typography variant="h6">Signing Configuration</Typography>
              
              <FormControlLabel
                control={
                  <Switch
                    checked={signingEnabled}
                    onChange={(e) => setSigningEnabled(e.target.checked)}
                  />
                }
                label="Enable JWS signature verification"
              />

              {signingEnabled && (
                <>
                  <Alert severity="info">
                    JWS signatures ensure the integrity of your configuration files. 
                    Your SDK will verify signatures before applying configurations.
                  </Alert>

                  <TextField
                    label="Key Rotation Period (days)"
                    type="number"
                    value={keyRotationDays}
                    onChange={(e) => setKeyRotationDays(parseInt(e.target.value))}
                    helperText="How often signing keys should be rotated"
                    InputProps={{ inputProps: { min: 30, max: 365 } }}
                  />

                  <Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      Current Signing Key
                    </Typography>
                    <Chip 
                      label="key-2025-09-11" 
                      sx={{ fontFamily: 'monospace' }}
                      color="success"
                    />
                    <Typography variant="caption" color="text.secondary" sx={{ ml: 2 }}>
                      Generated 1 day ago
                    </Typography>
                  </Box>
                </>
              )}

              <Divider />

              <Typography variant="h6">API Configuration</Typography>
              
              <TextField
                label="API Base URL"
                value={apiBaseUrl}
                onChange={(e) => setApiBaseUrl(e.target.value)}
                helperText="Base URL for your Bunting API"
                fullWidth
                InputProps={{
                  sx: { fontFamily: 'monospace' }
                }}
              />
              
              <TextField
                label="Request Timeout (seconds)"
                type="number"
                value={apiTimeout}
                onChange={(e) => setApiTimeout(parseInt(e.target.value))}
                helperText="Timeout for API requests"
                InputProps={{ inputProps: { min: 5, max: 120 } }}
              />
            </Stack>
          </CardContent>
        </TabPanel>

        <TabPanel value={activeTab} index={3}>
          {/* SDK Setup */}
          <CardContent sx={{ p: 3 }}>
            <Stack spacing={3}>
              <Typography variant="h6">SDK Integration</Typography>
              
              <Alert severity="info">
                Use these configuration values to integrate Bunting into your application.
              </Alert>

              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    App Identifier
                  </Typography>
                  <Box
                    sx={{
                      fontFamily: 'monospace',
                      fontSize: '0.875rem',
                      bgcolor: 'grey.100',
                      p: 1,
                      borderRadius: 1,
                      border: '1px solid',
                      borderColor: 'divider'
                    }}
                  >
                    {appIdentifier}
                  </Box>
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Config URL
                  </Typography>
                  <Box
                    sx={{
                      fontFamily: 'monospace',
                      fontSize: '0.875rem',
                      bgcolor: 'grey.100',
                      p: 1,
                      borderRadius: 1,
                      border: '1px solid',
                      borderColor: 'divider'
                    }}
                  >
                    {cdnUrl}/config.json
                  </Box>
                </Grid>
              </Grid>

              <Divider />

              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6">SDK Code Example</Typography>
                  <Button
                    size="small"
                    startIcon={<ContentCopy />}
                    onClick={handleCopySDKSnippet}
                  >
                    Copy
                  </Button>
                </Box>
                
                <Box
                  component="pre"
                  sx={{
                    fontFamily: 'monospace',
                    fontSize: '0.875rem',
                    bgcolor: 'grey.900',
                    color: 'grey.100',
                    p: 2,
                    borderRadius: 1,
                    overflow: 'auto',
                    whiteSpace: 'pre-wrap'
                  }}
                >
{`// iOS (Swift)
import Bunting

let bunting = Bunting(
    appIdentifier: "${appIdentifier}",
    configURL: "${cdnUrl}/config.json"
)

// Check a feature flag
if bunting.isEnabled("store/use_new_paywall_design") {
    // Show new paywall design
}

// Get a typed value
let retryLimit = bunting.intValue("checkout/retry_limit", default: 3)

// Check if user is in a cohort
if bunting.isInCohort("beta_users") {
    // Show beta features
}`}
                </Box>
              </Box>

              <Alert severity="warning">
                Make sure to replace the placeholder values with your actual configuration 
                before integrating the SDK into your application.
              </Alert>
            </Stack>
          </CardContent>
        </TabPanel>
      </Card>
    </Box>
  );
}