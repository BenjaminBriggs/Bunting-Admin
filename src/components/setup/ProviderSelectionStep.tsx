import React from 'react'
import {
  Stack,
  Typography,
  Alert,
  Card,
  CardContent,
  FormControlLabel,
  Checkbox,
  Box
} from '@mui/material'
import { StepProps } from './types'
import { authProviders } from './auth-providers'

export function ProviderSelectionStep({ setupState, onUpdateSetupState }: StepProps) {
  const handleProviderToggle = (providerId: string) => {
    const selectedProviders = setupState.selectedProviders.includes(providerId)
      ? setupState.selectedProviders.filter(id => id !== providerId)
      : [...setupState.selectedProviders, providerId]

    onUpdateSetupState({ selectedProviders })
  }

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
}