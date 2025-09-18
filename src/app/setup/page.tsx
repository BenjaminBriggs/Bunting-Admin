'use client'

import React, { useState, useEffect } from 'react'
import {
  Box,
  Card,
  CardContent,
  Button,
  Typography,
  TextField,
  Stack,
  Stepper,
  Step,
  StepLabel,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Chip,
  Container,
  FormControlLabel,
  Checkbox,
  Link,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon
} from '@mui/material'
import { useRouter } from 'next/navigation'
import {
  Security,
  Google,
  GitHub,
  Microsoft,
  Email,
  Check,
  Warning,
  Info,
  API
} from '@mui/icons-material'

interface AuthProvider {
  id: string
  name: string
  icon: React.ReactNode
  description: string
  required_fields: string[]
}

interface SetupState {
  step: number
  selectedProviders: string[]
  providerConfigs: Record<string, any>
  platformIntegration: {
    enabled: boolean
    platform: string
    apiCredentials: Record<string, string>
  }
}

const authProviders: AuthProvider[] = [
  {
    id: 'google',
    name: 'Google',
    icon: <Google />,
    description: 'Perfect for teams using Google Workspace',
    required_fields: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET']
  },
  {
    id: 'github',
    name: 'GitHub',
    icon: <GitHub />,
    description: 'Ideal for developer teams already on GitHub',
    required_fields: ['GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET']
  },
  {
    id: 'microsoft',
    name: 'Microsoft',
    icon: <Microsoft />,
    description: 'Great for organizations using Microsoft 365/Azure AD',
    required_fields: ['MICROSOFT_CLIENT_ID', 'MICROSOFT_CLIENT_SECRET', 'MICROSOFT_TENANT_ID']
  },
  {
    id: 'email',
    name: 'Magic Link Email',
    icon: <Email />,
    description: 'Passwordless email-based authentication',
    required_fields: ['RESEND_API_KEY', 'EMAIL_FROM']
  }
]

const steps = [
  'Welcome',
  'Choose Authentication',
  'Configure Providers',
  'Platform Integration',
  'Complete Setup'
]

export default function InitialSetupPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [setupState, setSetupState] = useState<SetupState>({
    step: 0,
    selectedProviders: [],
    providerConfigs: {},
    platformIntegration: {
      enabled: false,
      platform: '',
      apiCredentials: {}
    }
  })

  const handleNext = () => {
    setSetupState(prev => ({ ...prev, step: prev.step + 1 }))
  }

  const handleBack = () => {
    setSetupState(prev => ({ ...prev, step: prev.step - 1 }))
  }

  const handleProviderToggle = (providerId: string) => {
    setSetupState(prev => ({
      ...prev,
      selectedProviders: prev.selectedProviders.includes(providerId)
        ? prev.selectedProviders.filter(id => id !== providerId)
        : [...prev.selectedProviders, providerId]
    }))
  }

  const handleProviderConfig = (providerId: string, config: any) => {
    setSetupState(prev => ({
      ...prev,
      providerConfigs: {
        ...prev.providerConfigs,
        [providerId]: config
      }
    }))
  }

  const handleCompleteSetup = async () => {
    setLoading(true)
    setError(null)

    try {
      // Save auth provider configuration
      const response = await fetch('/api/setup/auth-providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providers: setupState.selectedProviders,
          configs: setupState.providerConfigs,
          platformIntegration: setupState.platformIntegration
        })
      })

      if (!response.ok) {
        throw new Error('Failed to save configuration')
      }

      // Redirect to sign in with configured providers
      router.push('/auth/signin?setup=complete')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Setup failed')
    } finally {
      setLoading(false)
    }
  }

  const renderStepContent = () => {
    switch (setupState.step) {
      case 0:
        return (
          <Stack spacing={3} alignItems="center">
            <Security sx={{ fontSize: 64, color: 'primary.main' }} />
            <Typography variant="h4" align="center" gutterBottom>
              Welcome to Bunting!
            </Typography>
            <Typography variant="body1" align="center" color="text.secondary" sx={{ maxWidth: 600 }}>
              Let's set up authentication for your feature flag dashboard.
              You'll configure how team members can sign in to manage your iOS/macOS app flags.
            </Typography>
            <Alert severity="info" sx={{ maxWidth: 600 }}>
              <Typography variant="body2">
                This is a one-time setup process. You can always modify these settings later
                through the admin interface.
              </Typography>
            </Alert>
          </Stack>
        )

      case 1:
        return (
          <Stack spacing={3}>
            <Typography variant="h5" align="center" gutterBottom>
              Choose Authentication Methods
            </Typography>
            <Typography variant="body1" align="center" color="text.secondary">
              Select one or more authentication providers for your team
            </Typography>

            <Stack spacing={2}>
              {authProviders.map(provider => (
                <Card
                  key={provider.id}
                  variant={setupState.selectedProviders.includes(provider.id) ? 'elevation' : 'outlined'}
                  sx={{
                    cursor: 'pointer',
                    borderColor: setupState.selectedProviders.includes(provider.id) ? 'primary.main' : undefined
                  }}
                  onClick={() => handleProviderToggle(provider.id)}
                >
                  <CardContent>
                    <Stack direction="row" spacing={2} alignItems="center">
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={setupState.selectedProviders.includes(provider.id)}
                            onChange={() => handleProviderToggle(provider.id)}
                          />
                        }
                        label=""
                        sx={{ m: 0 }}
                      />
                      {provider.icon}
                      <Box flex={1}>
                        <Typography variant="h6">{provider.name}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {provider.description}
                        </Typography>
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </Stack>

            {setupState.selectedProviders.length === 0 && (
              <Alert severity="warning">
                Please select at least one authentication provider to continue.
              </Alert>
            )}
          </Stack>
        )

      case 2:
        return (
          <Stack spacing={3}>
            <Typography variant="h5" align="center" gutterBottom>
              Configure Selected Providers
            </Typography>
            <Typography variant="body1" align="center" color="text.secondary">
              Enter the credentials for your chosen authentication providers
            </Typography>

            {setupState.selectedProviders.map(providerId => {
              const provider = authProviders.find(p => p.id === providerId)!
              return (
                <Card key={providerId}>
                  <CardContent>
                    <Stack spacing={2}>
                      <Stack direction="row" spacing={2} alignItems="center">
                        {provider.icon}
                        <Typography variant="h6">{provider.name}</Typography>
                      </Stack>

                      {provider.required_fields.map(field => (
                        <TextField
                          key={field}
                          label={field.replace(/_/g, ' ')}
                          type={field.toLowerCase().includes('secret') ? 'password' : 'text'}
                          value={setupState.providerConfigs[providerId]?.[field] || ''}
                          onChange={(e) => handleProviderConfig(providerId, {
                            ...setupState.providerConfigs[providerId],
                            [field]: e.target.value
                          })}
                          fullWidth
                          required
                        />
                      ))}
                    </Stack>
                  </CardContent>
                </Card>
              )
            })}
          </Stack>
        )

      case 3:
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
                      onChange={(e) => setSetupState(prev => ({
                        ...prev,
                        platformIntegration: {
                          ...prev.platformIntegration,
                          enabled: e.target.checked
                        }
                      }))}
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
                        onChange={(e) => setSetupState(prev => ({
                          ...prev,
                          platformIntegration: {
                            ...prev.platformIntegration,
                            platform: e.target.value
                          }
                        }))}
                      >
                        <MenuItem value="heroku">Heroku</MenuItem>
                        <MenuItem value="render">Render</MenuItem>
                        <MenuItem value="railway">Railway</MenuItem>
                        <MenuItem value="vercel">Vercel</MenuItem>
                      </Select>
                    </FormControl>

                    <TextField
                      label="API Token"
                      type="password"
                      fullWidth
                      helperText="Your platform API token for updating environment variables"
                    />
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

      case 4:
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

      default:
        return null
    }
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Stepper activeStep={setupState.step} alternativeLabel>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
      </Box>

      <Card>
        <CardContent sx={{ p: 4 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          {renderStepContent()}

          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
            <Button
              onClick={handleBack}
              disabled={setupState.step === 0}
            >
              Back
            </Button>

            {setupState.step === steps.length - 1 ? (
              <Button
                variant="contained"
                onClick={handleCompleteSetup}
                disabled={loading}
                startIcon={loading ? <CircularProgress size={20} /> : undefined}
              >
                {loading ? 'Finishing Setup...' : 'Complete Setup'}
              </Button>
            ) : (
              <Button
                variant="contained"
                onClick={handleNext}
                disabled={
                  (setupState.step === 1 && setupState.selectedProviders.length === 0) ||
                  (setupState.step === 2 && !setupState.selectedProviders.every(id => {
                    const provider = authProviders.find(p => p.id === id)!
                    return provider.required_fields.every(field =>
                      setupState.providerConfigs[id]?.[field]?.trim()
                    )
                  }))
                }
              >
                Next
              </Button>
            )}
          </Box>
        </CardContent>
      </Card>
    </Container>
  )
}