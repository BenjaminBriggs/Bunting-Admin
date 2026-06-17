import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { identityFromRequest } from './lib/auth-session'
import { checkRateLimit, type RateLimitState } from './lib/rate-limit'

// Per-instance rate-limit store (see rate-limit.ts for the multi-instance caveat).
const rateLimitStore = new Map<string, RateLimitState>()

function clientIp(request: NextRequest): string {
  const fwd = request.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return request.headers.get('x-real-ip') ?? 'unknown'
}

// Authentication gate only. Authorization (roles / access list) is enforced in
// node-runtime route helpers, because Prisma cannot run in edge middleware.
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Throttle the expensive, abusable publish endpoint (signing + S3 upload).
  if (pathname.startsWith('/api/config/publish')) {
    const result = checkRateLimit(
      rateLimitStore,
      `publish:${clientIp(request)}`,
      Date.now(),
      { limit: 20, windowMs: 60_000 }
    )
    if (!result.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Try again shortly.' },
        {
          status: 429,
          headers: { 'Retry-After': String(Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000))) },
        }
      )
    }
  }

  // Public routes — reachable without authentication.
  if (
    pathname.startsWith('/auth') ||
    pathname === '/' ||
    pathname.startsWith('/api/auth') || // NextAuth.js endpoints
    pathname.startsWith('/api/health') || // health check for the load balancer
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next()
  }

  const identity = await identityFromRequest(request.headers)

  if (!identity) {
    if (pathname.startsWith('/api')) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    const signInUrl = new URL('/auth/signin', request.url)
    signInUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(signInUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static assets and image optimisation.
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
