// src/lib/visitTracker.js
// Tracks website and mobile app visits in Supabase
import { supabase } from '../db';

// Generate or get a persistent session ID for this browser session
function getSessionId() {
  const key = 'khatape_session_id';
  let sid = sessionStorage.getItem(key);
  if (!sid) {
    sid = `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
    sessionStorage.setItem(key, sid);
  }
  return sid;
}

// Detect platform: 'app' if running as installed APK/PWA, else 'web'
function detectPlatform() {
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
  const ua = navigator.userAgent || '';
  const isAndroid = ua.includes('Android') && (isStandalone || ua.includes('KhataPe'));
  return isAndroid || isStandalone ? 'app' : 'web';
}

let _tracked = false; // Only track once per session load

export async function trackVisit() {
  if (_tracked) return;
  _tracked = true;

  const sessionId = getSessionId();
  const platform = detectPlatform();

  try {
    await supabase.from('app_visits').insert({
      session_id: sessionId,
      platform,
      user_agent: navigator.userAgent?.substring(0, 200) || '',
    });
  } catch (e) {
    // Silently fail — tracking should never break the app
    console.warn('Visit tracking failed:', e.message);
  }
}

export async function getVisitStats() {
  try {
    // Today's start (midnight local time converted to UTC)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data: allVisits, error } = await supabase
      .from('app_visits')
      .select('created_at, platform');

    if (error) throw error;

    const total = allVisits?.length || 0;
    const todayVisits = allVisits?.filter(v => new Date(v.created_at) >= todayStart) || [];
    const todayTotal = todayVisits.length;
    const todayWeb = todayVisits.filter(v => v.platform === 'web').length;
    const todayApp = todayVisits.filter(v => v.platform === 'app').length;

    const totalWeb = allVisits?.filter(v => v.platform === 'web').length || 0;
    const totalApp = allVisits?.filter(v => v.platform === 'app').length || 0;

    return {
      total,
      totalWeb,
      totalApp,
      todayTotal,
      todayWeb,
      todayApp,
    };
  } catch (e) {
    console.warn('Failed to fetch visit stats:', e.message);
    return { total: 0, totalWeb: 0, totalApp: 0, todayTotal: 0, todayWeb: 0, todayApp: 0 };
  }
}
