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

  // Protected routes - require authentication
  if (pathname.startsWith('/dashboard') || pathname.startsWith('/api')) {
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