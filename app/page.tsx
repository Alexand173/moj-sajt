import { redirect } from 'next/navigation';

export default function HomePage() {
  // Automatski šalje korisnika na US Rock čim otvori sajt
  redirect('/region/us/rock');
}