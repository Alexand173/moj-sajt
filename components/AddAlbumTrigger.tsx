'use client'
import { createClient } from '@supabase/supabase-js';
import { useState } from 'react';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Define type for tracking the status of each file
type FileStatus = {
  id: string;
  name: string;
  status: 'pending' | 'uploading' | 'done' | 'error';
};

export default function AddAlbumTrigger({ region }: { region: string }) {
  const [loading, setLoading] = useState(false);
  const [fileStatuses, setFileStatuses] = useState<FileStatus[]>([]);
  const [files, setFiles] = useState<File[]>([]);

  // Function for sanitizing filename (crucial for Storage)
  const sanitizeFileName = (name: string) => {
    // Replace everything that is not a letter, number, or dot with an underscore
    return name.replace(/[^a-zA-Z0-9.-]/g, '_').toLowerCase();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      
      // 1. Merge old files (prev) with new ones (newFiles)
      setFiles(prev => [...prev, ...newFiles]);

      // 2. Update status list in the same way
      setFileStatuses(prev => [
        ...prev, 
        ...newFiles.map((f, idx) => ({
          id: `${f.name}-${Date.now()}-${idx}`, // Use timestamp to ensure uniqueness
          name: f.name,
          status: 'pending' as const
        }))
      ]);
    }
  };

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const albumName = formData.get('album_name') as string;
    const imageUrls: string[] = [];

    // Loop to upload each image individually
    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Update status to "uploading"
      setFileStatuses(prev => prev.map((s, idx) => idx === i ? { ...s, status: 'uploading' } : s));

      // Inside your upload loop:
      const safeName = sanitizeFileName(file.name);
      const fileName = `${Date.now()}-${safeName}`; // Add timestamp to ensure uniqueness

      const { error: uploadError } = await supabase.storage
        .from('album-images')
        .upload(fileName, file);

      if (uploadError) {
        console.error("Error during upload:", uploadError);
        setFileStatuses(prev => prev.map((s, idx) => idx === i ? { ...s, status: 'error' } : s));
        continue; // Skip this one, move to the next
      }

      const { data } = supabase.storage.from('album-images').getPublicUrl(fileName);
      imageUrls.push(data.publicUrl);

      // Update status to "done"
      setFileStatuses(prev => prev.map((s, idx) => idx === i ? { ...s, status: 'done' } : s));
    }

    // Insert into database (only if there are URLs)
    if (imageUrls.length > 0) {
      try {
        const { error: dbError } = await supabase.from('concert_albums').insert([{ 
          album_name: albumName, 
          region: region, 
          images: imageUrls 
        }]);

        if (dbError) throw dbError; // If there is an error, go directly to the catch block

        alert("Album successfully created!");
        
        // Reset form state
        setFileStatuses([]);
        setFiles([]);
        // Optional: you can reset input fields here if using refs
      } catch (err) {
        console.error("Error saving to database:", err);
        alert("Images uploaded, but saving to the database failed. Please try again.");
      }
    } else {
      alert("No images were successfully uploaded.");
    }

    setLoading(false);
  } // End of handleUpload function

  return (
    <form onSubmit={handleUpload} className="p-4 border border-gray-300 rounded-lg space-y-4">
      <h2 className="font-bold">Add New Album</h2>
      
      <input 
        type="text" 
        name="album_name" 
        placeholder="Album Name" 
        required 
        className="w-full border p-2 rounded"
      />
      {/* 3. New Input for Author */}
      <input 
        type="text" 
        name="author" 
        placeholder="Author Name" 
        required 
        className="w-full border p-2 rounded"
      />
      <input 
        type="file" 
        multiple 
        onChange={handleFileChange} 
        required 
        className="w-full"
      />
      
      {/* List of files with statuses */}
      <ul className="text-sm space-y-1">
        {fileStatuses.map((f) => (
          <li key={f.id} className="flex justify-between border-b py-1">
            <span className="truncate w-1/2">{f.name}</span>
            <span className="font-semibold">
              {f.status === 'pending' && "⌛ Pending"}
              {f.status === 'uploading' && "🚀 Uploading..."}
              {f.status === 'done' && "✅ Success"}
              {f.status === 'error' && "❌ Error"}
            </span>
          </li>
        ))}
      </ul>

      <button 
        type="submit" 
        disabled={loading || fileStatuses.length === 0}
        className="bg-black text-white px-4 py-2 rounded w-full disabled:bg-gray-400"
      >
        {loading ? "Processing..." : "Save Album"}
      </button>
    </form>
  );
}