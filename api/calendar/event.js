import { clearServerCalendarTokens, getServerCalendarAccessToken } from '../lib/google-calendar-auth.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (!['POST', 'PUT', 'DELETE'].includes(req.method)) {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const accessToken = await getServerCalendarAccessToken();
    if (!accessToken) {
      return res.status(401).json({
        connected: false,
        error: 'Calendar not connected'
      });
    }

    const eventId = req.query.id;
    if ((req.method === 'PUT' || req.method === 'DELETE') && !eventId) {
      return res.status(400).json({ error: 'Missing event id' });
    }

    const url = eventId
      ? `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`
      : 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

    const response = await fetch(url, {
      method: req.method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(req.method === 'DELETE' ? {} : { 'Content-Type': 'application/json' })
      },
      ...(req.method === 'DELETE' ? {} : { body: JSON.stringify(req.body || {}) })
    });

    if (response.status === 401) {
      try { await clearServerCalendarTokens(); } catch (e) {}
      return res.status(401).json({
        connected: false,
        error: 'Calendar token expired or revoked'
      });
    }

    if (!response.ok) {
      const detail = await response.text();
      return res.status(response.status).json({
        error: 'Calendar API request failed',
        detail: detail.slice(0, 600)
      });
    }

    if (req.method === 'DELETE') {
      return res.status(200).json({ ok: true });
    }

    const event = await response.json();
    return res.status(200).json({ ok: true, event });
  } catch (error) {
    console.error('Calendar event API error:', error);
    return res.status(500).json({
      error: 'Failed to update calendar event',
      message: error.message
    });
  }
}
