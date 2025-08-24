// /src/supabaseClient.js
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../supabase-config.js';
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,                 // guarda la sesión en localStorage
    autoRefreshToken: true,               // refresca tokens en segundo plano
    detectSessionInUrl: true,             // maneja magic links / PKCE
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  },
});

// debug opcional
if (typeof window !== 'undefined') window.supabase = supabase;
