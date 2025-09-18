import React from 'react'
import {
  Stack,
  Typography,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Alert
} from '@mui/material'
import { Check, Warning } from '@mui/icons-material'
import { StepProps } from './types'

export function CompletionStep({ setupState }: StepProps) {
  return (
    <Stack spacing={3} alignItems="center">
      <Check sx={{ fontSize: 64, color: 'success.main' }} />
      <Typography variant="h4" align="center" gutterBottom>
        Setup Complete!
      </Typography>
      <Typography variant="body1" align="center" color="text.secondary">
        Your authentication providers have been configured.
      </Typography>

      <Card sx={{ width: '100%', maxWidth: 600 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            What happens next?
          </Typography>
          <List>
            <ListItem>
              <ListItemIcon><Check color="success" /></ListItemIcon>
              <ListItemText
                primary="Sign in with your chosen provider"
                secondary="You'll be redirected to create your first admin account"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon><Check color="success" /></ListItemIcon>
              <ListItemText
                primary="Create your first application"
                secondary="Set up your iOS/macOS app for feature flag management"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon><Check color="success" /></ListItemIcon>
              <ListItemText
                primary="Start managing flags"
                secondary="Create, test, and deploy feature flags to your apps"
              />
            </ListItem>
          </List>
        </CardContent>
      </Card>

      <SetupSummary setupState={setupState} />

      {!setupState.platformIntegration.enabled && (
        <Alert severity="warning" sx={{ maxWidth: 600 }}>
          <Typography variant="body2">
            <strong>Security Reminder:</strong> For better security, consider manually
            adding your authentication credentials to your platform's environment variables
            and removing them from the database after setup.
          </Typography>
        </Alert>
      )}
    </Stack>
  )
}

function SetupSummary({ setupState }: { setupState: StepProps['setupState'] }) {
  return (
    <Card sx={{ width: '100%', maxWidth: 600 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Configuration Summary
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          <strong>Authentication Providers:</strong> {setupState.selectedProviders.length} configured
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 2 }}>
          {setupState.selectedProviders.map(providerId => (
            <Typography
              key={providerId}
              variant="caption"
              sx={{
                bgcolor: 'primary.main',
                color: 'primary.contrastText',
                px: 1,
                py: 0.5,
                borderRadius: 1,
                textTransform: 'capitalize'
              }}
            >
              {providerId}
            </Typography>
          ))}
        </Stack>
        <Typography variant="body2" color="text.secondary">
          <strong>Credential Storage:</strong> {
            setupState.platformIntegration.enabled
              ? `Platform API (${setupState.platformIntegration.platform})`
              : 'Database (with manual migration option)'
          }
        </Typography>
      </CardContent>
    </Card>
  )
}