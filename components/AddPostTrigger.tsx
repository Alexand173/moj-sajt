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
          type="button"
          onClick={() => setShowForm(true)}
          className="inline-flex items-center border border-white/20 px-4 py-2 text-[9px] font-black tracking-[0.16em] text-white uppercase transition-colors hover:border-accent-red hover:bg-accent-red"
        >
          Publish a new post
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

            Cancel

          </button>

        </div>

      )}

    </div>

  );

}