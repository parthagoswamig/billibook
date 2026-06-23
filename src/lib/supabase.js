// src/lib/supabase.js
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';
const hasValidUrl = /^https?:\/\//i.test(SUPABASE_URL) && !SUPABASE_URL.includes('YOUR_SUPABASE_URL') && !SUPABASE_URL.includes('your-project');
const hasValidAnonKey = !!SUPABASE_ANON_KEY && !SUPABASE_ANON_KEY.includes('YOUR_SUPABASE_ANON_KEY') && !SUPABASE_ANON_KEY.includes('your-anon-key');

export const supabaseConfigError = hasValidUrl && hasValidAnonKey
  ? ''
  : 'Supabase is not configured. Update REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY in .env and restart npm start.';

export const supabase = supabaseConfigError
  ? null
  : createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
