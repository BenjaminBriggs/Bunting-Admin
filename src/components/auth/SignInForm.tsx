'use client'

import { signIn } from 'next-auth/react'
import { useState } from 'react'
import { getAvailableProviders, hasAnyOAuthProvider } from '@/lib/auth-config'
import {
  Card,
  CardContent,
  TextField,
  Button,
  Stack,
  Typography,
  Alert,
  Box,
  Divider
} from '@mui/material'
import { Login, Google, GitHub, Microsoft, Email, Settings } from '@mui/icons-material'
import Link from 'next/link'

export default function SignInForm() {
  const [emailPassword, setEmailPassword] = useState({ email: '', password: '' })
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [emailSent, setEmailSent] = useState(false)
  const providers = getAvailableProviders()
  const hasOAuth = hasAnyOAuthProvider()

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const result = await signIn('credentials', {
        email: emailPassword.email,
        password: emailPassword.password,
        redirect: false
      })

      if (result?.error) {
        setError('Invalid email or password')
      } else if (result?.ok) {
        window.location.href = '/dashboard'
      }
    } catch (err) {
      setError('Something went wrong')
    } finally {
      setIsLoading(false)
    }
  }

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const result = await signIn('resend', {
        email,
        redirect: false
      })

      if (result?.error) {
        setError('Failed to send magic link')
      } else {
        setEmailSent(true)
      }
    } catch (err) {
      setError('Something went wrong')
    } finally {
      setIsLoading(false)
    }
  }

  const handleOAuthSignIn = async (provider: string) => {
    setIsLoading(true)
    setError('')

    // Check if this is a dev-mode provider without real credentials
    const isDevMode = process.env.NODE_ENV === 'development'
    const hasRealCredentials = {
      google: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
      github: !!(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
      microsoft: !!(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET)
    }

    if (isDevMode && !hasRealCredentials[provider as keyof typeof hasRealCredentials]) {
      setError(`${provider.charAt(0).toUpperCase() + provider.slice(1)} OAuth is not configured with real credentials. Use Email & Password for development.`)
      setIsLoading(false)
      return
    }

    try {
      await signIn(provider, { callbackUrl: '/dashboard' })
    } catch (err) {
      setError('Authentication failed')
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardContent>
        <Stack spacing={3}>

          {/* Email & Password Credentials */}
          {providers.credentials && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Email & Password
              </Typography>
              <form onSubmit={handleCredentialsSubmit}>
                <Stack spacing={2}>
                  <TextField
                    label="Email"
                    type="email"
                    value={emailPassword.email}
                    onChange={(e) => setEmailPassword(prev => ({ ...prev, email: e.target.value }))}
                    required
                    fullWidth
                    size="small"
                    placeholder="admin@example.com"
                  />

                  <TextField
                    label="Password"
                    type="password"
                    value={emailPassword.password}
                    onChange={(e) => setEmailPassword(prev => ({ ...prev, password: e.target.value }))}
                    required
                    fullWidth
                    size="small"
                    placeholder="admin"
                  />

                  <Button
                    type="submit"
                    variant="contained"
                    disabled={isLoading}
                    startIcon={<Login />}
                    fullWidth
                  >
                    {isLoading ? 'Signing in...' : 'Sign in'}
                  </Button>
                </Stack>
              </form>

              {(hasOAuth || providers.email) && (
                <Divider sx={{ my: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    Or continue with
                  </Typography>
                </Divider>
              )}
            </Box>
          )}

          {/* OAuth Providers */}
          {hasOAuth && (
            <Stack spacing={2}>
              {providers.google && (
                <Button
                  onClick={() => handleOAuthSignIn('google')}
                  variant="outlined"
                  size="large"
                  disabled={isLoading}
                  startIcon={<Google />}
                  fullWidth
                >
                  Continue with Google
                </Button>
              )}

              {providers.github && (
                <Button
                  onClick={() => handleOAuthSignIn('github')}
                  variant="outlined"
                  size="large"
                  disabled={isLoading}
                  startIcon={<GitHub />}
                  fullWidth
                >
                  Continue with GitHub
                </Button>
              )}

              {providers.microsoft && (
                <Button
                  onClick={() => handleOAuthSignIn('azure-ad')}
                  variant="outlined"
                  size="large"
                  disabled={isLoading}
                  startIcon={<Microsoft />}
                  fullWidth
                >
                  Continue with Microsoft
                </Button>
              )}
            </Stack>
          )}

          {/* Divider between OAuth and Email */}
          {hasOAuth && providers.email && (
            <Divider>
              <Typography variant="body2" color="text.secondary">
                Or continue with email
              </Typography>
            </Divider>
          )}

          {/* Magic Link Email */}
          {providers.email && (
            emailSent ? (
              <Alert severity="success">
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  Check your email!
                </Typography>
                <Typography variant="body2">
                  We've sent a magic link to {email}. Click the link to sign in.
                </Typography>
              </Alert>
            ) : (
              <form onSubmit={handleEmailSubmit}>
                <Stack spacing={2}>
                  <TextField
                    label="Email address"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    fullWidth
                    autoComplete="email"
                  />

                  <Button
                    type="submit"
                    variant="contained"
                    size="large"
                    disabled={isLoading}
                    startIcon={<Email />}
                    fullWidth
                  >
                    {isLoading ? 'Sending link...' : 'Send magic link'}
                  </Button>
                </Stack>
              </form>
            )
          )}

          {/* Development mode notice for OAuth without credentials */}
          {process.env.NODE_ENV === 'development' && hasOAuth && !providers.credentials && !providers.email && (
            <Alert severity="info">
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                Development Mode
              </Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                OAuth providers are selected but require real credentials to work. Click the buttons below to see the error messages, or reconfigure authentication.
              </Typography>
              <Button
                component={Link}
                href="/setup"
                variant="outlined"
                startIcon={<Settings />}
                size="small"
              >
                Reconfigure Authentication
              </Button>
            </Alert>
          )}

          {/* No providers configured fallback */}
          {!hasOAuth && !providers.email && !providers.credentials && (
            <Alert severity="warning">
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                No authentication providers configured
              </Typography>
              <Typography variant="body2">
                Please configure OAuth providers or email authentication in your environment variables.
              </Typography>
            </Alert>
          )}

          {/* Error Display */}
          {error && (
            <Alert severity="error">
              {error}
            </Alert>
          )}
        </Stack>
      </CardContent>
    </Card>
  )
}