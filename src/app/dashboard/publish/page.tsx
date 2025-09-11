'use client';

import { useState } from 'react';
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
  AccordionDetails
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

// Mock data for changes and validation
const mockChanges = {
  flags: {
    modified: [
      {
        key: 'store/use_new_paywall_design',
        displayName: 'Store / Use New Paywall Design',
        changes: ['defaultValue: false → true', 'description updated']
      }
    ],
    added: [
      {
        key: 'checkout/enable_apple_pay',
        displayName: 'Checkout / Enable Apple Pay',
        type: 'bool',
        defaultValue: false
      }
    ],
    removed: []
  },
  cohorts: {
    modified: [
      {
        identifier: 'beta_users',
        name: 'Beta Users',
        changes: ['percentage: 10% → 15%']
      }
    ],
    added: [],
    removed: []
  }
};

const mockValidation = {
  errors: [],
  warnings: [
    {
      type: 'unreachable_rule',
      message: 'Rule in flag "store/use_new_paywall_design" may be unreachable due to conflicting conditions',
      flagKey: 'store/use_new_paywall_design'
    }
  ]
};

const mockPublishHistory = [
  {
    version: '2025-09-10.2',
    publishedAt: '2025-09-10T16:45:00Z',
    publishedBy: 'john@example.com',
    changelog: 'Updated paywall design flag default value',
    flagCount: 12,
    cohortCount: 3
  },
  {
    version: '2025-09-10.1',
    publishedAt: '2025-09-10T09:15:00Z',
    publishedBy: 'sarah@example.com',
    changelog: 'Added new Apple Pay integration flag',
    flagCount: 11,
    cohortCount: 3
  }
];

export default function PublishPage() {
  const [changelog, setChangelog] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);

  const hasChanges = mockChanges.flags.modified.length > 0 || 
                    mockChanges.flags.added.length > 0 || 
                    mockChanges.flags.removed.length > 0 ||
                    mockChanges.cohorts.modified.length > 0 || 
                    mockChanges.cohorts.added.length > 0 || 
                    mockChanges.cohorts.removed.length > 0;

  const hasBlockingErrors = mockValidation.errors.length > 0;
  const canPublish = hasChanges && !hasBlockingErrors && changelog.trim();

  const handlePublish = async () => {
    if (!canPublish) return;
    
    setIsPublishing(true);
    
    // Mock publish process
    setTimeout(() => {
      setIsPublishing(false);
      console.log('Published with changelog:', changelog);
      // TODO: Implement actual publish logic
    }, 3000);
  };

  const generateVersion = () => {
    const today = new Date().toISOString().split('T')[0];
    const latestToday = mockPublishHistory.find(h => h.version.startsWith(today));
    const nextNumber = latestToday ? parseInt(latestToday.version.split('.')[1]) + 1 : 1;
    return `${today}.${nextNumber}`;
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
          <Typography variant="h4" component="h2" sx={{ mb: 1 }}>
            Publish Configuration
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Review changes and publish your feature flag configuration
          </Typography>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {/* Main Content */}
        <Grid item xs={12} md={8}>
          <Stack spacing={3}>
            {/* Validation Results */}
            {(mockValidation.errors.length > 0 || mockValidation.warnings.length > 0) && (
              <Card>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    Validation Results
                  </Typography>
                  
                  {mockValidation.errors.map((error, index) => (
                    <Alert key={index} severity="error" sx={{ mb: 1 }}>
                      {error.message}
                    </Alert>
                  ))}
                  
                  {mockValidation.warnings.map((warning, index) => (
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
                
                {!hasChanges ? (
                  <Alert severity="info">
                    No changes detected. Make some changes to your flags or cohorts before publishing.
                  </Alert>
                ) : (
                  <Stack spacing={2}>
                    {/* Flag Changes */}
                    {(mockChanges.flags.modified.length > 0 || 
                      mockChanges.flags.added.length > 0 || 
                      mockChanges.flags.removed.length > 0) && (
                      <Accordion defaultExpanded>
                        <AccordionSummary expandIcon={<ExpandMore />}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Flag />
                            <Typography variant="subtitle1">
                              Feature Flags ({
                                mockChanges.flags.modified.length + 
                                mockChanges.flags.added.length + 
                                mockChanges.flags.removed.length
                              } changes)
                            </Typography>
                          </Box>
                        </AccordionSummary>
                        <AccordionDetails>
                          <Stack spacing={2}>
                            {mockChanges.flags.added.length > 0 && (
                              <Box>
                                <Typography variant="body2" color="success.main" sx={{ fontWeight: 500, mb: 1 }}>
                                  Added ({mockChanges.flags.added.length})
                                </Typography>
                                {mockChanges.flags.added.map((flag, index) => (
                                  <Box key={index} sx={{ ml: 2, mb: 1 }}>
                                    <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                                      {flag.key}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      {flag.displayName} ({flag.type}, default: {JSON.stringify(flag.defaultValue)})
                                    </Typography>
                                  </Box>
                                ))}
                              </Box>
                            )}
                            
                            {mockChanges.flags.modified.length > 0 && (
                              <Box>
                                <Typography variant="body2" color="warning.main" sx={{ fontWeight: 500, mb: 1 }}>
                                  Modified ({mockChanges.flags.modified.length})
                                </Typography>
                                {mockChanges.flags.modified.map((flag, index) => (
                                  <Box key={index} sx={{ ml: 2, mb: 1 }}>
                                    <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                                      {flag.key}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      {flag.displayName}
                                    </Typography>
                                    <List dense sx={{ ml: 1 }}>
                                      {flag.changes.map((change, changeIndex) => (
                                        <ListItem key={changeIndex} sx={{ py: 0, px: 0 }}>
                                          <Typography variant="caption" color="text.secondary">
                                            • {change}
                                          </Typography>
                                        </ListItem>
                                      ))}
                                    </List>
                                  </Box>
                                ))}
                              </Box>
                            )}
                          </Stack>
                        </AccordionDetails>
                      </Accordion>
                    )}

                    {/* Cohort Changes */}
                    {(mockChanges.cohorts.modified.length > 0 || 
                      mockChanges.cohorts.added.length > 0 || 
                      mockChanges.cohorts.removed.length > 0) && (
                      <Accordion>
                        <AccordionSummary expandIcon={<ExpandMore />}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <BarChart />
                            <Typography variant="subtitle1">
                              Cohorts ({
                                mockChanges.cohorts.modified.length + 
                                mockChanges.cohorts.added.length + 
                                mockChanges.cohorts.removed.length
                              } changes)
                            </Typography>
                          </Box>
                        </AccordionSummary>
                        <AccordionDetails>
                          <Stack spacing={2}>
                            {mockChanges.cohorts.modified.length > 0 && (
                              <Box>
                                <Typography variant="body2" color="warning.main" sx={{ fontWeight: 500, mb: 1 }}>
                                  Modified ({mockChanges.cohorts.modified.length})
                                </Typography>
                                {mockChanges.cohorts.modified.map((cohort, index) => (
                                  <Box key={index} sx={{ ml: 2, mb: 1 }}>
                                    <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                                      {cohort.identifier}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      {cohort.name}
                                    </Typography>
                                    <List dense sx={{ ml: 1 }}>
                                      {cohort.changes.map((change, changeIndex) => (
                                        <ListItem key={changeIndex} sx={{ py: 0, px: 0 }}>
                                          <Typography variant="caption" color="text.secondary">
                                            • {change}
                                          </Typography>
                                        </ListItem>
                                      ))}
                                    </List>
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
            {hasChanges && (
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
                
                {hasChanges && (
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

                {!hasChanges && (
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
                  {mockPublishHistory.map((publish, index) => (
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
                  ))}
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </Grid>
      </Grid>
    </Box>
  );
}