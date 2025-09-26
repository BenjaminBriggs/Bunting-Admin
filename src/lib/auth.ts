import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import GitHub from "next-auth/providers/github"
import AzureAD from "next-auth/providers/azure-ad"
import Resend from "next-auth/providers/resend"
import Credentials from "next-auth/providers/credentials"
import { checkUserAccess, createOrUpdateUser, isFirstUser } from './access-control'

const providers = []

// Only add providers if they're properly configured
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    })
  )
}

if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  providers.push(
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    })
  )
}

if (process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET) {
  providers.push(
    AzureAD({
      clientId: process.env.MICROSOFT_CLIENT_ID,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
      // tenantId: process.env.MICROSOFT_TENANT_ID,
    })
  )
}

if (process.env.RESEND_API_KEY) {
  providers.push(
    Resend({
      apiKey: process.env.RESEND_API_KEY,
      from: process.env.EMAIL_FROM,
    })
  )
}

// Add email/password credentials for development
if (process.env.NODE_ENV === 'development' && process.env.DISABLE_DEV_AUTH !== 'true') {
  providers.push(
    Credentials({
      id: "credentials",
      name: "Email & Password",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "admin@example.com" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials): Promise<any> {
        // Use environment variables with sensible defaults
        const adminEmail = process.env.DEV_ADMIN_EMAIL || 'admin@example.com';
        const adminPassword = process.env.DEV_ADMIN_PASSWORD || 'admin';

        // Check against configured credentials
        if (credentials?.email === adminEmail && credentials?.password === adminPassword) {
          return {
            id: String(credentials.email),
            email: String(credentials.email),
            name: String(credentials.email).split('@')[0],
            role: "ADMIN"
          }
        }

        // Fallback: allow any email with the configured admin password for flexibility
        if (credentials?.password === adminPassword && credentials?.email) {
          return {
            id: String(credentials.email),
            email: String(credentials.email),
            name: String(credentials.email).split('@')[0],
            role: "ADMIN"
          }
        }

        return null
      }
    })
  )
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  callbacks: {
    async signIn({ user, account }) {
      // Skip access list check for development credentials
      if (account?.provider === "credentials") {
        return true
      }

      // Check if user has access
      if (user.email) {
        // Check if this is the first user (always allowed)
        const firstUser = await isFirstUser()
        if (firstUser) {
          return true
        }

        // Check access list
        const hasAccess = await checkUserAccess(user.email)
        if (!hasAccess) {
          // Redirect to error page with access denied
          return '/auth/error?error=AccessDenied'
        }
      }

      return true
    },
    async jwt({ token, user, account }) {
      // Handle user creation/updates
      if (user && user.email) {
        // For dev credentials, use the role from the provider directly
        if (account?.provider === "credentials" && process.env.NODE_ENV === 'development') {
          token.role = user.role || "ADMIN"
          token.id = user.id
        } else {
          // For production OAuth providers, use database role
          const dbUser = await createOrUpdateUser({
            email: user.email,
            name: user.name,
            image: user.image
          })
          token.role = dbUser.role
          token.id = dbUser.id
        }
      }
      return token
    },
    async session({ session, token }) {
      // Add user info to session
      if (token.id) {
        session.user.id = token.id as string
        session.user.role = token.role as string
      }
      return session
    }
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  session: {
    strategy: "jwt",
    maxAge: 14 * 24 * 60 * 60, // 14 days
    updateAge: 24 * 60 * 60,    // 24 hours
  },
})