'use client';
import { savePost } from '../app/actions';

export default function CommunityForm({ region }: { region: string }) {
  return (
    // IMPORTANT: No encType here!
    <form action={savePost} className="p-4 border-2 border-black space-y-4">
      <input type="hidden" name="region" value={region} />
      
      <input type="text" name="title" placeholder="Title..." required className="border p-2 w-full" />
      <input type="text" name="author" placeholder="Your name..." required className="border p-2 w-full" />
      <textarea name="content" placeholder="Content..." required className="border p-2 w-full" />
      
      {/* Name attribute must match formData.get('post_image') */}
      <input type="file" name="post_image" accept="image/*" required />
      
      <button type="submit" className="bg-black text-white p-2">PUBLISH</button>
    </form>
  );
}