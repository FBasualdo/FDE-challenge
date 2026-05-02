import { NextResponse, type NextRequest } from 'next/server'

/**
 * Protect the (dashboard) route group. The backend issues a httpOnly cookie
 * named `session` on /auth/login. If absent, send the user to /login with a
 * `next` query param so we can bounce them back after a successful login.
 */
export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl
  const session = req.cookies.get('session')?.value
  if (session) return NextResponse.next()

  const loginUrl = req.nextUrl.clone()
  loginUrl.pathname = '/login'
  loginUrl.search = ''
  loginUrl.searchParams.set('next', `${pathname}${search}`)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  // Apply to all dashboard routes. /login, /api, /_next, static assets are excluded.
  matcher: [
    '/((?!login|api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt)$).*)',
  ],
}
