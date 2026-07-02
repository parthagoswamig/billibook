// src/lib/visitTracker.js
// Tracks every login in Supabase — each login = +1 count, no time restrictions

import { supabase } from '../db';

// Detect platform: 'app' if running inside Capacitor/Android WebView, else 'web'
function detectPlatform() {
  try {
    if (
      window.Capacitor &&
      typeof window.Capacitor.getPlatform === 'function' &&
      window.Capacitor.getPlatform() !== 'web'
    ) {
      return 'app';
    }
    // Android WebView flag (wv in user agent)
    const ua = navigator.userAgent || '';
    if (ua.includes('Android') && ua.includes('wv')) return 'app';
    // PWA installed mode
    if (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true
    ) return 'app';
  } catch (e) {}
  return 'web';
}

// Called on every successful login
// session_id = unique per login session so same user logging in twice = 2 counts
export async function trackLogin() {
  const sessionId = `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
  const platform = detectPlatform();

  try {
    const { error } = await supabase.from('app_visits').insert({
      session_id: sessionId,
      platform,
      user_agent: navigator.userAgent?.substring(0, 200) || '',
    });
    if (error) console.warn('Login tracking error:', error.message);
  } catch (e) {
    console.warn('Login tracking failed:', e.message);
  }
}

export async function getVisitStats() {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayISO = todayStart.toISOString();

    // Today's logins
    const { data: todayVisits, error: e1 } = await supabase
      .from('app_visits')
      .select('platform')
      .gte('created_at', todayISO);

    // All-time logins
    const { data: allVisits, error: e2 } = await supabase
      .from('app_visits')
      .select('platform');

    if (e1 || e2) throw (e1 || e2);

    const todayWeb  = (todayVisits || []).filter(v => v.platform === 'web').length;
    const todayApp  = (todayVisits || []).filter(v => v.platform === 'app').length;
    const todayTotal = todayWeb + todayApp;

    const totalWeb  = (allVisits || []).filter(v => v.platform === 'web').length;
    const totalApp  = (allVisits || []).filter(v => v.platform === 'app').length;
    const total     = totalWeb + totalApp;

    return { total, totalWeb, totalApp, todayTotal, todayWeb, todayApp };
  } catch (e) {
    console.warn('Failed to fetch login stats:', e.message);
    return { total: 0, totalWeb: 0, totalApp: 0, todayTotal: 0, todayWeb: 0, todayApp: 0 };
  }
}
