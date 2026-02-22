import { NextRequest, NextResponse } from 'next/server';
import { getCallByIdFromDB, updateCallStatus } from '@/lib/db';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const call = await getCallByIdFromDB(id);
  if (!call) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json(call);
}

const VALID_STATUSES = ['Needs review', 'Escalated', 'Resolved'];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { status } = body as { status?: string };
  if (!status || !VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` }, { status: 400 });
  }
  await updateCallStatus(id, status);
  const updated = await getCallByIdFromDB(id);
  return NextResponse.json(updated);
}
