// Google Auth API - Combined endpoint for calendar OAuth
// Routes: /init, /callback, /refresh

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { action } = req.query;

  try {
    switch (action) {
      case 'init':
        return handleInit(req, res);
      case 'callback':
        return handleCallback(req, res);
      case 'refresh':
        return handleRefresh(req, res);
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(500).json({ error: 'Internal error', message: error.message });
  }
}

// Initiate OAuth flow
async function handleInit(req, res) {
  const clientId = process.env.GOOGLE_CLIENT_ID || '';
  const redirectUri = `https://mission-control-v3-pearl.vercel.app/api/auth/google?action=callback`;

  if (!clientId) {
    return res.status(500).json({
      error: 'Google Client ID not configured',
      message: 'Please set GOOGLE_CLIENT_ID environment variable'
    });
  }

  const scopes = [
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/calendar.events'
  ];

  const oauthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  oauthUrl.searchParams.set('client_id', clientId);
  oauthUrl.searchParams.set('redirect_uri', redirectUri);
  oauthUrl.searchParams.set('response_type', 'code');
  oauthUrl.searchParams.set('scope', scopes.join(' '));
  oauthUrl.searchParams.set('access_type', 'offline');
  oauthUrl.searchParams.set('prompt', 'select_account consent');
  oauthUrl.searchParams.set('state', 'calendar-auth');

  res.writeHead(302, { Location: oauthUrl.toString() });
  res.end();
}

// OAuth callback handler
async function handleCallback(req, res) {
  const { code, error: oauthError } = req.query;

  if (oauthError) {
    console.error('OAuth error:', oauthError);
    return res.redirect('/?error=oauth_denied');
  }

  if (!code) {
    return res.redirect('/?error=no_code');
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = `https://mission-control-v3-pearl.vercel.app/api/auth/google?action=callback`;

  if (!clientId || !clientSecret) {
    return res.redirect('/?error=not_configured');
  }

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    })
  });

  const tokens = await tokenResponse.json();

  if (tokens.error) {
    console.error('Token exchange error:', tokens);
    return res.redirect('/?error=token_exchange_failed');
  }

  // Verify refresh_token exists before storing
  if (!tokens.refresh_token) {
    console.error('No refresh_token returned!', tokens);
    return res.redirect('/?error=no_refresh_token');
  }

  const safeExpiry = Date.now() + (tokens.expires_in * 1000);

  // Persist to Firebase RTDB via REST (server-side) so it works even when `firebase` isn't available in-browser.
  try {
    await fetch('https://winslow-756c3-default-rtdb.firebaseio.com/workspaces/winslow_main/auth/calendar.json', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiry: safeExpiry,
        updatedAt: Date.now()
      })
    });
  } catch (e) {
    console.error('Firebase token save failed:', e);
  }

  res.setHeader('Content-Type', 'text/html');
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Calendar Connected</title>
      <script>
        localStorage.removeItem('mc3_calendar_token');
        localStorage.removeItem('mc3_calendar_refresh');
        sessionStorage.removeItem('mc3_calendar_refresh_backup');
        localStorage.setItem('mc3_calendar_connected', 'true');
        localStorage.setItem('mc3_calendar_expiry', '${safeExpiry}');
        window.location.href = '/?calendar=connected';
      </script>
    </head>
    <body>
      <p>Connecting calendar... Please wait.</p>
    </body>
    </html>
  `);
}

// Token refresh handler
async function handleRefresh(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { refresh_token } = req.body;

  if (!refresh_token) {
    return res.status(400).json({ error: 'Missing refresh_token' });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return res.status(500).json({ error: 'Not configured' });
  }

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token'
    })
  });

  const tokens = await tokenResponse.json();

  if (tokens.error) {
    console.error('Token refresh error:', tokens.error_description || tokens.error);
    return res.status(401).json({ 
      error: 'Refresh failed', 
      message: tokens.error_description || tokens.error,
      code: tokens.error
    });
  }

  // Calculate expiry timestamp
  const expiryMs = Date.now() + (tokens.expires_in * 1000);

  return res.status(200).json({
    access_token: tokens.access_token,
    expires_in: tokens.expires_in,
    expiry: expiryMs,
    refresh_token: tokens.refresh_token || refresh_token
  });
}
