// src/lib/visitTracker.js
// Tracks website and mobile app visits in Supabase
import { supabase } from '../db';

// Generate a persistent visit ID — uses localStorage so it survives app restarts
// But creates a new one each day so daily counts work correctly
function getVisitKey() {
  const today = new Date().toISOString().slice(0, 10); // e.g. "2026-07-02"
  const storageKey = 'khatape_visit_' + today;
  let vid = localStorage.getItem(storageKey);
  if (!vid) {
    vid = `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
    localStorage.setItem(storageKey, vid);
    // Clean up yesterday's keys
    Object.keys(localStorage).forEach(k => {
      if (k.startsWith('khatape_visit_') && k !== storageKey) {
        localStorage.removeItem(k);
      }
    });
    return { vid, isNew: true };
  }
  return { vid, isNew: false };
}

// Detect platform reliably
// - 'app' = running inside Capacitor/Android WebView
// - 'web' = normal browser
function detectPlatform() {
  try {
    // Capacitor injects window.Capacitor in the WebView
    if (
      window.Capacitor &&
      typeof window.Capacitor.getPlatform === 'function' &&
      window.Capacitor.getPlatform() !== 'web'
    ) {
      return 'app';
    }
    // Fallback: check for Android WebView user agent with no Chrome version exposed
    const ua = navigator.userAgent || '';
    if (ua.includes('Android') && ua.includes('wv')) {
      return 'app'; // wv = WebView flag
    }
    // PWA standalone mode
    if (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true
    ) {
      return 'app';
    }
  } catch (e) {}
  return 'web';
}

let _tracked = false; // Only track once per JS session (page load)

export async function trackVisit() {
  if (_tracked) return;
  _tracked = true;

  const { vid, isNew } = getVisitKey();
  
  // Only insert if this is a new visit today (not already tracked today)
  if (!isNew) return;

  const platform = detectPlatform();

  try {
    const { error } = await supabase.from('app_visits').insert({
      session_id: vid,
      platform,
      user_agent: navigator.userAgent?.substring(0, 200) || '',
    });
    if (error) console.warn('Visit insert error:', error.message);
  } catch (e) {
    console.warn('Visit tracking failed:', e.message);
  }
}

export async function getVisitStats() {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayISO = todayStart.toISOString();

    // Get today's visits
    const { data: todayVisits, error: e1 } = await supabase
      .from('app_visits')
      .select('platform')
      .gte('created_at', todayISO);

    // Get all-time visits
    const { data: allVisits, error: e2 } = await supabase
      .from('app_visits')
      .select('platform');

    if (e1 || e2) throw (e1 || e2);

    const todayWeb = (todayVisits || []).filter(v => v.platform === 'web').length;
    const todayApp = (todayVisits || []).filter(v => v.platform === 'app').length;
    const todayTotal = todayWeb + todayApp;

    const totalWeb = (allVisits || []).filter(v => v.platform === 'web').length;
    const totalApp = (allVisits || []).filter(v => v.platform === 'app').length;
    const total = totalWeb + totalApp;

    return { total, totalWeb, totalApp, todayTotal, todayWeb, todayApp };
  } catch (e) {
    console.warn('Failed to fetch visit stats:', e.message);
    return { total: 0, totalWeb: 0, totalApp: 0, todayTotal: 0, todayWeb: 0, todayApp: 0 };
  }
}
