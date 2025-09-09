import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json(
        { message: 'Not authenticated' },
        { status: 401 }
      );
    }

    // For now, just check if token exists (simplified)
    // In production, you'd want to validate this properly
    try {
      const decoded = Buffer.from(token, 'base64').toString();
      const [username, userId, timestamp] = decoded.split(':');
      
      // Check if token is not expired (24 hours)
      const tokenTime = parseInt(timestamp);
      const now = Date.now();
      const hoursSinceToken = (now - tokenTime) / (1000 * 60 * 60);
      
      if (hoursSinceToken > 24) {
        return NextResponse.json(
          { message: 'Token expired' },
          { status: 401 }
        );
      }

      return NextResponse.json(
        { 
          message: 'Authenticated',
          username,
          userId: parseInt(userId)
        },
        { status: 200 }
      );
    } catch (decodeError) {
      return NextResponse.json(
        { message: 'Invalid token' },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error('Auth check error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}