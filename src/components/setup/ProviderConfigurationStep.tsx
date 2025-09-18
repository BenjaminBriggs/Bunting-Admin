import React from 'react'
import {
  Stack,
  Typography,
  Card,
  CardContent,
  TextField
} from '@mui/material'
import { StepProps } from './types'
import { authProviders } from './auth-providers'

export function ProviderConfigurationStep({ setupState, onUpdateSetupState }: StepProps) {
  const handleProviderConfig = (providerId: string, field: string, value: string) => {
    const updatedConfigs = {
      ...setupState.providerConfigs,
      [providerId]: {
        ...setupState.providerConfigs[providerId],
        [field]: value
      }
    }
    onUpdateSetupState({ providerConfigs: updatedConfigs })
  }

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
                    type={field.toLowerCase().includes('secret') || field.toLowerCase().includes('key') ? 'password' : 'text'}
                    value={setupState.providerConfigs[providerId]?.[field] || ''}
                    onChange={(e) => handleProviderConfig(providerId, field, e.target.value)}
                    fullWidth
                    required
                    helperText={getFieldHelperText(field)}
                  />
                ))}
              </Stack>
            </CardContent>
          </Card>
        )
      })}
    </Stack>
  )
}

function getFieldHelperText(field: string): string {
  switch (field) {
    case 'GOOGLE_CLIENT_ID':
    case 'GOOGLE_CLIENT_SECRET':
      return 'Get from Google Cloud Console → APIs & Services → Credentials'
    case 'GITHUB_CLIENT_ID':
    case 'GITHUB_CLIENT_SECRET':
      return 'Get from GitHub Settings → Developer settings → OAuth Apps'
    case 'MICROSOFT_CLIENT_ID':
    case 'MICROSOFT_CLIENT_SECRET':
    case 'MICROSOFT_TENANT_ID':
      return 'Get from Azure Portal → App registrations'
    case 'RESEND_API_KEY':
      return 'Get from Resend dashboard → API Keys'
    case 'EMAIL_FROM':
      return 'Email address for sending magic links (e.g., noreply@your-domain.com)'
    default:
      return ''
  }
}