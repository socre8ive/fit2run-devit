import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ message: 'Test webhook route working' });
}

export async function POST() {
  return NextResponse.json({ message: 'Test webhook POST working' });
}