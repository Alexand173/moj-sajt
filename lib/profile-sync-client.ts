export async function syncCurrentUserProfile(): Promise<void> {
  const response = await fetch('/api/auth/sync-profile', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    throw new Error('Could not synchronize the user profile.');
  }
}
