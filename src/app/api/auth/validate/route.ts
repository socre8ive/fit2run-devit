import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

const connection = mysql.createConnection({
  host: 'localhost',
  user: 'fit2run',
  password: 'Fit2Run1!',
  database: 'sales_data',
});

export async function GET(request: NextRequest) {
  try {
    const authToken = request.cookies.get('auth-token')?.value || request.cookies.get('auth-token-debug')?.value;
    
    if (!authToken) {
      return NextResponse.json({ valid: false, message: 'No auth token found' });
    }

    // Decode the token (format: base64(username:isAdmin:timestamp))
    const decoded = Buffer.from(authToken, 'base64').toString('utf-8');
    const [username, isAdmin, timestamp] = decoded.split(':');

    if (!username || !timestamp) {
      return NextResponse.json({ valid: false, message: 'Invalid token format' });
    }

    // Check if token is expired (24 hours)
    const tokenTime = parseInt(timestamp);
    const now = Date.now();
    const twentyFourHours = 24 * 60 * 60 * 1000;
    
    if (now - tokenTime > twentyFourHours) {
      return NextResponse.json({ valid: false, message: 'Token expired' });
    }

    // Verify user exists in database
    const [rows]: any = await (await connection).execute(
      'SELECT username, email, isAdmin FROM users WHERE username = ?',
      [username]
    );

    if (rows.length === 0) {
      return NextResponse.json({ valid: false, message: 'User not found' });
    }

    const user = rows[0];

    return NextResponse.json({ 
      valid: true, 
      username: user.username,
      email: user.email,
      isAdmin: user.isAdmin 
    });
  } catch (error) {
    console.error('Token validation error:', error);
    return NextResponse.json({ valid: false, message: 'Validation error' });
  }
}