import { Container, Box, Typography, Button, Alert } from '@mui/material'
import { AlertCircle } from '@mui/icons-material'
import Link from 'next/link'

interface ErrorPageProps {
  searchParams: { error?: string }
}

export default function ErrorPage({ searchParams }: ErrorPageProps) {
  const error = searchParams.error

  let message = 'An error occurred during authentication.'

  if (error === 'AccessDenied') {
    message = "Your email isn't authorized. Contact an admin to request access."
  } else if (error === 'CredentialsSignin') {
    message = 'Invalid credentials. Please check your username and password.'
  }

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          py: 4
        }}
      >
        <Box sx={{ textAlign: 'center' }}>
          <AlertCircle sx={{ fontSize: 64, color: 'error.main', mb: 2 }} />

          <Typography variant="h4" component="h1" gutterBottom>
            Access Denied
          </Typography>

          <Alert severity="error" sx={{ mb: 3, textAlign: 'left' }}>
            {message}
          </Alert>

          <Button
            component={Link}
            href="/auth/signin"
            variant="contained"
            size="large"
          >
            Try Again
          </Button>
        </Box>
      </Box>
    </Container>
  )
}