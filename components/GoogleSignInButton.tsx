// components/GoogleSignInButton.tsx
'use client';

import { supabase } from '@/lib/supabase';
import { getOAuthRedirect } from '@/lib/oauth';

export default function GoogleSignInButton() {
  const handleGoogleSignIn = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: getOAuthRedirect(), // <-- УВЕК исправан URL
      },
    });

    if (error) {
      alert(error.message); // или неки тостер
    }
  };

  return (
    <button onClick={handleGoogleSignIn} className="...твој стил...">
      GOOGLE
    </button>
  );
}