import { updateMusicCharts } from '@/lib/auto-updater'; // Putanja do tvog fajla

export async function GET(request: Request) {
  try {
    // Pozivamo funkciju koju smo upravo sredili
    await updateMusicCharts();
    return new Response('Ažuriranje uspešno završeno!', { status: 200 });
  } catch (error) {
    console.error('Greška pri cron job-u:', error);
    return new Response('Greška pri ažuriranju', { status: 500 });
  }
}