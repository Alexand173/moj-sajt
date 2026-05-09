'use client'

import { useState } from 'react';
import { syncConcerts } from '../app/actions'; // Ispravljeno ime!

export default function AdminSyncButton() {
  const [loading, setLoading] = useState(false);

  const handleSync = async () => {
    setLoading(true);
    
    // Sada TS zna da result ima 'success' i 'count'
    const result = await syncConcerts(); 

    if (result.success) {
      alert(`Uspešno sinhronizovano ${result.count} koncerata!`);
    } else {
      alert(`Greška: ${result.message}`);
    }
    
    setLoading(false);
  };

  return (
    <button 
      onClick={handleSync}
      disabled={loading}
      className="bg-purple-600 text-white px-8 py-4 font-black uppercase tracking-widest hover:bg-black"
    >
      {loading ? 'SINKRONIZUJEM...' : 'POVUČI SVEŽE KONCERTE'}
    </button>
  );
}