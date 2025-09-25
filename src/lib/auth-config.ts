// Helper functions to check which auth providers are configured

export function getAvailableProviders() {
  const providers = {
    google: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    github: !!(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
    microsoft: !!(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET && process.env.MICROSOFT_TENANT_ID),
    email: !!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM),
    // Enable dev credentials by default in development, can be disabled with DISABLE_DEV_AUTH=true
    credentials: process.env.NODE_ENV === 'development' && process.env.DISABLE_DEV_AUTH !== 'true'
  }

  return providers
}

export function getConfiguredProviders() {
  // For simplicity, configured providers are the same as available providers
  return getAvailableProviders()
}

export function hasAnyOAuthProvider() {
  const providers = getAvailableProviders()
  return providers.google || providers.github || providers.microsoft
}

export function hasAnyProvider() {
  const providers = getConfiguredProviders()
  return providers.google || providers.github || providers.microsoft || providers.email || providers.credentials
}