import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday, addWeeks, subWeeks, startOfWeek, endOfWeek, addDays, subDays, getHours, getMinutes, setHours, setMinutes } from 'date-fns';
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  X,
  Video,
  Calendar as CalendarIcon,
  List
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Mobile-optimized Calendar Component
const Calendar = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState('month'); // 'month', 'week', 'day', 'list'
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(null);
  const [showBottomSheet, setShowBottomSheet] = useState(false);
  const [showEventForm, setShowEventForm] = useState(false);
  const [showEventDetail, setShowEventDetail] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [sheetHeight, setSheetHeight] = useState('50vh'); // '50vh' or '90vh'
  const [newEvent, setNewEvent] = useState({
    title: '',
    start: '',
    end: '',
    location: '',
    description: ''
  });
  
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const isRefreshing = useRef(false); // Prevent concurrent refresh

  // Firebase token sync - REST is sufficient for unauthenticated reads/writes
  // sessionStorage is used as insurance against localStorage clearing by ITP/mobile OS
  const FIREBASE_CAL_AUTH_URL = 'https://winslow-756c3-default-rtdb.firebaseio.com/workspaces/winslow_main/auth/calendar.json';

  // Sync tokens from Firebase (REST) + sessionStorage backup
  const syncFromFirebase = useCallback(async () => {
    // Try sessionStorage first (immune to localStorage clearing)
    const ssRefresh = sessionStorage.getItem('mc3_calendar_refresh_backup');
    
    try {
      const resp = await fetch(FIREBASE_CAL_AUTH_URL, { method: 'GET' });
      const data = await resp.json();
      if (data && data.accessToken && data.refreshToken) {
        localStorage.setItem('mc3_calendar_token', data.accessToken);
        localStorage.setItem('mc3_calendar_refresh', data.refreshToken);
        localStorage.setItem('mc3_calendar_expiry', String(data.expiry || ''));
        try { sessionStorage.setItem('mc3_calendar_refresh_backup', data.refreshToken); } catch (e) {}
        console.log('📱 Tokens restored from Firebase');
        return { accessToken: data.accessToken, refreshToken: data.refreshToken, expiry: data.expiry };
      }
    } catch (err) {
      console.warn('Firebase REST sync error:', err.message);
    }
    
    // If we have a sessionStorage backup refresh token, return it for silent re-auth
    if (ssRefresh) {
      console.log('📱 Refresh token recovered from sessionStorage backup');
      return { accessToken: null, refreshToken: ssRefresh, expiry: null };
    }
    
    return null;
  }, []);

  // Save tokens to Firebase (REST) + sessionStorage backup
  const saveToFirebase = useCallback(async (accessToken, refreshToken, expiry) => {
    const payload = { accessToken, refreshToken, expiry, updatedAt: Date.now() };
    // Always persist refresh token to sessionStorage as last-resort backup
    try { sessionStorage.setItem('mc3_calendar_refresh_backup', refreshToken); } catch (e) {}
    try {
      await fetch(FIREBASE_CAL_AUTH_URL, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      console.log('📱 Tokens saved to Firebase + sessionStorage backup');
    } catch (err) {
      console.error('Firebase save error:', err.message);
      // Firebase write failed but sessionStorage backup succeeded — not fatal
    }
  }, []);

  // Clear tokens locally (marks needsAuth) but NEVER delete refresh token —
  // it may still be valid and can be used to re-authenticate silently.
  // Only delete refresh token when server explicitly returns invalid_grant.
  const clearAccessToken = useCallback(async () => {
    localStorage.removeItem('mc3_calendar_token');
    localStorage.removeItem('mc3_calendar_expiry');
    setNeedsAuth(true);
    // Refresh token is kept — it's still valid until explicitly revoked
    console.log('🔓 Access token cleared, refresh token preserved for silent re-auth');
  }, []);

  // Full token wipe — only call when user explicitly signs out or OAuth is revoked
  const clearAllTokens = useCallback(async () => {
    localStorage.removeItem('mc3_calendar_token');
    localStorage.removeItem('mc3_calendar_expiry');
    localStorage.removeItem('mc3_calendar_refresh');
    sessionStorage.removeItem('mc3_calendar_refresh_backup');
    setNeedsAuth(true);
    try {
      await fetch(FIREBASE_CAL_AUTH_URL, { method: 'DELETE' });
    } catch (err) { /* best effort */ }
  }, []);

  // Get valid token (refresh if expired) - with Firebase sync
  const getValidToken = useCallback(async () => {
    // Prevent concurrent refresh attempts
    if (isRefreshing.current) {
      console.log('⏳ Token refresh in progress, waiting...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      // Return what's in localStorage after refresh settles
      return localStorage.getItem('mc3_calendar_token');
    }
    
    let token = localStorage.getItem('mc3_calendar_token');
    let expiry = localStorage.getItem('mc3_calendar_expiry');
    let refreshToken = localStorage.getItem('mc3_calendar_refresh');

    // If no token in localStorage, try Firebase (authenticated + REST fallback)
    if (!token && !expiry) {
      console.log('🔍 No local token, checking Firebase...');
      const fbData = await syncFromFirebase();
      if (fbData) {
        token = fbData.accessToken;
        refreshToken = fbData.refreshToken;
        expiry = fbData.expiry;
      } else {
        // Last resort: check sessionStorage for refresh token only
        const backupRefresh = sessionStorage.getItem('mc3_calendar_refresh_backup');
        if (backupRefresh) {
          console.log('🔄 Restored refresh token from sessionStorage backup, attempting silent re-auth...');
          refreshToken = backupRefresh;
          // Trigger re-auth without wiping
          localStorage.setItem('mc3_calendar_refresh', refreshToken);
        }
      }
    }

    if (!token && !refreshToken) {
      setNeedsAuth(true);
      return null;
    }

    // Check if token is expired (with 5 min buffer for safety)
    const isExpired = !expiry || Date.now() > parseInt(expiry) - (5 * 60 * 1000);

    if (!isExpired) {
      return token; // Token still valid
    }

    // Token expired — try to refresh
    if (!refreshToken) {
      console.log('❌ No refresh token available, attempting Firebase restore...');
      await syncFromFirebase();
      const rt = localStorage.getItem('mc3_calendar_refresh');
      if (!rt) {
        setNeedsAuth(true);
        return null;
      }
      refreshToken = rt;
    }

    // Mark refresh in progress
    isRefreshing.current = true;

    try {
      console.log('🔄 Attempting token refresh...');
      const response = await fetch('/api/auth/google?action=refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken })
      });

      if (!response.ok) {
        // Try to parse error for invalid_grant (refresh token truly dead)
        let errorData;
        try { errorData = JSON.parse(await response.text()); } catch (e) { errorData = {}; }
        const isInvalidGrant = response.status === 401 || errorData?.error === 'invalid_grant' || errorData?.error === 'invalid_client';
        
        if (isInvalidGrant) {
          // Refresh token is genuinely revoked — full sign-out required
          console.error('❌ Refresh token revoked, clearing all tokens:', errorData?.message);
          await clearAllTokens();
        } else {
          // Transient error (network, server 500, etc.) — keep refresh token, just clear access
          console.error('❌ Token refresh failed (transient):', response.status, errorData?.message || '');
          await clearAccessToken();
        }
        isRefreshing.current = false;
        return null;
      }

      const data = await response.json();

      if (!data.access_token) {
        console.error('❌ No access_token in refresh response');
        await clearAccessToken();
        isRefreshing.current = false;
        return null;
      }

      // Store new tokens in localStorage
      const newExpiry = data.expiry || (Date.now() + (data.expires_in * 1000));
      localStorage.setItem('mc3_calendar_token', data.access_token);
      localStorage.setItem('mc3_calendar_expiry', newExpiry.toString());
      
      // Preserve refresh token (Google may not return new one)
      const newRefreshToken = data.refresh_token || refreshToken;
      localStorage.setItem('mc3_calendar_refresh', newRefreshToken);
      
      // Save to Firebase for cross-device persistence
      await saveToFirebase(data.access_token, newRefreshToken, newExpiry);
      
      setNeedsAuth(false);
      isRefreshing.current = false;
      console.log('✅ Token refreshed successfully');
      return data.access_token;
    } catch (err) {
      console.error('❌ Token refresh error (network/exception):', err.message);
      // Network error — don't wipe refresh token, just clear access token
      await clearAccessToken();
      isRefreshing.current = false;
      return null;
    }
  }, [syncFromFirebase, saveToFirebase, clearAccessToken, clearAllTokens]);

  // Load events
  useEffect(() => {
    loadEvents();

    // Auto-refresh token on tab visibility change (the "Wake Up" fix)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('🔄 Tab visible, checking calendar vitals...');
        loadEvents();
      }
    };

    // Poll for new events every 60 seconds
    const pollInterval = setInterval(() => {
      console.log('🔄 Polling for calendar updates...');
      loadEvents();
    }, 60 * 1000);

    // Proactive background refresh every 30 minutes
    const refreshInterval = setInterval(() => {
      console.log('🕒 Proactive token heartbeat...');
      getValidToken();
    }, 30 * 60 * 1000);

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(refreshInterval);
      clearInterval(pollInterval);
    };
  }, []);

  // Watch for external navigation with event ID (Today -> Calendar)
  useEffect(() => {
    if (events.length > 0) {
      const openEventId = localStorage.getItem('mc3_open_event_id');
      if (openEventId) {
        localStorage.removeItem('mc3_open_event_id');
        const event = events.find(e => e.id === openEventId);
        if (event) {
          setEditingEvent(event);
          setNewEvent({
            title: event.title,
            start: event.start.toISOString().slice(0, 16),
            end: event.end.toISOString().slice(0, 16),
            location: event.location || '',
            description: event.description || ''
          });
          setShowEventForm(true);
        }
      }
    }
  }, [events]);

  const loadEvents = async () => {
    try {
      const token = await getValidToken();
      if (!token) {
        setLoading(false);
        return;
      }

      const now = new Date();
      const timeMin = now.toISOString();
      const timeMax = new Date(now.getTime() + (60 * 24 * 60 * 60 * 1000)).toISOString();

      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (!response.ok) throw new Error('Failed to fetch');

      const data = await response.json();
      
      const formattedEvents = (data.items || []).map(item => ({
        id: item.id,
        title: item.summary || 'Untitled',
        start: new Date(item.start?.dateTime || item.start?.date),
        end: new Date(item.end?.dateTime || item.end?.date),
        location: item.location,
        description: item.description,
        hangoutLink: item.hangoutLink,
        allDay: !item.start?.dateTime
      }));

      setEvents(formattedEvents);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Pull to refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadEvents();
  };

  // Swipe handling
  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    // Don't navigate if the target is a button (day cell)
    if (e.target.tagName === 'BUTTON' || e.target.closest('button')) {
      return;
    }
    
    const diff = touchStartX.current - touchEndX.current;
    const threshold = 80; // Increased threshold
    
    if (Math.abs(diff) > threshold) {
      if (diff > 0) {
        // Swipe left - next
        navigate('next');
      } else {
        // Swipe right - previous
        navigate('prev');
      }
    }
  };

  const navigate = (direction) => {
    if (view === 'month') {
      setCurrentDate(direction === 'next' ? addMonths(currentDate, 1) : subMonths(currentDate, 1));
    } else if (view === 'week') {
      setCurrentDate(direction === 'next' ? addWeeks(currentDate, 1) : subWeeks(currentDate, 1));
    } else if (view === 'day') {
      setCurrentDate(direction === 'next' ? addDays(currentDate, 1) : subDays(currentDate, 1));
    }
  };

  // Get days for month view
  const monthDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentDate));
    const end = endOfWeek(endOfMonth(currentDate));
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  // Get events for a specific day
  const getDayEvents = (date) => {
    return events.filter(event => isSameDay(event.start, date));
  };

  // Create or Update event
  const saveEvent = async () => {
    try {
      const token = await getValidToken();
      if (!token) {
        alert('Please connect your Google Calendar first');
        return;
      }

      const event = {
        summary: newEvent.title,
        start: {
          dateTime: new Date(newEvent.start).toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
        },
        end: {
          dateTime: new Date(newEvent.end).toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
        },
        location: newEvent.location,
        description: newEvent.description
      };

      const url = editingEvent 
        ? `https://www.googleapis.com/calendar/v3/calendars/primary/events/${editingEvent.id}`
        : 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
      
      const method = editingEvent ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method: method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(event)
      });

      if (!response.ok) throw new Error('Failed to save');

      setShowEventForm(false);
      setEditingEvent(null);
      setShowBottomSheet(false);
      loadEvents();
    } catch (err) {
      alert(`Failed to ${editingEvent ? 'update' : 'create'} event`);
    }
  };

  const deleteEvent = async (eventId) => {
    if (!confirm('Delete this event?')) return;
    try {
      const token = await getValidToken();
      if (!token) return;

      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (!response.ok) throw new Error('Failed');
      
      setShowEventForm(false);
      setEditingEvent(null);
      setShowBottomSheet(false);
      loadEvents();
    } catch (err) {
      alert('Failed to delete event');
    }
  };

  const handleEditFromDetail = (event) => {
    setEditingEvent(event);
    setNewEvent({
      title: event.title,
      start: event.start.toISOString().slice(0, 16),
      end: event.end.toISOString().slice(0, 16),
      location: event.location || '',
      description: event.description || ''
    });
    setShowEventDetail(false);
    setShowEventForm(true);
  };

  const handleDayPress = (day) => {
    setSelectedDate(day);
    const dayEvents = getDayEvents(day);
    
    if (dayEvents.length === 0) {
      // No events, open create form directly
      const start = setMinutes(setHours(day, getHours(new Date())), 0);
      const end = setMinutes(setHours(day, getHours(new Date()) + 1), 0);
      setNewEvent({
        title: '',
        start: start.toISOString().slice(0, 16),
        end: end.toISOString().slice(0, 16),
        location: '',
        description: ''
      });
      setShowEventForm(true);
    } else {
      // Show events for day
      setShowBottomSheet(true);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-gold border-t-transparent rounded-full" />
      </div>
    );
  }

  // Show connect button if auth needed
  if (needsAuth || !localStorage.getItem('mc3_calendar_token')) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center">
        <CalendarIcon size={48} className="text-gold/50 mb-4" />
        <h2 className="text-xl font-bold mb-2">Connect Google Calendar</h2>
        <p className="text-white/40 text-sm mb-6 max-w-xs">
          Link your Google Calendar to view and manage events
        </p>
        <a
          href="/api/auth/google?action=init"
          className="px-6 py-3 bg-gold text-black font-bold rounded-xl hover:bg-gold/80 transition-colors"
        >
          Connect Calendar
        </a>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#0a0a0a]">
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gold/90">
              Content & Events
            </p>
            <h1 className="text-2xl font-black">Calendar</h1>
          </div>
          <button
            onClick={() => {
              const now = new Date();
              setNewEvent({
                title: '',
                start: now.toISOString().slice(0, 16),
                end: new Date(now.getTime() + 60 * 60 * 1000).toISOString().slice(0, 16),
                location: '',
                description: ''
              });
              setShowEventForm(true);
            }}
            className="w-12 h-12 bg-gold rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform"
          >
            <Plus size={24} className="text-black" />
          </button>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mb-4">
          <button 
            onClick={() => navigate('prev')}
            className="p-3 -ml-3 active:opacity-50"
          >
            <ChevronLeft size={24} className="text-white" />
          </button>
          
          <motion.h2 
            key={currentDate.toISOString()}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-xl font-bold"
          >
            {format(currentDate, 'MMMM yyyy')}
          </motion.h2>
          
          <button 
            onClick={handleRefresh}
            className="p-2 text-white/60 hover:text-gold active:opacity-50"
            title="Refresh events"
          >
            <svg className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          
          <button 
            onClick={() => navigate('next')}
            className="p-3 -mr-3 active:opacity-50"
          >
            <ChevronRight size={24} className="text-white" />
          </button>
        </div>

        {/* View Toggle */}
        <div className="flex gap-2 mb-2">
          {['month', 'week', 'day', 'list'].map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`flex-1 py-2 rounded-xl text-xs font-bold uppercase transition-all ${
                view === v 
                  ? 'bg-gold text-black' 
                  : 'bg-white/5 text-white/60'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Calendar Content */}
      <div 
        className="flex-1 overflow-y-auto px-4 pb-24"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Weekday Headers */}
        <div className="grid grid-cols-7 mb-2">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
            <div key={i} className="text-center py-2 text-xs font-bold text-white/40">
              {day}
            </div>
          ))}
        </div>

        {/* Month Grid */}
        <motion.div 
          className="grid grid-cols-7 gap-1"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {monthDays.map((day, index) => {
            const dayEvents = getDayEvents(day);
            const isCurrentMonth = isSameMonth(day, currentDate);
            const isTodayDate = isToday(day);
            
            return (
              <motion.button
                key={day.toISOString()}
                onClick={() => handleDayPress(day)}
                whileTap={{ scale: 0.95 }}
                className={`
                  aspect-square rounded-2xl flex flex-col items-center justify-center relative
                  ${isCurrentMonth ? 'bg-white/5' : 'bg-white/[0.02]'}
                  ${isTodayDate ? 'ring-2 ring-gold' : ''}
                  active:bg-white/10
                `}
              >
                <span className={`text-sm font-semibold ${
                  isTodayDate ? 'text-gold' : 
                  isCurrentMonth ? 'text-white' : 'text-white/30'
                }`}>
                  {format(day, 'd')}
                </span>
                
                {dayEvents.length > 0 && (
                  <div className="flex gap-0.5 mt-1">
                    {dayEvents.slice(0, 3).map((_, i) => (
                      <div key={i} className="w-1 h-1 rounded-full bg-gold" />
                    ))}
                    {dayEvents.length > 3 && (
                      <div className="w-1 h-1 rounded-full bg-gold/50" />
                    )}
                  </div>
                )}
              </motion.button>
            );
          })}
        </motion.div>

        {/* Pull to refresh indicator */}
        {refreshing && (
          <div className="flex justify-center py-4">
            <div className="animate-spin w-6 h-6 border-2 border-gold border-t-transparent rounded-full" />
          </div>
        )}
      </div>

      {/* Bottom Sheet - Day Events */}
      <AnimatePresence>
        {showBottomSheet && selectedDate && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setShowBottomSheet(false);
                setSheetHeight('50vh');
              }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0, height: sheetHeight }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={0.2}
              onDragEnd={(e, { offset, velocity }) => {
                if (offset.y > 150 || velocity.y > 500) {
                  setShowBottomSheet(false);
                  setSheetHeight('50vh');
                } else if (offset.y < -100 || velocity.y < -500) {
                  setSheetHeight('90vh');
                }
              }}
              className="fixed bottom-0 left-0 right-0 bg-[#0f0f0f] rounded-t-[2.5rem] z-50 overflow-hidden flex flex-col border-t border-white/10"
            >
              {/* Handle Area - Click to toggle height */}
              <div 
                className="pt-3 pb-2 cursor-grab active:cursor-grabbing"
                onClick={() => setSheetHeight(prev => prev === '50vh' ? '90vh' : '50vh')}
              >
                <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto" />
              </div>
              
              <div className="flex-1 flex flex-col p-4 pt-0 min-h-0">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-xl font-black italic uppercase tracking-tight">
                      {format(selectedDate, 'EEEE')}
                    </h3>
                    <p className="text-sm text-white/40 font-bold uppercase tracking-widest">
                      {format(selectedDate, 'MMMM d, yyyy')}
                    </p>
                  </div>
                  <button 
                    onClick={() => {
                      setEditingEvent(null);
                      setNewEvent({
                        title: '',
                        start: selectedDate.toISOString().slice(0, 16),
                        end: new Date(selectedDate.getTime() + 60 * 60 * 1000).toISOString().slice(0, 16),
                        location: '',
                        description: ''
                      });
                      setShowEventForm(true);
                    }}
                    className="px-5 py-2.5 bg-gold text-black text-xs font-black uppercase tracking-widest rounded-xl shadow-[0_4px_15px_rgba(234,179,8,0.2)] active:scale-95 transition-all"
                  >
                    Add Event
                  </button>
                </div>

                {/* Events List */}
                <div className="flex-1 space-y-3 overflow-y-auto no-scrollbar pb-10">
                  {getDayEvents(selectedDate).length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-white/20">
                      <CalendarIcon size={40} className="mb-3 opacity-10" />
                      <p className="text-sm font-bold uppercase tracking-widest italic">Clear Schedule</p>
                    </div>
                  ) : (
                    getDayEvents(selectedDate).map(event => (
                      <motion.div 
                        key={event.id}
                        layoutId={event.id}
                        onClick={() => {
                          setSelectedEvent(event);
                          setShowEventDetail(true);
                        }}
                        className="p-4 bg-white/5 rounded-2xl border border-white/10 active:bg-white/10 transition-colors group cursor-pointer"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <p className="font-black text-white group-hover:text-gold transition-colors">{event.title}</p>
                            <div className="flex items-center gap-3 mt-2">
                              <span className="text-xs font-bold text-gold/80 flex items-center gap-1">
                                <Clock size={12} />
                                {format(event.start, 'h:mm a')} - {format(event.end, 'h:mm a')}
                              </span>
                              {event.location && (
                                <span className="text-[10px] font-bold text-white/30 truncate flex items-center gap-1 uppercase tracking-tighter">
                                  <MapPin size={10} /> {event.location}
                                </span>
                              )}
                            </div>
                            
                            {event.description && (
                              <p className="text-xs text-white/40 mt-3 line-clamp-2 italic leading-relaxed">
                                {event.description}
                              </p>
                            )}
                          </div>
                          
                          {event.hangoutLink && (
                            <a 
                              href={event.hangoutLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center text-blue-400 hover:bg-blue-500/30 transition-colors"
                            >
                              <Video size={20} />
                            </a>
                          )}
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Event Form Modal */}
      <AnimatePresence>
        {showEventForm && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setShowEventForm(false);
                setEditingEvent(null);
              }}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-4 top-20 bg-[#0f0f0f] rounded-[2.5rem] z-[70] overflow-hidden flex flex-col border border-white/10"
            >
              <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
                <div>
                  <h3 className="text-xl font-black italic uppercase tracking-tight text-white">
                    {editingEvent ? 'Edit' : 'New'} <span className="text-gold">Event</span>
                  </h3>
                  <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] mt-0.5">
                    Google Calendar Sync
                  </p>
                </div>
                <button 
                  onClick={() => {
                    setShowEventForm(false);
                    setEditingEvent(null);
                  }}
                  className="w-10 h-10 glass rounded-full flex items-center justify-center text-white/40 hover:text-white transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-2.5 ml-1">Event Title</label>
                  <input
                    type="text"
                    value={newEvent.title}
                    onChange={(e) => setNewEvent({...newEvent, title: e.target.value})}
                    placeholder="E.g. Strategy Meeting"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-lg font-bold text-white placeholder:text-white/10 focus:outline-none focus:border-gold/50 transition-colors"
                    autoFocus
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-2.5 ml-1">Start Time</label>
                    <input
                      type="datetime-local"
                      value={newEvent.start}
                      onChange={(e) => setNewEvent({...newEvent, start: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white font-bold focus:outline-none focus:border-gold/50 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-2.5 ml-1">End Time</label>
                    <input
                      type="datetime-local"
                      value={newEvent.end}
                      onChange={(e) => setNewEvent({...newEvent, end: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white font-bold focus:outline-none focus:border-gold/50 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-2.5 ml-1">Location</label>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={18} />
                    <input
                      type="text"
                      value={newEvent.location}
                      onChange={(e) => setNewEvent({...newEvent, location: e.target.value})}
                      placeholder="Add location or link"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white font-medium placeholder:text-white/10 focus:outline-none focus:border-gold/50 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-2.5 ml-1">Notes</label>
                  <textarea
                    value={newEvent.description}
                    onChange={(e) => setNewEvent({...newEvent, description: e.target.value})}
                    placeholder="Additional details..."
                    rows={4}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white font-medium placeholder:text-white/10 focus:outline-none focus:border-gold/50 resize-none transition-colors"
                  />
                </div>
              </div>

              <div className="p-6 border-t border-white/10 bg-white/[0.01] flex flex-col gap-3">
                <button
                  onClick={saveEvent}
                  disabled={!newEvent.title}
                  className="w-full py-4 bg-gold text-black font-black uppercase tracking-widest rounded-2xl text-sm shadow-[0_4px_20px_rgba(234,179,8,0.2)] disabled:opacity-30 active:scale-95 transition-all"
                >
                  {editingEvent ? 'Update' : 'Create'} Event
                </button>
                
                {editingEvent && (
                  <button
                    onClick={() => deleteEvent(editingEvent.id)}
                    className="w-full py-4 bg-red-500/10 border border-red-500/20 text-red-400 font-black uppercase tracking-widest rounded-2xl text-xs active:scale-95 transition-all"
                  >
                    Delete Event
                  </button>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Event Detail Modal */}
      <AnimatePresence>
        {showEventDetail && selectedEvent && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowEventDetail(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[80]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-4 top-24 bottom-24 bg-[#0f0f0f] rounded-[2.5rem] z-[90] overflow-hidden flex flex-col border border-white/10 shadow-2xl"
            >
              <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/[0.02]">
                <h3 className="text-xl font-black uppercase tracking-tighter italic text-white">
                  Event <span className="text-gold">Detail</span>
                </h3>
                <button 
                  onClick={() => setShowEventDetail(false)}
                  className="w-10 h-10 glass rounded-full flex items-center justify-center text-white/40 hover:text-white"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-6 no-scrollbar">
                <div>
                  <h2 className="text-2xl font-black text-white leading-tight">{selectedEvent.title}</h2>
                  <div className="flex flex-wrap gap-4 mt-4">
                    <div className="flex items-center gap-2 text-gold font-bold">
                      <Clock size={16} />
                      <span className="text-sm">
                        {format(selectedEvent.start, 'h:mm a')} - {format(selectedEvent.end, 'h:mm a')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-white/40 font-bold">
                      <CalendarIcon size={16} />
                      <span className="text-sm">
                        {format(selectedEvent.start, 'EEEE, MMMM d')}
                      </span>
                    </div>
                  </div>
                </div>

                {selectedEvent.location && (
                  <div className="flex items-start gap-3 p-4 bg-white/5 rounded-2xl border border-white/5">
                    <MapPin className="text-purple-400 mt-1" size={20} />
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-1">Location</p>
                      <p className="text-sm text-white/80 font-medium">{selectedEvent.location}</p>
                    </div>
                  </div>
                )}

                {selectedEvent.description && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-white/30 ml-1">Description</p>
                    <div className="p-4 bg-white/5 rounded-2xl border border-white/5 text-sm text-white/60 leading-relaxed whitespace-pre-wrap">
                      {selectedEvent.description}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-3 pt-4">
                  {selectedEvent.hangoutLink && (
                    <a 
                      href={selectedEvent.hangoutLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 py-4 bg-blue-500/20 border border-blue-500/30 rounded-2xl text-blue-400 font-black uppercase tracking-widest text-sm hover:bg-blue-500/30 transition-all"
                    >
                      <Video size={20} />
                      Join Google Meet
                    </a>
                  )}
                  <button 
                    onClick={() => handleEditFromDetail(selectedEvent)}
                    className="flex items-center justify-center gap-2 py-4 bg-gold text-black rounded-2xl font-black uppercase tracking-widest text-sm shadow-[0_4px_20px_rgba(234,179,8,0.3)] active:scale-95 transition-all"
                  >
                    Edit Event Details
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Calendar;