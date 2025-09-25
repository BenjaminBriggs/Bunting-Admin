'use client'

import React, { useState } from 'react'
import {
  Box,
  Card,
  CardContent,
  Button,
  Stepper,
  Step,
  StepLabel,
  Alert,
  CircularProgress,
  Container
} from '@mui/material'
import { useRouter } from 'next/navigation'
import {
  WelcomeStep,
  ProviderSelectionStep,
  ProviderConfigurationStep,
  PlatformIntegrationStep,
  CompletionStep,
  authProviders,
  type SetupState
} from '@/components/setup'

const steps = [
  'Welcome',
  'Choose Authentication',
  'Configure Providers',
  'Platform Integration',
  'Complete Setup'
]

const getFieldDefaultValue = (field: string): string => {
  switch (field) {
    case 'DEV_ADMIN_EMAIL':
      return 'admin@example.com'
    case 'DEV_ADMIN_PASSWORD':
      return 'admin'
    default:
      return ''
  }
}

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

  const handleUpdateSetupState = (updates: Partial<SetupState>) => {
    setSetupState(prev => ({ ...prev, ...updates }))
  }

  const handleCompleteSetup = async () => {
    setLoading(true)
    setError(null)

    try {
      // Merge configs with default values for fields that weren't explicitly set
      const enrichedConfigs = { ...setupState.providerConfigs }

      setupState.selectedProviders.forEach(providerId => {
        const provider = authProviders.find(p => p.id === providerId)!
        provider.required_fields.forEach(field => {
          if (!enrichedConfigs[providerId]) {
            enrichedConfigs[providerId] = {}
          }
          if (enrichedConfigs[providerId][field] === undefined) {
            const defaultValue = getFieldDefaultValue(field)
            if (defaultValue) {
              enrichedConfigs[providerId][field] = defaultValue
            }
          }
        })
      })

      // Save auth provider configuration
      const response = await fetch('/api/setup/auth-providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providers: setupState.selectedProviders,
          configs: enrichedConfigs,
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
    const stepProps = {
      setupState,
      onUpdateSetupState: handleUpdateSetupState,
      onNext: handleNext,
      onBack: handleBack,
      loading,
      error
    }

    switch (setupState.step) {
      case 0:
        return <WelcomeStep {...stepProps} />
      case 1:
        return <ProviderSelectionStep {...stepProps} />
      case 2:
        return <ProviderConfigurationStep {...stepProps} />
      case 3:
        return <PlatformIntegrationStep {...stepProps} />
      case 4:
        return <CompletionStep {...stepProps} />
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
                    return provider.required_fields.every(field => {
                      const configValue = setupState.providerConfigs[id]?.[field]
                      const defaultValue = getFieldDefaultValue(field)
                      const effectiveValue = configValue !== undefined ? configValue : defaultValue
                      return effectiveValue?.trim()
                    })
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