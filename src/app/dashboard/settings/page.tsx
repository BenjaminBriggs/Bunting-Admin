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
  Stack
} from '@mui/material';
import { Add, Apps, MoreVert, Edit, Delete, Download, Settings, Code, Warning } from '@mui/icons-material';
import { fetchApps, updateApp, type App } from '@/lib/api';
import { useRouter } from 'next/navigation';

export default function SettingsPage() {
  const router = useRouter();
  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedApp, setSelectedApp] = useState<App | null>(null);
  const [selectedTab, setSelectedTab] = useState(0);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [appToDelete, setAppToDelete] = useState<App | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    minIntervalHours: 6,
    hardTtlDays: 7,
    storageConfig: {
      bucket: '',
      region: 'us-east-1',
      endpoint: '',
      accessKeyId: '',
      secretAccessKey: ''
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
  }, []);

  // Update form data when selected app changes
  useEffect(() => {
    if (selectedApp && !editMode) {
      setFormData({
        name: selectedApp.name,
        minIntervalHours: selectedApp.fetchPolicy.min_interval_seconds / 3600,
        hardTtlDays: selectedApp.fetchPolicy.hard_ttl_days,
        storageConfig: {
          bucket: selectedApp.storageConfig.bucket,
          region: selectedApp.storageConfig.region,
          endpoint: selectedApp.storageConfig.endpoint || '',
          accessKeyId: selectedApp.storageConfig.accessKeyId || '',
          secretAccessKey: selectedApp.storageConfig.secretAccessKey || ''
        }
      });
    }
  }, [selectedApp, editMode]);

  const handleEditStart = () => {
    if (selectedApp) {
      setFormData({
        name: selectedApp.name,
        minIntervalHours: selectedApp.fetchPolicy.min_interval_seconds / 3600,
        hardTtlDays: selectedApp.fetchPolicy.hard_ttl_days,
        storageConfig: {
          bucket: selectedApp.storageConfig.bucket,
          region: selectedApp.storageConfig.region,
          endpoint: selectedApp.storageConfig.endpoint || '',
          accessKeyId: selectedApp.storageConfig.accessKeyId || '',
          secretAccessKey: selectedApp.storageConfig.secretAccessKey || ''
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

    if (!formData.storageConfig.bucket.trim()) {
      setError('S3 bucket is required');
      return;
    }

    if (!formData.storageConfig.region.trim()) {
      setError('AWS region is required');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const updatedApp = await updateApp(selectedApp.id, {
        name: formData.name,
        fetchPolicy: {
          min_interval_seconds: formData.minIntervalHours * 3600,
          hard_ttl_days: formData.hardTtlDays
        },
        storageConfig: {
          bucket: formData.storageConfig.bucket,
          region: formData.storageConfig.region,
          endpoint: formData.storageConfig.endpoint || undefined,
          accessKeyId: formData.storageConfig.accessKeyId || undefined,
          secretAccessKey: formData.storageConfig.secretAccessKey || undefined
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

  function generatePlistContent(app: App): string {
    const publicKeysXml = app.publicKeys.map(key => `
      <dict>
        <key>kid</key>
        <string>${key.kid}</string>
        <key>pem</key>
        <string>${key.pem}</string>
      </dict>`).join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>artifact_url</key>
  <string>${app.artifactUrl}</string>
  <key>public_keys</key>
  <array>${publicKeysXml}
  </array>
  <key>fetch_policy</key>
  <dict>
    <key>min_interval_seconds</key>
    <integer>${app.fetchPolicy.min_interval_seconds}</integer>
    <key>hard_ttl_days</key>
    <integer>${app.fetchPolicy.hard_ttl_days}</integer>
  </dict>
</dict>
</plist>`;
  }

  function downloadPlist(app: App): void {
    const content = generatePlistContent(app);
    const blob = new Blob([content], { type: 'application/x-plist' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${app.identifier}-bunting-config.plist`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
            onClick={() => router.push('/setup')}
          >
            Set Up Your First Application
          </Button>
        </Box>
      ) : (
        <Grid container spacing={3}>
          {/* Left Panel - Application List */}
          <Grid item xs={12} md={4}>
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
                  onClick={() => router.push('/setup')}
                >
                  Add Application
                </Button>
              </Box>
            </Paper>
          </Grid>

          {/* Right Panel - Selected App Details */}
          <Grid item xs={12} md={8}>
            {selectedApp ? (
              <Paper>
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

                          <Typography variant="subtitle1" sx={{ mt: 2 }}>
                            Storage Configuration
                          </Typography>

                          <TextField
                            label="S3 Bucket"
                            value={formData.storageConfig.bucket}
                            onChange={(e) => setFormData({ 
                              ...formData, 
                              storageConfig: { ...formData.storageConfig, bucket: e.target.value }
                            })}
                            fullWidth
                            required
                            helperText="AWS S3 bucket name for storing config artifacts"
                          />

                          <TextField
                            label="AWS Region"
                            value={formData.storageConfig.region}
                            onChange={(e) => setFormData({ 
                              ...formData, 
                              storageConfig: { ...formData.storageConfig, region: e.target.value }
                            })}
                            fullWidth
                            required
                            helperText="AWS region where the bucket is located (e.g., us-east-1)"
                          />

                          <TextField
                            label="Custom Endpoint (Optional)"
                            value={formData.storageConfig.endpoint}
                            onChange={(e) => setFormData({ 
                              ...formData, 
                              storageConfig: { ...formData.storageConfig, endpoint: e.target.value }
                            })}
                            fullWidth
                            helperText="Custom S3-compatible endpoint (leave empty for AWS S3)"
                          />

                          <TextField
                            label="Access Key ID (Optional)"
                            value={formData.storageConfig.accessKeyId}
                            onChange={(e) => setFormData({ 
                              ...formData, 
                              storageConfig: { ...formData.storageConfig, accessKeyId: e.target.value }
                            })}
                            fullWidth
                            helperText="Leave empty to use environment variables or IAM roles"
                          />

                          <TextField
                            label="Secret Access Key (Optional)"
                            type="password"
                            value={formData.storageConfig.secretAccessKey}
                            onChange={(e) => setFormData({ 
                              ...formData, 
                              storageConfig: { ...formData.storageConfig, secretAccessKey: e.target.value }
                            })}
                            fullWidth
                            helperText="Leave empty to use environment variables or IAM roles"
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
                        SDK Integration
                      </Typography>
                      <Typography variant="body2" sx={{ mb: 3 }}>
                        Download the configuration file needed for your iOS/macOS application to connect to this Bunting instance.
                      </Typography>
                      <Button
                        variant="contained"
                        startIcon={<Download />}
                        onClick={() => downloadPlist(selectedApp)}
                        sx={{ mb: 2 }}
                      >
                        Download bunting-config.plist
                      </Button>
                      <Typography variant="body2" color="text.secondary">
                        Add this file to your Xcode project and the Bunting SDK will automatically use these settings.
                      </Typography>
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