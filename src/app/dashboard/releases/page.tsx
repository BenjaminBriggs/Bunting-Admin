'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Stack,
  Grid,
  Chip,
  Alert,
  CircularProgress,
  Paper,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Button
} from '@mui/material';
import { 
  History,
  ExpandMore,
  Flag,
  BarChart,
  Download,
  CalendarToday,
  Person
} from '@mui/icons-material';
import Link from 'next/link';
import { 
  getPublishHistory, 
  getPublishedConfig,
  downloadConfig,
  type PublishHistoryItem 
} from '@/lib/api';
import { useApp } from '@/lib/app-context';

export default function ReleasesPage() {
  const { selectedApp } = useApp();
  const [publishHistory, setPublishHistory] = useState<PublishHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const loadReleases = useCallback(async () => {
    if (!selectedApp) return;

    try {
      setLoading(true);
      setError(null);

      const history = await getPublishHistory(selectedApp.id);
      setPublishHistory(history);

    } catch (err) {
      console.error('Failed to load releases:', err);
      setError(err instanceof Error ? err.message : 'Failed to load releases');
    } finally {
      setLoading(false);
    }
  }, [selectedApp]);

  useEffect(() => {
    if (selectedApp) {
      loadReleases();
    } else {
      setLoading(false);
    }
  }, [selectedApp, loadReleases]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getVersionDate = (version: string) => {
    const datePart = version.split('.')[0];
    return new Date(datePart).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const handleDownload = async () => {
    if (!selectedApp) return;
    
    try {
      setDownloading(true);
      await downloadConfig(selectedApp.identifier);
    } catch (err) {
      console.error('Download failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to download configuration');
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h2" sx={{ mb: 1 }}>
          Releases
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {selectedApp 
            ? `Release history and changelogs for ${selectedApp.name}`
            : 'Release history and changelogs'
          }
        </Typography>
      </Box>

      {/* No App Selected */}
      {!selectedApp && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          Please select an application from the sidebar to view its release history.
        </Alert>
      )}

      {/* Error State */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {selectedApp && (
        <Grid container spacing={3}>
          {/* Main Content */}
          <Grid size={{ xs: 12, md: 8 }}>
            <Stack spacing={3}>
              {/* Empty State */}
              {publishHistory.length === 0 && (
                <Card>
                  <CardContent sx={{ textAlign: 'center', py: 6 }}>
                    <History sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
                    <Typography variant="h6" sx={{ mb: 2 }}>
                      No Releases Yet
                    </Typography>
                    <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                      Once you publish your first configuration, it will appear here with a detailed changelog.
                    </Typography>
                    <Button 
                      variant="contained" 
                      component={Link} 
                      href="/dashboard/publish"
                    >
                      Publish Configuration
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Release History */}
              {publishHistory.map((release, index) => (
                <Card key={release.id}>
                  <CardContent sx={{ p: 3 }}>
                    {/* Release Header */}
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 3 }}>
                      <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                          <Typography 
                            variant="h6" 
                            sx={{ 
                              fontFamily: 'monospace', 
                              fontWeight: 700,
                              color: 'primary.main'
                            }}
                          >
                            v{release.version}
                          </Typography>
                          {index === 0 && (
                            <Chip 
                              label="Latest" 
                              size="small" 
                              color="primary" 
                              variant="filled"
                            />
                          )}
                        </Box>
                        <Typography variant="body1" sx={{ mb: 2 }}>
                          {release.changelog}
                        </Typography>
                        
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <CalendarToday sx={{ fontSize: 16, color: 'text.secondary' }} />
                            <Typography variant="body2" color="text.secondary">
                              {formatDate(release.publishedAt)}
                            </Typography>
                          </Box>
                          
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Person sx={{ fontSize: 16, color: 'text.secondary' }} />
                            <Typography variant="body2" color="text.secondary">
                              {release.publishedBy}
                            </Typography>
                          </Box>
                          
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            <Chip 
                              size="small" 
                              icon={<Flag sx={{ fontSize: '16px !important' }} />}
                              label={`${release.flagCount} flags`}
                              variant="outlined"
                            />
                            <Chip 
                              size="small" 
                              icon={<BarChart sx={{ fontSize: '16px !important' }} />}
                              label={`${release.cohortCount} cohorts`}
                              variant="outlined"
                            />
                          </Box>
                        </Box>
                      </Box>
                    </Box>

                    {/* Release Details */}
                    {release.changes && release.changes.length > 0 ? (
                      <Accordion>
                        <AccordionSummary 
                          expandIcon={<ExpandMore />}
                          sx={{ 
                            bgcolor: 'grey.50',
                            '&:hover': { bgcolor: 'grey.100' }
                          }}
                        >
                          <Typography variant="subtitle2">
                            View Changes ({release.changes.length} items)
                          </Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                          <List dense>
                            {release.changes.map((change, changeIndex) => (
                              <ListItem key={changeIndex} sx={{ py: 0.5 }}>
                                <ListItemIcon sx={{ minWidth: 32 }}>
                                  {change.type === 'flag' ? <Flag sx={{ fontSize: 16 }} /> : <BarChart sx={{ fontSize: 16 }} />}
                                </ListItemIcon>
                                <ListItemText
                                  primary={
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                      <Typography 
                                        variant="body2" 
                                        sx={{ fontFamily: 'monospace' }}
                                      >
                                        {change.key}
                                      </Typography>
                                      <Chip 
                                        label={change.action}
                                        size="small"
                                        color={
                                          change.action === 'added' ? 'success' :
                                          change.action === 'modified' ? 'warning' : 'error'
                                        }
                                        variant="outlined"
                                        sx={{ fontSize: '0.7rem', height: 20 }}
                                      />
                                    </Box>
                                  }
                                  secondary={change.name}
                                />
                              </ListItem>
                            ))}
                          </List>
                        </AccordionDetails>
                      </Accordion>
                    ) : (
                      <Alert severity="info" sx={{ mt: 2 }}>
                        No detailed changes available for this release
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              ))}
            </Stack>
          </Grid>

          {/* Sidebar */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Stack spacing={3}>
              {/* Quick Actions */}
              <Card>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    Quick Actions
                  </Typography>
                  
                  <Stack spacing={2}>
                    <Button
                      variant="contained"
                      component={Link}
                      href="/dashboard/publish"
                      fullWidth
                      size="large"
                    >
                      Publish New Release
                    </Button>
                    
                    <Button
                      variant="outlined"
                      startIcon={<Download />}
                      onClick={handleDownload}
                      disabled={publishHistory.length === 0 || downloading}
                      fullWidth
                    >
                      {downloading ? 'Downloading...' : 'Download Latest Config'}
                    </Button>
                  </Stack>
                </CardContent>
              </Card>

              {/* Release Stats */}
              {publishHistory.length > 0 && (
                <Card>
                  <CardContent>
                    <Typography variant="h6" sx={{ mb: 2 }}>
                      Release Statistics
                    </Typography>
                    
                    <Stack spacing={2}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2" color="text.secondary">
                          Total Releases
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {publishHistory.length}
                        </Typography>
                      </Box>
                      
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2" color="text.secondary">
                          Latest Version
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 500, fontFamily: 'monospace' }}>
                          v{publishHistory[0]?.version}
                        </Typography>
                      </Box>
                      
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2" color="text.secondary">
                          Last Published
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {getVersionDate(publishHistory[0]?.version || '')}
                        </Typography>
                      </Box>

                      <Divider />

                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2" color="text.secondary">
                          Current Flags
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {publishHistory[0]?.flagCount || 0}
                        </Typography>
                      </Box>

                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2" color="text.secondary">
                          Current Cohorts
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {publishHistory[0]?.cohortCount || 0}
                        </Typography>
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
              )}
            </Stack>
          </Grid>
        </Grid>
      )}
    </Box>
  );
}