import React from 'react'
import {
  Stack,
  Typography,
} from '@mui/material'
import { StepProps } from './types'
import { authProviders } from './auth-providers'
import { CredentialFieldsForm, createProviderConfig } from '@/components/forms/CredentialFieldsForm'

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
        const authProvider = authProviders.find(p => p.id === providerId)!
        const providerConfig = createProviderConfig(
          authProvider.id,
          authProvider.name,
          authProvider.required_fields,
          {
            icon: authProvider.icon,
            description: authProvider.description,
          }
        )

        return (
          <CredentialFieldsForm
            key={providerId}
            provider={providerConfig}
            values={setupState.providerConfigs[providerId] || {}}
            onChange={(field, value) => handleProviderConfig(providerId, field, value)}
            showProviderHeader={true}
            variant="default"
          />
        )
      })}
    </Stack>
  )
}