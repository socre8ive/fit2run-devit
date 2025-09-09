import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const cookies = request.cookies.getAll();
  const cookieInfo = cookies.map(cookie => ({
    name: cookie.name,
    value: cookie.value.substring(0, 20) + '...', // Truncate for security
    hasAuthToken: cookie.name === 'auth-token',
    hasAuthDebug: cookie.name === 'auth-token-debug'
  }));

  return NextResponse.json({
    message: 'Cookie debug info',
    totalCookies: cookies.length,
    cookies: cookieInfo,
    authToken: request.cookies.get('auth-token')?.value ? 'EXISTS' : 'MISSING',
    authDebug: request.cookies.get('auth-token-debug')?.value ? 'EXISTS' : 'MISSING'
  });
}