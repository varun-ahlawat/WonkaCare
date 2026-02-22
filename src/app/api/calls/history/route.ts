import { NextResponse } from 'next/server';
import { getCompletedCalls } from '@/lib/db';

export async function GET() {
  const calls = await getCompletedCalls(100);
  return NextResponse.json(calls);
}
