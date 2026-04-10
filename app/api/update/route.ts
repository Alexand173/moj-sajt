import { NextResponse } from 'next/server';
import { updateMusicCharts } from '@/lib/auto-updater';

export async function GET() {
  try {
    // Pozivamo robota da osveži pesme
    await updateMusicCharts();
    return NextResponse.json({ message: 'Uspešno ažurirano!' }, { status: 200 });
  } catch (error) {
    console.error('Greška:', error);
    return NextResponse.json({ error: 'Greška pri ažuriranju' }, { status: 500 });
  }
}