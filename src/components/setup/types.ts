export interface AuthProvider {
  id: string
  name: string
  icon: React.ReactNode
  description: string
  required_fields: string[]
}

export interface SetupState {
  step: number
  selectedProviders: string[]
  providerConfigs: Record<string, any>
  platformIntegration: {
    enabled: boolean
    platform: string
    apiCredentials: Record<string, string>
  }
}

export interface StepProps {
  setupState: SetupState
  onUpdateSetupState: (updates: Partial<SetupState>) => void
  onNext: () => void
  onBack: () => void
  loading?: boolean
  error?: string | null
}