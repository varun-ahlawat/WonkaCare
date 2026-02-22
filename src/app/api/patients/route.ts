import { NextResponse } from 'next/server';
import { getAllPatientsFromDB } from '@/lib/db';

export async function GET() {
  const patients = await getAllPatientsFromDB();
  return NextResponse.json(patients);
}
