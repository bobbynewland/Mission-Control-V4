const FIREBASE_CAL_AUTH_URL = 'https://winslow-756c3-default-rtdb.firebaseio.com/workspaces/winslow_main/auth/calendar.json';
const EXPIRY_BUFFER_MS = 5 * 60 * 1000;

async function readStoredTokens() {
  const response = await fetch(FIREBASE_CAL_AUTH_URL, { method: 'GET' });
  if (!response.ok) {
    throw new Error(`Calendar token store read failed: ${response.status}`);
  }
  const data = await response.json();
  return data || null;
}

async function saveStoredTokens(tokens) {
  await fetch(FIREBASE_CAL_AUTH_URL, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...tokens,
      updatedAt: Date.now()
    })
  });
}

async function refreshAccessToken(refreshToken) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth is not configured');
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token'
    })
  });

  const data = await response.json();
  if (!response.ok || data.error) {
    const err = new Error(data.error_description || data.error || 'Calendar refresh failed');
    err.code = data.error;
    err.status = response.status;
    throw err;
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken,
    expiry: Date.now() + (data.expires_in * 1000)
  };
}

export async function getServerCalendarAccessToken() {
  const stored = await readStoredTokens();
  if (!stored?.refreshToken) {
    return null;
  }

  const expiry = Number.parseInt(stored.expiry, 10);
  const hasValidAccessToken = stored.accessToken && expiry && Date.now() < expiry - EXPIRY_BUFFER_MS;
  if (hasValidAccessToken) {
    return stored.accessToken;
  }

  const refreshed = await refreshAccessToken(stored.refreshToken);
  await saveStoredTokens(refreshed);
  return refreshed.accessToken;
}

export async function clearServerCalendarTokens() {
  await fetch(FIREBASE_CAL_AUTH_URL, { method: 'DELETE' });
}
