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
import { Login, Google, GitHub, Microsoft, Email } from '@mui/icons-material'

export default function SignInForm() {
  const [credentials, setCredentials] = useState({ username: '', password: '' })
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [emailSent, setEmailSent] = useState(false)
  const providers = getAvailableProviders()
  const hasOAuth = hasAnyOAuthProvider()

  const handleDevSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const result = await signIn('dev-credentials', {
        username: credentials.username,
        password: credentials.password,
        redirect: false
      })

      if (result?.error) {
        setError('Invalid credentials')
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
          {/* Development Mode */}
          {providers.dev && (
            <Box>
              <Alert severity="warning" sx={{ mb: 2 }}>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  Development Mode
                </Typography>
                <Typography variant="body2">
                  Use admin/admin to sign in during development
                </Typography>
              </Alert>

              <form onSubmit={handleDevSubmit}>
                <Stack spacing={2}>
                  <TextField
                    label="Username"
                    type="text"
                    value={credentials.username}
                    onChange={(e) => setCredentials(prev => ({ ...prev, username: e.target.value }))}
                    required
                    fullWidth
                    size="small"
                  />

                  <TextField
                    label="Password"
                    type="password"
                    value={credentials.password}
                    onChange={(e) => setCredentials(prev => ({ ...prev, password: e.target.value }))}
                    required
                    fullWidth
                    size="small"
                  />

                  <Button
                    type="submit"
                    variant="outlined"
                    disabled={isLoading}
                    startIcon={<Login />}
                    fullWidth
                  >
                    {isLoading ? 'Signing in...' : 'Sign in (Dev)'}
                  </Button>
                </Stack>
              </form>

              {(hasOAuth || providers.email) && (
                <Divider sx={{ my: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    Or use production methods
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

          {/* No providers configured fallback */}
          {!providers.dev && !hasOAuth && !providers.email && (
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