// Calendar API endpoint for Mission Control
// Fetches Google Calendar events
import { clearServerCalendarTokens, getServerCalendarAccessToken } from '../lib/google-calendar-auth.js';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get days parameter (default 7 days for better lookahead)
    const days = parseInt(req.query.days) || 7;
    const maxResults = parseInt(req.query.maxResults) || 20;
    
    // Prefer server-side token storage, with bearer support kept for older clients.
    const authHeader = req.headers.authorization;
    let accessToken = null;
    
    if (authHeader?.startsWith('Bearer ')) {
      accessToken = authHeader.slice(7);
    }

    if (!accessToken) {
      accessToken = await getServerCalendarAccessToken();
    }
    
    // If no token provided, return not connected
    if (!accessToken) {
      return res.status(200).json({ 
        events: [],
        connected: false,
        message: 'Calendar not connected'
      });
    }

    // Calculate date range
    const now = new Date();
    const timeMin = now.toISOString();
    // Default to a 90 day window if we want "all upcoming"
    const windowDays = req.query.all === 'true' ? 90 : days;
    const timeMax = new Date(now.getTime() + (windowDays * 24 * 60 * 60 * 1000)).toISOString();

    // Fetch events from Google Calendar
    const calendarUrl = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
    calendarUrl.searchParams.set('timeMin', timeMin);
    calendarUrl.searchParams.set('timeMax', timeMax);
    calendarUrl.searchParams.set('singleEvents', 'true');
    calendarUrl.searchParams.set('orderBy', 'startTime');
    calendarUrl.searchParams.set('maxResults', maxResults.toString());

    const response = await fetch(calendarUrl.toString(), {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      if (response.status === 401) {
        try { await clearServerCalendarTokens(); } catch (e) {}
        return res.status(401).json({
          events: [],
          connected: false,
          message: 'Token expired, please reconnect'
        });
      }
      throw new Error(`Calendar API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Format events
    const events = (data.items || []).map(item => ({
      id: item.id,
      summary: item.summary || 'Untitled Event',
      start: item.start?.dateTime || item.start?.date,
      end: item.end?.dateTime || item.end?.date,
      location: item.location,
      hangoutLink: item.hangoutLink,
      description: item.description
    }));

    return res.status(200).json({
      events,
      connected: true,
      message: 'Calendar connected'
    });
    
  } catch (error) {
    console.error('Calendar API error:', error);
    return res.status(500).json({ 
      events: [],
      connected: false,
      error: 'Failed to fetch calendar events',
      message: error.message 
    });
  }
}
