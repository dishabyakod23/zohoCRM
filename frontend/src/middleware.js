import { NextResponse } from 'next/server';

const PUBLIC_PATHS = new Set(['/login', '/forgot-password', '/reset-password']);

export function middleware(request) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.get('crm_session')?.value === '1';

  if (PUBLIC_PATHS.has(pathname)) {
    if (hasSession) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return NextResponse.next();
  }

  if (!hasSession) {
    const loginUrl = new URL('/login', request.url);
    if (pathname !== '/') loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
