'use client';

import React from 'react';
import { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Button,
  Typography,
  CircularProgress,
  Grid,
  CardActions,
  IconButton,
  Menu,
  MenuItem,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  Tabs,
  Tab,
  Paper,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  TextField,
  Stack,
  FormControl,
  InputLabel,
  Select,
  Chip,
  Alert
} from '@mui/material';
import { Add, Apps, MoreVert, Edit, Delete, Download, Settings, Code, Warning, People } from '@mui/icons-material';
import { fetchApps, updateApp, type App } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { StorageConfigForm, generateArtifactUrl, detectStorageType, type StorageConfigData } from '@/components/forms/StorageConfigForm';

export default function SettingsPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedApp, setSelectedApp] = useState<App | null>(null);
  const [selectedTab, setSelectedTab] = useState(0);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [appToDelete, setAppToDelete] = useState<App | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<{
    name: string;
    minIntervalHours: number;
    hardTtlDays: number;
    storage: StorageConfigData;
  }>({
    name: '',
    minIntervalHours: 6,
    hardTtlDays: 7,
    storage: {
      storageType: process.env.NODE_ENV === "development" ? "minio" : "aws",
      storageConfig: {
        bucket: '',
        region: 'us-east-1',
        endpoint: '',
        accessKeyId: '',
        secretAccessKey: ''
      }
    }
  });

  useEffect(() => {
    const loadApps = async () => {
      try {
        setLoading(true);
        const appsData = await fetchApps();
        setApps(appsData);
        if (appsData.length > 0 && !selectedApp) {
          setSelectedApp(appsData[0]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load apps');
      } finally {
        setLoading(false);
      }
    };
    loadApps();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update form data when selected app changes
  useEffect(() => {
    if (selectedApp && !editMode) {
      const storageType = detectStorageType(selectedApp.storageConfig.endpoint);
      setFormData({
        name: selectedApp.name,
        minIntervalHours: selectedApp.fetchPolicy.min_interval_seconds / 3600,
        hardTtlDays: selectedApp.fetchPolicy.hard_ttl_days,
        storage: {
          storageType,
          storageConfig: {
            bucket: selectedApp.storageConfig.bucket,
            region: selectedApp.storageConfig.region,
            endpoint: selectedApp.storageConfig.endpoint || '',
            accessKeyId: selectedApp.storageConfig.accessKeyId || '',
            secretAccessKey: selectedApp.storageConfig.secretAccessKey || ''
          }
        }
      });
    }
  }, [selectedApp, editMode]);

  const handleEditStart = () => {
    if (selectedApp) {
      const storageType = detectStorageType(selectedApp.storageConfig.endpoint);
      setFormData({
        name: selectedApp.name,
        minIntervalHours: selectedApp.fetchPolicy.min_interval_seconds / 3600,
        hardTtlDays: selectedApp.fetchPolicy.hard_ttl_days,
        storage: {
          storageType,
          storageConfig: {
            bucket: selectedApp.storageConfig.bucket,
            region: selectedApp.storageConfig.region,
            endpoint: selectedApp.storageConfig.endpoint || '',
            accessKeyId: selectedApp.storageConfig.accessKeyId || '',
            secretAccessKey: selectedApp.storageConfig.secretAccessKey || ''
          }
        }
      });
      setEditMode(true);
    }
  };

  const handleEditCancel = () => {
    setEditMode(false);
    setError(null);
  };

  const handleSave = async () => {
    if (!selectedApp) return;

    // Basic validation
    if (!formData.name.trim()) {
      setError('Application name is required');
      return;
    }
    
    if (formData.minIntervalHours < 0.5 || formData.minIntervalHours > 24) {
      setError('Minimum interval must be between 0.5 and 24 hours');
      return;
    }
    
    if (formData.hardTtlDays < 1 || formData.hardTtlDays > 365) {
      setError('Hard TTL must be between 1 and 365 days');
      return;
    }

    if (!formData.storage.storageConfig.bucket.trim()) {
      setError('S3 bucket is required');
      return;
    }

    if (!formData.storage.storageConfig.region.trim()) {
      setError('AWS region is required');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      // Generate new artifact URL based on updated storage config
      const newArtifactUrl = generateArtifactUrl(formData.storage.storageType, formData.storage.storageConfig, selectedApp.identifier);

      const updatedApp = await updateApp(selectedApp.id, {
        name: formData.name,
        artifactUrl: newArtifactUrl,
        fetchPolicy: {
          min_interval_seconds: formData.minIntervalHours * 3600,
          hard_ttl_days: formData.hardTtlDays
        },
        storageConfig: {
          bucket: formData.storage.storageConfig.bucket,
          region: formData.storage.storageConfig.region,
          endpoint: formData.storage.storageConfig.endpoint || undefined,
          accessKeyId: formData.storage.storageConfig.accessKeyId || undefined,
          secretAccessKey: formData.storage.storageConfig.secretAccessKey || undefined
        }
      });

      // Update the apps list and selected app
      setApps(apps.map(app => 
        app.id === selectedApp.id ? updatedApp : app
      ));
      setSelectedApp(updatedApp);
      setEditMode(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save application');
    } finally {
      setSaving(false);
    }
  };

  function downloadPlist(app: App): void {
    // Use the new API endpoint instead of client-side generation
    const url = `/api/bootstrap/plist?appId=${app.id}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = `BuntingConfig.plist`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  const handleDeleteApp = (app: App) => {
    setAppToDelete(app);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (appToDelete) {
      try {
        // await deleteApp(appToDelete.id);
        // setApps(apps.filter(app => app.id !== appToDelete.id));
        // if (selectedApp?.id === appToDelete.id) {
        //   setSelectedApp(apps.find(app => app.id !== appToDelete.id) || null);
        // }
        console.log('Delete app:', appToDelete.name);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete app');
      }
    }
    setDeleteConfirmOpen(false);
    setAppToDelete(null);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Typography variant="h4" component="h2">
          Application Settings
        </Typography>
      </Box>
      
      {error && (
        <Typography color="error" sx={{ mb: 2 }}>
          {error}
        </Typography>
      )}

      {apps.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Apps sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
            No applications configured
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Let's set up your first application with guided setup
          </Typography>
          <Button 
            variant="contained" 
            startIcon={<Add />}
            onClick={() => router.push('/setup/app')}
          >
            Set Up Your First Application
          </Button>
        </Box>
      ) : (
        <Grid container spacing={3}>
          {/* Left Panel - Application List */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Stack spacing={3}>
              <Paper sx={{ height: 'fit-content' }}>
                <List>
                  {apps.map((app) => (
                    <ListItem key={app.id} disablePadding>
                      <ListItemButton
                        selected={selectedApp?.id === app.id}
                        onClick={() => setSelectedApp(app)}
                      >
                        <ListItemIcon>
                          <Apps />
                        </ListItemIcon>
                        <ListItemText
                          primary={app.name}
                          secondary={`${app._count?.flags || 0} flags, ${app._count?.cohorts || 0} cohorts`}
                        />
                        {apps.length > 1 && (
                          <IconButton
                            edge="end"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteApp(app);
                            }}
                            color="error"
                          >
                            <Delete />
                          </IconButton>
                        )}
                      </ListItemButton>
                    </ListItem>
                  ))}
                </List>
                <Divider />
                <Box sx={{ p: 2 }}>
                  <Button
                    variant="contained"
                    startIcon={<Add />}
                    fullWidth
                    onClick={() => router.push('/setup/app')}
                  >
                    Add Application
                  </Button>
                </Box>
              </Paper>

              {/* User Management Card - Only for Admins */}
              {session?.user?.role === 'ADMIN' && (
                <Paper sx={{ height: 'fit-content' }}>
                  <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
                    <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center' }}>
                      <People sx={{ mr: 1 }} />
                      User Management
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Manage access to all applications
                    </Typography>
                  </Box>
                  <Box sx={{ p: 3 }}>
                    <Button
                      variant="contained"
                      startIcon={<People />}
                      fullWidth
                      onClick={() => router.push('/dashboard/users')}
                    >
                      Manage Users
                    </Button>
                  </Box>
                </Paper>
              )}
            </Stack>
          </Grid>

          {/* Right Panel - Selected App Details */}
          <Grid size={{ xs: 12, md: 8 }}>
            {selectedApp ? (
              <Paper>
                <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
                  <Typography variant="h6">
                    {selectedApp.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Application configuration and settings
                  </Typography>
                </Box>
                <Tabs value={selectedTab} onChange={(e, newValue) => setSelectedTab(newValue)}>
                  <Tab label="Settings" icon={<Settings />} />
                  <Tab label="SDK Integration" icon={<Code />} />
                </Tabs>
                <Divider />
                <Box sx={{ p: 3 }}>
                  {selectedTab === 0 && (
                    <Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                        <Typography variant="h6">
                          Application Settings
                        </Typography>
                        {!editMode ? (
                          <Button
                            variant="outlined"
                            startIcon={<Edit />}
                            onClick={handleEditStart}
                          >
                            Edit
                          </Button>
                        ) : (
                          <Stack direction="row" spacing={1}>
                            <Button
                              variant="outlined"
                              onClick={handleEditCancel}
                              disabled={saving}
                            >
                              Cancel
                            </Button>
                            <Button
                              variant="contained"
                              onClick={handleSave}
                              disabled={saving}
                            >
                              {saving ? 'Saving...' : 'Save'}
                            </Button>
                          </Stack>
                        )}
                      </Box>

                      {editMode ? (
                        <Stack spacing={3}>
                          <TextField
                            label="Application Name"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            fullWidth
                            required
                            helperText="Display name for this application"
                          />
                          
                          <Typography variant="subtitle1" sx={{ mt: 2 }}>
                            Fetch Policy
                          </Typography>
                          
                          <TextField
                            label="Minimum Interval (hours)"
                            type="number"
                            value={formData.minIntervalHours}
                            onChange={(e) => setFormData({ ...formData, minIntervalHours: parseFloat(e.target.value) || 0 })}
                            fullWidth
                            inputProps={{ min: 0.5, max: 24, step: 0.5 }}
                            helperText="Minimum time between config fetches (0.5 to 24 hours)"
                          />
                          
                          <TextField
                            label="Hard TTL (days)"
                            type="number"
                            value={formData.hardTtlDays}
                            onChange={(e) => setFormData({ ...formData, hardTtlDays: parseInt(e.target.value) || 0 })}
                            fullWidth
                            inputProps={{ min: 1, max: 365 }}
                            helperText="Maximum age before config is considered stale (1-365 days)"
                          />

                          <StorageConfigForm
                            value={formData.storage}
                            onChange={(storage) => setFormData({ ...formData, storage })}
                            disabled={saving}
                            showTypeSelector={true}
                          />
                        </Stack>
                      ) : (
                        <Stack spacing={2}>
                          <Box>
                            <Typography variant="body2" color="text.secondary">
                              Name
                            </Typography>
                            <Typography variant="body1">
                              {selectedApp.name}
                            </Typography>
                          </Box>
                          
                          <Box>
                            <Typography variant="body2" color="text.secondary">
                              Identifier
                            </Typography>
                            <Typography variant="body1">
                              {selectedApp.identifier}
                            </Typography>
                          </Box>
                          
                          <Box>
                            <Typography variant="body2" color="text.secondary">
                              Artifact URL
                            </Typography>
                            <Typography variant="body1">
                              {selectedApp.artifactUrl}
                            </Typography>
                          </Box>
                          
                          <Box>
                            <Typography variant="body2" color="text.secondary">
                              Public Keys
                            </Typography>
                            <Typography variant="body1">
                              {selectedApp.publicKeys.length} configured
                            </Typography>
                          </Box>
                          
                          <Box>
                            <Typography variant="body2" color="text.secondary">
                              Fetch Policy
                            </Typography>
                            <Typography variant="body1">
                              {selectedApp.fetchPolicy.min_interval_seconds / 3600} hour interval, {selectedApp.fetchPolicy.hard_ttl_days} day TTL
                            </Typography>
                          </Box>

                          <Box>
                            <Typography variant="body2" color="text.secondary">
                              Storage Configuration
                            </Typography>
                            <Typography variant="body1">
                              Bucket: {selectedApp.storageConfig.bucket}
                            </Typography>
                            <Typography variant="body1">
                              Region: {selectedApp.storageConfig.region}
                            </Typography>
                            {selectedApp.storageConfig.endpoint && (
                              <Typography variant="body1">
                                Endpoint: {selectedApp.storageConfig.endpoint}
                              </Typography>
                            )}
                            <Typography variant="body1">
                              Credentials: {selectedApp.storageConfig.accessKeyId ? 'Custom keys configured' : 'Using environment/IAM'}
                            </Typography>
                          </Box>
                        </Stack>
                      )}
                    </Box>
                  )}
                  {selectedTab === 1 && (
                    <Box>
                      <Typography variant="h6" sx={{ mb: 2 }}>
                        iOS/macOS SDK Integration
                      </Typography>
                      <Typography variant="body2" sx={{ mb: 3 }}>
                        Download the bootstrap configuration file needed for your iOS/macOS application to connect to this Bunting instance.
                      </Typography>

                      <Stack spacing={3}>
                        <Alert severity="info">
                          <Typography variant="body2">
                            <strong>BuntingConfig.plist</strong> contains your app's endpoint URL, public keys for signature verification, and fetch policy settings.
                            This file should be added to your Xcode project bundle.
                          </Typography>
                        </Alert>

                        <Button
                          variant="contained"
                          startIcon={<Download />}
                          onClick={() => downloadPlist(selectedApp)}
                          sx={{ alignSelf: 'flex-start' }}
                        >
                          Download BuntingConfig.plist
                        </Button>

                        <Box>
                          <Typography variant="subtitle2" sx={{ mb: 1 }}>
                            Configuration Preview:
                          </Typography>
                          <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50', fontFamily: 'monospace' }}>
                            <Stack spacing={1}>
                              <Typography variant="body2">
                                <strong>endpoint_url:</strong> {selectedApp.artifactUrl}
                              </Typography>
                              <Typography variant="body2">
                                <strong>public_keys:</strong> {selectedApp.publicKeys.length} signing key{selectedApp.publicKeys.length !== 1 ? 's' : ''}
                              </Typography>
                              <Typography variant="body2">
                                <strong>fetch_policy:</strong> {selectedApp.fetchPolicy.min_interval_seconds / 3600}h interval, {selectedApp.fetchPolicy.hard_ttl_days}d TTL
                              </Typography>
                            </Stack>
                          </Paper>
                        </Box>

                        <Box>
                          <Typography variant="subtitle2" sx={{ mb: 1 }}>
                            Integration Steps:
                          </Typography>
                          <Stack spacing={1}>
                            <Typography variant="body2">
                              1. Add the Bunting Swift SDK to your Xcode project via Swift Package Manager
                            </Typography>
                            <Typography variant="body2">
                              2. Add the downloaded BuntingConfig.plist file to your app's main bundle
                            </Typography>
                            <Typography variant="body2">
                              3. Configure Bunting in your app with: <code>Bunting.configure(environment: .production)</code>
                            </Typography>
                            <Typography variant="body2">
                              4. Access feature flags: <code>await Bunting.shared.bool("my_flag", default: false)</code>
                            </Typography>
                          </Stack>
                        </Box>
                      </Stack>
                    </Box>
                  )}
                </Box>
              </Paper>
            ) : (
              <Paper sx={{ p: 8, textAlign: 'center' }}>
                <Typography variant="h6" color="text.secondary">
                  Select an application to view its settings
                </Typography>
              </Paper>
            )}
          </Grid>
        </Grid>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
      >
        <DialogTitle>
          <Warning sx={{ mr: 1, verticalAlign: 'middle' }} />
          Delete Application
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete "{appToDelete?.name}"? This will permanently remove the application and all its feature flags and cohorts. This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
          <Button onClick={confirmDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}