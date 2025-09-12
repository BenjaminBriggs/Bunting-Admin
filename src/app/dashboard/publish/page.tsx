'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Button,
  Typography,
  TextField,
  Alert,
  Stack,
  Grid,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Paper,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  CircularProgress,
  MenuItem
} from '@mui/material';
import { 
  CloudUpload, 
  CheckCircle, 
  Warning, 
  Error as ErrorIcon,
  ExpandMore,
  Flag,
  BarChart,
  History,
  Code
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { 
  validateConfig, 
  publishConfig, 
  getPublishHistory, 
  generateCurrentConfig, 
  getPublishedConfig,
  type ValidationResult, 
  type PublishHistoryItem 
} from '@/lib/api';
import { getConfigChanges, hasConfigChanges, type ConfigChange } from '@/lib/config-comparison';
import { useChanges } from '@/lib/changes-context';
import { useApp } from '@/lib/app-context';


export default function PublishPage() {
  const router = useRouter();
  const { markChangesPublished } = useChanges();
  const { selectedApp } = useApp();
  const [changelog, setChangelog] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishSuccess, setPublishSuccess] = useState<string | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [changes, setChanges] = useState<ConfigChange[]>([]);
  const [publishHistory, setPublishHistory] = useState<PublishHistoryItem[]>([]);
  const [hasChangesDetected, setHasChangesDetected] = useState(false);

  const hasBlockingErrors = validation?.errors.length ? validation.errors.length > 0 : false;
  const canPublish = hasChangesDetected && !hasBlockingErrors && changelog.trim() && selectedApp;

  useEffect(() => {
    if (selectedApp) {
      loadAppData(selectedApp.id);
    } else {
      setLoading(false);
    }
  }, [selectedApp]);

  const loadAppData = async (appId: string) => {
    try {
      setLoading(true);
      setError(null);

      // Load validation, changes, and history in parallel
      const [validationResult, currentConfig, publishedConfigResult, historyResult] = await Promise.all([
        validateConfig(appId),
        generateCurrentConfig(appId),
        getPublishedConfig(selectedApp!.identifier).catch(() => ({ config: null })),
        getPublishHistory(appId).catch(() => [])
      ]);

      setValidation(validationResult);
      setPublishHistory(historyResult);

      // Calculate changes
      const configChanges = getConfigChanges(currentConfig, publishedConfigResult.config);
      setChanges(configChanges);
      setHasChangesDetected(hasConfigChanges(currentConfig, publishedConfigResult.config));

    } catch (err) {
      console.error('Failed to load app data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load app data');
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async () => {
    if (!canPublish || !selectedApp) return;
    
    setIsPublishing(true);
    setPublishError(null);
    setPublishSuccess(null);
    
    try {
      const result = await publishConfig(selectedApp.id, changelog);
      setPublishSuccess(`Configuration published successfully as version ${result.version}`);
      setChangelog('');
      
      // Clear changes immediately since we just published
      markChangesPublished();
      
      // Reload data to show updated state
      await loadAppData(selectedApp.id);
      
      // Auto-hide success message after 5 seconds
      setTimeout(() => setPublishSuccess(null), 5000);
      
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : 'Failed to publish configuration');
    } finally {
      setIsPublishing(false);
    }
  };

  const generateVersion = () => {
    const today = new Date().toISOString().split('T')[0];
    const latestToday = publishHistory.find(h => h.version.startsWith(today));
    const nextNumber = latestToday ? parseInt(latestToday.version.split('.')[1]) + 1 : 1;
    return `${today}.${nextNumber}`;
  };

  const groupedChanges = {
    flags: {
      added: changes.filter(c => c.type === 'flag' && c.action === 'added'),
      modified: changes.filter(c => c.type === 'flag' && c.action === 'modified'),
      removed: changes.filter(c => c.type === 'flag' && c.action === 'removed')
    },
    cohorts: {
      added: changes.filter(c => c.type === 'cohort' && c.action === 'added'),
      modified: changes.filter(c => c.type === 'cohort' && c.action === 'modified'),
      removed: changes.filter(c => c.type === 'cohort' && c.action === 'removed')
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button onClick={() => window.location.reload()}>
          Retry
        </Button>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
          <Typography variant="h4" component="h2" sx={{ mb: 1 }}>
            Publish Configuration
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Review changes and publish your feature flag configuration for {selectedApp?.name}
          </Typography>
        </Box>
      </Box>

      {/* No App Selected */}
      {!selectedApp && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          Please select an application from the sidebar to publish configuration changes.
        </Alert>
      )}

      {/* Success Alert */}
      {publishSuccess && (
        <Alert severity="success" sx={{ mb: 3 }}>
          {publishSuccess}
        </Alert>
      )}

      {/* Publish Error Alert */}
      {publishError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {publishError}
        </Alert>
      )}

      {selectedApp && (
      <Grid container spacing={3}>
        {/* Main Content */}
        <Grid item xs={12} md={8}>
          <Stack spacing={3}>

            {/* Validation Results */}
            {validation && (validation.errors.length > 0 || validation.warnings.length > 0) && (
              <Card>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    Validation Results
                  </Typography>
                  
                  {validation.errors.map((error, index) => (
                    <Alert key={index} severity="error" sx={{ mb: 1 }}>
                      {error.message}
                    </Alert>
                  ))}
                  
                  {validation.warnings.map((warning, index) => (
                    <Alert key={index} severity="warning" sx={{ mb: 1 }}>
                      {warning.message}
                    </Alert>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Changes Summary */}
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Changes to Publish
                </Typography>
                
                {!hasChangesDetected ? (
                  <Alert severity="info">
                    No changes detected. Make some changes to your flags or cohorts before publishing.
                  </Alert>
                ) : (
                  <Stack spacing={2}>
                    {/* Flag Changes */}
                    {(groupedChanges.flags.modified.length > 0 || 
                      groupedChanges.flags.added.length > 0 || 
                      groupedChanges.flags.removed.length > 0) && (
                      <Accordion defaultExpanded>
                        <AccordionSummary expandIcon={<ExpandMore />}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Flag />
                            <Typography variant="subtitle1">
                              Feature Flags ({
                                groupedChanges.flags.modified.length + 
                                groupedChanges.flags.added.length + 
                                groupedChanges.flags.removed.length
                              } changes)
                            </Typography>
                          </Box>
                        </AccordionSummary>
                        <AccordionDetails>
                          <Stack spacing={2}>
                            {groupedChanges.flags.added.length > 0 && (
                              <Box>
                                <Typography variant="body2" color="success.main" sx={{ fontWeight: 500, mb: 1 }}>
                                  Added ({groupedChanges.flags.added.length})
                                </Typography>
                                {groupedChanges.flags.added.map((change, index) => (
                                  <Box key={index} sx={{ ml: 2, mb: 1 }}>
                                    <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                                      {change.key}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      {change.name}
                                    </Typography>
                                  </Box>
                                ))}
                              </Box>
                            )}
                            
                            {groupedChanges.flags.modified.length > 0 && (
                              <Box>
                                <Typography variant="body2" color="warning.main" sx={{ fontWeight: 500, mb: 1 }}>
                                  Modified ({groupedChanges.flags.modified.length})
                                </Typography>
                                {groupedChanges.flags.modified.map((change, index) => (
                                  <Box key={index} sx={{ ml: 2, mb: 1 }}>
                                    <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                                      {change.key}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      {change.name}
                                    </Typography>
                                    {change.details && change.details.length > 0 && (
                                      <List dense sx={{ ml: 1 }}>
                                        {change.details.map((detail, detailIndex) => (
                                          <ListItem key={detailIndex} sx={{ py: 0, px: 0 }}>
                                            <Typography variant="caption" color="text.secondary">
                                              • {detail}
                                            </Typography>
                                          </ListItem>
                                        ))}
                                      </List>
                                    )}
                                  </Box>
                                ))}
                              </Box>
                            )}
                            
                            {groupedChanges.flags.removed.length > 0 && (
                              <Box>
                                <Typography variant="body2" color="error.main" sx={{ fontWeight: 500, mb: 1 }}>
                                  Removed ({groupedChanges.flags.removed.length})
                                </Typography>
                                {groupedChanges.flags.removed.map((change, index) => (
                                  <Box key={index} sx={{ ml: 2, mb: 1 }}>
                                    <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                                      {change.key}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      {change.name}
                                    </Typography>
                                  </Box>
                                ))}
                              </Box>
                            )}
                          </Stack>
                        </AccordionDetails>
                      </Accordion>
                    )}

                    {/* Cohort Changes */}
                    {(groupedChanges.cohorts.modified.length > 0 || 
                      groupedChanges.cohorts.added.length > 0 || 
                      groupedChanges.cohorts.removed.length > 0) && (
                      <Accordion>
                        <AccordionSummary expandIcon={<ExpandMore />}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <BarChart />
                            <Typography variant="subtitle1">
                              Cohorts ({
                                groupedChanges.cohorts.modified.length + 
                                groupedChanges.cohorts.added.length + 
                                groupedChanges.cohorts.removed.length
                              } changes)
                            </Typography>
                          </Box>
                        </AccordionSummary>
                        <AccordionDetails>
                          <Stack spacing={2}>
                            {groupedChanges.cohorts.added.length > 0 && (
                              <Box>
                                <Typography variant="body2" color="success.main" sx={{ fontWeight: 500, mb: 1 }}>
                                  Added ({groupedChanges.cohorts.added.length})
                                </Typography>
                                {groupedChanges.cohorts.added.map((change, index) => (
                                  <Box key={index} sx={{ ml: 2, mb: 1 }}>
                                    <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                                      {change.key}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      {change.name}
                                    </Typography>
                                  </Box>
                                ))}
                              </Box>
                            )}
                            
                            {groupedChanges.cohorts.modified.length > 0 && (
                              <Box>
                                <Typography variant="body2" color="warning.main" sx={{ fontWeight: 500, mb: 1 }}>
                                  Modified ({groupedChanges.cohorts.modified.length})
                                </Typography>
                                {groupedChanges.cohorts.modified.map((change, index) => (
                                  <Box key={index} sx={{ ml: 2, mb: 1 }}>
                                    <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                                      {change.key}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      {change.name}
                                    </Typography>
                                    {change.details && change.details.length > 0 && (
                                      <List dense sx={{ ml: 1 }}>
                                        {change.details.map((detail, detailIndex) => (
                                          <ListItem key={detailIndex} sx={{ py: 0, px: 0 }}>
                                            <Typography variant="caption" color="text.secondary">
                                              • {detail}
                                            </Typography>
                                          </ListItem>
                                        ))}
                                      </List>
                                    )}
                                  </Box>
                                ))}
                              </Box>
                            )}
                            
                            {groupedChanges.cohorts.removed.length > 0 && (
                              <Box>
                                <Typography variant="body2" color="error.main" sx={{ fontWeight: 500, mb: 1 }}>
                                  Removed ({groupedChanges.cohorts.removed.length})
                                </Typography>
                                {groupedChanges.cohorts.removed.map((change, index) => (
                                  <Box key={index} sx={{ ml: 2, mb: 1 }}>
                                    <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                                      {change.key}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      {change.name}
                                    </Typography>
                                  </Box>
                                ))}
                              </Box>
                            )}
                          </Stack>
                        </AccordionDetails>
                      </Accordion>
                    )}
                  </Stack>
                )}
              </CardContent>
            </Card>

            {/* Changelog */}
            {hasChangesDetected && (
              <Card>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    Changelog
                  </Typography>
                  <TextField
                    label="Describe your changes"
                    value={changelog}
                    onChange={(e) => setChangelog(e.target.value)}
                    placeholder="e.g., Enable new paywall design for all users"
                    multiline
                    rows={3}
                    fullWidth
                    required
                    helperText="This will be included in the publish history"
                  />
                </CardContent>
              </Card>
            )}
          </Stack>
        </Grid>

        {/* Sidebar */}
        <Grid item xs={12} md={4}>
          <Stack spacing={3}>
            {/* Publish Actions */}
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Publish Actions
                </Typography>
                
                {hasChangesDetected && (
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      Next version: 
                    </Typography>
                    <Chip 
                      label={generateVersion()}
                      sx={{ fontFamily: 'monospace' }}
                    />
                  </Box>
                )}

                <Button
                  variant="contained"
                  startIcon={<CloudUpload />}
                  onClick={handlePublish}
                  disabled={!canPublish || isPublishing}
                  fullWidth
                  size="large"
                >
                  {isPublishing ? 'Publishing...' : 'Publish Configuration'}
                </Button>

                {!hasChangesDetected && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
                    No changes to publish
                  </Typography>
                )}

                {hasBlockingErrors && (
                  <Alert severity="error" sx={{ mt: 2 }}>
                    Fix validation errors before publishing
                  </Alert>
                )}
              </CardContent>
            </Card>

            {/* Publish History */}
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Recent Publishes
                </Typography>
                
                <Stack spacing={2}>
                  {publishHistory.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                      No publish history available
                    </Typography>
                  ) : (
                    publishHistory.map((publish, index) => (
                    <Paper key={index} variant="outlined" sx={{ p: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <History sx={{ fontSize: 16, color: 'text.secondary' }} />
                        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 500 }}>
                          {publish.version}
                        </Typography>
                      </Box>
                      
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        {publish.changelog}
                      </Typography>
                      
                      <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                        <Chip 
                          size="small" 
                          label={`${publish.flagCount} flags`}
                          variant="outlined"
                        />
                        <Chip 
                          size="small" 
                          label={`${publish.cohortCount} cohorts`}
                          variant="outlined"
                        />
                      </Box>
                      
                      <Typography variant="caption" color="text.secondary">
                        {new Date(publish.publishedAt).toLocaleString()} by {publish.publishedBy}
                      </Typography>
                    </Paper>
                    ))
                  )}
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </Grid>
      </Grid>
      )}
    </Box>
  );
}