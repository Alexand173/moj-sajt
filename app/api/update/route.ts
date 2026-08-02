import { NextResponse } from 'next/server';
import { updateMusicCharts } from '@/lib/auto-updater';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await updateMusicCharts();
    return NextResponse.json({ success: true, message: 'Music charts successfully updated.' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown chart sync error.';
    console.error('Chart sync failed:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}