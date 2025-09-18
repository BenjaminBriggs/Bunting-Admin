// Helper functions to check which auth providers are configured

export function getAvailableProviders() {
  const providers = {
    google: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    github: !!(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
    microsoft: !!(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET && process.env.MICROSOFT_TENANT_ID),
    email: !!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM),
    dev: process.env.NODE_ENV === 'development'
  }

  return providers
}

export function hasAnyOAuthProvider() {
  const providers = getAvailableProviders()
  return providers.google || providers.github || providers.microsoft
}

export function hasAnyProvider() {
  const providers = getAvailableProviders()
  return providers.google || providers.github || providers.microsoft || providers.email || providers.dev
}