import React from 'react'
import {
  Stack,
  Typography,
  Card,
  CardContent,
  FormControlLabel,
  Checkbox,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Alert
} from '@mui/material'
import { Info } from '@mui/icons-material'
import { StepProps } from './types'

const platforms = [
  { value: 'heroku', label: 'Heroku' },
  { value: 'render', label: 'Render' },
  { value: 'vercel', label: 'Vercel' }
]

export function PlatformIntegrationStep({ setupState, onUpdateSetupState }: StepProps) {
  const handleIntegrationToggle = (enabled: boolean) => {
    onUpdateSetupState({
      platformIntegration: {
        ...setupState.platformIntegration,
        enabled
      }
    })
  }

  const handlePlatformChange = (platform: string) => {
    onUpdateSetupState({
      platformIntegration: {
        ...setupState.platformIntegration,
        platform
      }
    })
  }

  const handleApiTokenChange = (token: string) => {
    onUpdateSetupState({
      platformIntegration: {
        ...setupState.platformIntegration,
        apiCredentials: {
          ...setupState.platformIntegration.apiCredentials,
          apiToken: token
        }
      }
    })
  }

  return (
    <Stack spacing={3}>
      <Typography variant="h5" align="center" gutterBottom>
        Platform Integration (Optional)
      </Typography>
      <Typography variant="body1" align="center" color="text.secondary">
        For enhanced security, we can store your credentials as environment variables using your platform's API
      </Typography>

      <Card>
        <CardContent>
          <FormControlLabel
            control={
              <Checkbox
                checked={setupState.platformIntegration.enabled}
                onChange={(e) => handleIntegrationToggle(e.target.checked)}
              />
            }
            label="Use platform API for secure credential storage"
          />

          {setupState.platformIntegration.enabled && (
            <Stack spacing={2} sx={{ mt: 2 }}>
              <FormControl fullWidth>
                <InputLabel>Platform</InputLabel>
                <Select
                  value={setupState.platformIntegration.platform}
                  label="Platform"
                  onChange={(e) => handlePlatformChange(e.target.value)}
                >
                  {platforms.map(platform => (
                    <MenuItem key={platform.value} value={platform.value}>
                      {platform.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <TextField
                label="API Token"
                type="password"
                value={setupState.platformIntegration.apiCredentials.apiToken || ''}
                onChange={(e) => handleApiTokenChange(e.target.value)}
                fullWidth
                helperText="Your platform API token for updating environment variables"
              />

              {setupState.platformIntegration.platform && (
                <Alert severity="info">
                  <Typography variant="body2">
                    <strong>{getPlatformName(setupState.platformIntegration.platform)} API Instructions:</strong><br />
                    {getPlatformInstructions(setupState.platformIntegration.platform)}
                  </Typography>
                </Alert>
              )}
            </Stack>
          )}
        </CardContent>
      </Card>

      <Alert severity="info" icon={<Info />}>
        <Typography variant="body2">
          <strong>Don't want to provide API credentials?</strong> No problem!
          We'll store credentials securely in the database and provide instructions
          for manually adding them to your platform's environment variables later.
        </Typography>
      </Alert>
    </Stack>
  )
}

function getPlatformName(platform: string): string {
  return platforms.find(p => p.value === platform)?.label || platform
}

function getPlatformInstructions(platform: string): string {
  switch (platform) {
    case 'heroku':
      return 'Go to Account Settings → API Keys or use Heroku CLI: heroku auth:token'
    case 'render':
      return 'Go to Account Settings → API Keys to generate a new token'
    case 'vercel':
      return 'Go to Account Settings → Tokens to create a new token with appropriate scope'
    default:
      return 'Check your platform documentation for API token creation'
  }
}