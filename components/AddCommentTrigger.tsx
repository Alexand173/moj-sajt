'use client';
import { useState } from 'react';
import { saveComment } from '../app/actions'; // Uvezi novu funkciju

export default function AddCommentTrigger({ region }: { region: string }) {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div className="my-4">
      {!isOpen ? (
        <button onClick={() => setIsOpen(true)} className="text-xs font-bold uppercase tracking-widest hover:underline">
          + ADD COMMENT
        </button>
      ) : (
        <form action={async (fd) => { await saveComment(fd); setIsOpen(false); }} className="border-2 border-black p-3 bg-zinc-50">
          <input type="hidden" name="region" value={region} />
          <input name="user_name" placeholder="YOUR NAME" className="w-full border p-1 mb-1 text-sm" required />
          <textarea name="text" placeholder="YOUR COMMENT..." className="w-full border p-1 mb-1 text-sm" required />
          <div className="flex gap-2">
            <button type="submit" className="bg-black text-white px-3 py-1 text-xs font-bold">SEND</button>
            <button type="button" onClick={() => setIsOpen(false)} className="text-xs underline">Cancel</button>
          </div>
        </form>
      )}
    </div>
  );
}