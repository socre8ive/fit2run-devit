import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { executeQuery } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    // Find user in database
    const users = await executeQuery(
      'SELECT id, name, email, password_hash, is_admin FROM users WHERE name = ? OR email = ?',
      [username, username]
    ) as any[];
    
    if (users.length === 0) {
      return NextResponse.json(
        { message: 'Invalid username or password' },
        { status: 401 }
      );
    }

    const user = users[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    
    if (!isValidPassword) {
      return NextResponse.json(
        { message: 'Invalid username or password' },
        { status: 401 }
      );
    }

    // Create a simple token (in production, use proper JWT)
    const token = Buffer.from(`${user.name}:${user.id}:${Date.now()}`).toString('base64');

    // Create response with cookie
    const response = NextResponse.json(
      { 
        message: 'Login successful', 
        username: user.name,
        email: user.email,
        isAdmin: user.is_admin 
      },
      { status: 200 }
    );

    // Set secure HTTP-only cookie
    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 86400, // 24 hours
      path: '/'
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}