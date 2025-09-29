import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { auth } from './lib/auth'

export async function middleware(request: NextRequest) {
  const session = await auth()
  const { pathname } = request.nextUrl

  // Public routes - allow access without authentication
  if (
    pathname.startsWith('/auth') ||
    pathname === '/' ||
    pathname.startsWith('/setup') || // Setup flow
    pathname.startsWith('/api/auth') || // NextAuth.js API routes
    pathname.startsWith('/api/setup') || // Setup API routes
    pathname.startsWith('/_next') || // Next.js static files
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next()
  }

  // Dashboard routes - temporarily allow without authentication for development
  // TODO: Re-enable authentication for dashboard in production
  if (pathname.startsWith('/dashboard') && process.env.NODE_ENV === 'development') {
    return NextResponse.next()
  }

  // Dashboard routes in production - require authentication
  if (pathname.startsWith('/dashboard')) {
    if (!session?.user) {
      // Redirect to sign in page
      const signInUrl = new URL('/auth/signin', request.url)
      signInUrl.searchParams.set('callbackUrl', pathname)
      return NextResponse.redirect(signInUrl)
    }

    // TODO: Add role-based access control in Phase 5
    // For now, all authenticated users can access everything
    // Note: User activity tracking removed from middleware due to Prisma edge runtime limitations
  }

  // API routes - temporarily allow without authentication for development
  // TODO: Re-enable authentication for API routes in production
  if (pathname.startsWith('/api') && process.env.NODE_ENV === 'development') {
    return NextResponse.next()
  }

  // API routes in production - require authentication
  if (pathname.startsWith('/api')) {
    if (!session?.user) {
      // Return 401 for API routes
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}