import { Google, GitHub, Microsoft, Email, Password } from '@mui/icons-material'
import { AuthProvider } from './types'

export const authProviders: AuthProvider[] = [
  // Development-only simple auth option
  ...(process.env.NODE_ENV === 'development' ? [{
    id: 'credentials',
    name: 'Email & Password',
    icon: <Password />,
    description: 'Simple email/password authentication (Development only)',
    required_fields: ['DEV_ADMIN_EMAIL', 'DEV_ADMIN_PASSWORD']
  }] : []),
  {
    id: 'google',
    name: 'Google',
    icon: <Google />,
    description: 'Perfect for teams using Google Workspace',
    required_fields: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET']
  },
  {
    id: 'github',
    name: 'GitHub',
    icon: <GitHub />,
    description: 'Ideal for developer teams already on GitHub',
    required_fields: ['GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET']
  },
  {
    id: 'microsoft',
    name: 'Microsoft',
    icon: <Microsoft />,
    description: 'Great for organizations using Microsoft 365/Azure AD',
    required_fields: ['MICROSOFT_CLIENT_ID', 'MICROSOFT_CLIENT_SECRET', 'MICROSOFT_TENANT_ID']
  },
  {
    id: 'email',
    name: 'Magic Link Email',
    icon: <Email />,
    description: 'Passwordless email-based authentication',
    required_fields: ['RESEND_API_KEY', 'EMAIL_FROM']
  }
]