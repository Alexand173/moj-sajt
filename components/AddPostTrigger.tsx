'use client'
import { useState } from 'react';
import CommunityForm from './CommunityForm'; // tvoja komponenta

export default function CommunityPage({ region }: { region: string }) {
  const [showForm, setShowForm] = useState(false);

  return (
    <div>
      {/* Dugme koje pali formu */}
      {!showForm && (
        <button 
          onClick={() => setShowForm(true)}
          className="bg-black text-white px-6 py-3 font-bold uppercase"
        >
          publish a new post
        </button>
      )}

      {/* Forma se prikazuje samo ako je showForm true */}
      {showForm && (
        <div className="mt-4">
          <CommunityForm region={region} />
          <button 
            onClick={() => setShowForm(false)} 
            className="mt-2 text-xs underline"
          >
            Odustani
          </button>
        </div>
      )}
    </div>
  );
}