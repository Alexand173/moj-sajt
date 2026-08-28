'use client'

import { useState } from 'react';

import CommunityForm from './CommunityForm'; // tvoja komponenta

type PublishMode = 'post' | 'news';

export default function CommunityPage({ region, mode = 'post' }: { region: string; mode?: PublishMode }) {

  const [showForm, setShowForm] = useState(false);
  const isNews = mode === 'news';



  return (

    <div>

      {/* Dugme koje pali formu */}

      {!showForm && (

        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="inline-flex items-center border border-white/20 px-4 py-2 text-[9px] font-black tracking-[0.16em] text-white uppercase transition-colors hover:border-accent-red hover:bg-accent-red"
        >
          {isNews ? 'Publish a news' : 'Publish a new post'}
        </button>

      )}



      {/* Forma se prikazuje samo ako je showForm true */}

      {showForm && (

        <div className="mt-4">

          <CommunityForm region={region} mode={mode} />

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