// src/lib/visitTracker.js
// Rules:
//  - Each user counted ONCE per day, regardless of how many times they login
//  - Total = all unique user-day records ever
//  - Platform: 'app' for Capacitor/Android WebView, 'web' for browser

import { supabase } from '../db';

// Module-level flag — prevents double-tracking from concurrent getSession + INITIAL_SESSION
const _pendingUsers = new Set();

// Detect platform
function detectPlatform() {
  try {
    // Capacitor native platform (most reliable)
    if (window.Capacitor) {
      if (typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform()) return 'app';
      if (typeof window.Capacitor.getPlatform === 'function' && window.Capacitor.getPlatform() !== 'web') return 'app';
    }
    // Android WebView user-agent flag
    if (/Android.*wv\)/.test(navigator.userAgent)) return 'app';
    // PWA / standalone mode
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) return 'app';
  } catch (_) {}
  return 'web';
}

// Track login — once per user per day
export async function trackLogin(userId) {
  if (!userId) return;

  const today = new Date().toISOString().slice(0, 10); // e.g. "2026-07-02"
  const sessionId = `${userId}_${today}`;
  const localKey = `kp_tracked_${sessionId}`;

  // Already tracked today (locally) — skip
  if (localStorage.getItem(localKey)) return;

  // Prevent concurrent calls for same user from running simultaneously
  if (_pendingUsers.has(sessionId)) return;
  _pendingUsers.add(sessionId);

  // Set local flag IMMEDIATELY (before await) to block any concurrent call
  localStorage.setItem(localKey, '1');

  const platform = detectPlatform();

  try {
    const { error } = await supabase.from('app_visits').insert({
      session_id: sessionId,
      platform,
      user_agent: navigator.userAgent?.substring(0, 200) || '',
    });

    if (error && error.code !== '23505') {
      // Not a duplicate key error — something else went wrong
      // Remove local flag so it can retry next time
      localStorage.removeItem(localKey);
      console.warn('Login tracking error:', error.message);
    }
  } catch (e) {
    localStorage.removeItem(localKey);
    console.warn('Login tracking failed:', e.message);
  } finally {
    _pendingUsers.delete(sessionId);
  }
}

export async function getVisitStats() {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayISO = todayStart.toISOString();

    const [{ data: todayVisits, error: e1 }, { data: allVisits, error: e2 }] = await Promise.all([
      supabase.from('app_visits').select('platform').gte('created_at', todayISO),
      supabase.from('app_visits').select('platform'),
    ]);

    if (e1 || e2) throw (e1 || e2);

    const todayWeb   = (todayVisits || []).filter(v => v.platform === 'web').length;
    const todayApp   = (todayVisits || []).filter(v => v.platform === 'app').length;
    const totalWeb   = (allVisits  || []).filter(v => v.platform === 'web').length;
    const totalApp   = (allVisits  || []).filter(v => v.platform === 'app').length;

    return {
      todayTotal: todayWeb + todayApp, todayWeb, todayApp,
      total: totalWeb + totalApp, totalWeb, totalApp,
    };
  } catch (e) {
    console.warn('Failed to fetch login stats:', e.message);
    return { total: 0, totalWeb: 0, totalApp: 0, todayTotal: 0, todayWeb: 0, todayApp: 0 };
  }
}
