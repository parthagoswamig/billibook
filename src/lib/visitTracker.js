// src/lib/visitTracker.js
// Tracks unique user logins per day:
//   - Each user ID counted ONCE per day (no matter how many times they login)
//   - Total = sum of all unique user-day combinations ever
//   - Works for both Web and Mobile App (Capacitor WebView)

import { supabase } from '../db';

// Detect platform: 'app' = Capacitor Android/iOS WebView, 'web' = browser
function detectPlatform() {
  try {
    // Method 1: Capacitor bridge (most reliable for APK)
    if (
      window.Capacitor &&
      typeof window.Capacitor.getPlatform === 'function' &&
      window.Capacitor.getPlatform() !== 'web'
    ) {
      return 'app';
    }
    // Method 2: Capacitor is present but getPlatform not yet ready
    if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) {
      return 'app';
    }
    // Method 3: Android WebView user-agent (wv flag)
    const ua = navigator.userAgent || '';
    if (ua.includes('Android') && ua.includes('wv')) return 'app';
    // Method 4: PWA installed / standalone mode
    if (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true
    ) return 'app';
  } catch (e) {}
  return 'web';
}

// Track a user login — once per user per day
// userId: Supabase auth user ID
// event: auth event name (SIGNED_IN, INITIAL_SESSION, TOKEN_REFRESHED)
export async function trackLogin(userId) {
  if (!userId) return;

  const today = new Date().toISOString().slice(0, 10); // "2026-07-02"
  const storageKey = `kp_tracked_${userId}_${today}`;

  // Already tracked this user today — skip
  if (localStorage.getItem(storageKey)) return;

  const platform = detectPlatform();
  const sessionId = `${userId}_${today}`; // unique per user per day

  try {
    const { error } = await supabase.from('app_visits').insert({
      session_id: sessionId,
      platform,
      user_agent: navigator.userAgent?.substring(0, 200) || '',
    });

    if (!error) {
      // Mark as tracked for today
      localStorage.setItem(storageKey, '1');
    } else {
      // If duplicate key error (user already tracked today from another device/session), still mark locally
      if (error.code === '23505') {
        localStorage.setItem(storageKey, '1');
      } else {
        console.warn('Login tracking error:', error.message);
      }
    }
  } catch (e) {
    console.warn('Login tracking failed:', e.message);
  }
}

export async function getVisitStats() {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayISO = todayStart.toISOString();

    // Today's unique user logins
    const { data: todayVisits, error: e1 } = await supabase
      .from('app_visits')
      .select('platform')
      .gte('created_at', todayISO);

    // All-time unique user-day logins
    const { data: allVisits, error: e2 } = await supabase
      .from('app_visits')
      .select('platform');

    if (e1 || e2) throw (e1 || e2);

    const todayWeb   = (todayVisits || []).filter(v => v.platform === 'web').length;
    const todayApp   = (todayVisits || []).filter(v => v.platform === 'app').length;
    const todayTotal = todayWeb + todayApp;

    const totalWeb   = (allVisits || []).filter(v => v.platform === 'web').length;
    const totalApp   = (allVisits || []).filter(v => v.platform === 'app').length;
    const total      = totalWeb + totalApp;

    return { total, totalWeb, totalApp, todayTotal, todayWeb, todayApp };
  } catch (e) {
    console.warn('Failed to fetch login stats:', e.message);
    return { total: 0, totalWeb: 0, totalApp: 0, todayTotal: 0, todayWeb: 0, todayApp: 0 };
  }
}
