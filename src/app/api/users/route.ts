import { NextRequest, NextResponse } from 'next/server'
import { executeQuery } from '@/lib/db'
import bcrypt from 'bcryptjs'

export async function GET() {
  try {
    const users = await executeQuery(`
      SELECT id, name, email, is_admin, created_at, updated_at 
      FROM users 
      ORDER BY created_at DESC
    `) as any[]

    return NextResponse.json({ users })
  } catch (error) {
    console.error('Get users error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, email, password, isAdmin } = await request.json()

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: 'Name, email, and password are required' },
        { status: 400 }
      )
    }

    // Check if email already exists
    const existingUsers = await executeQuery(
      'SELECT id FROM users WHERE email = ?',
      [email]
    ) as any[]

    if (existingUsers.length > 0) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 409 }
      )
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10)

    // Insert new user
    await executeQuery(`
      INSERT INTO users (name, email, password_hash, is_admin) 
      VALUES (?, ?, ?, ?)
    `, [name, email, passwordHash, isAdmin ? 1 : 0])

    return NextResponse.json({ 
      success: true, 
      message: 'User created successfully' 
    })
  } catch (error) {
    console.error('Create user error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('id')

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    await executeQuery('DELETE FROM users WHERE id = ?', [userId])

    return NextResponse.json({ 
      success: true, 
      message: 'User deleted successfully' 
    })
  } catch (error) {
    console.error('Delete user error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}