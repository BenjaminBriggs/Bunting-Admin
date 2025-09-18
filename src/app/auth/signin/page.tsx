import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import SignInForm from '@/components/auth/SignInForm'
import { Container, Box, Typography } from '@mui/material'

export default async function SignInPage() {
  const session = await auth()

  if (session?.user) {
    redirect('/dashboard')
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
        <Box sx={{ mb: 4, textAlign: 'center' }}>
          <Typography variant="h3" component="h1" gutterBottom>
            Sign in to Bunting
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Feature flag management dashboard
          </Typography>
        </Box>

        <Box sx={{ width: '100%' }}>
          <SignInForm />
        </Box>
      </Box>
    </Container>
  )
}