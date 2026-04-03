import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'YOUR_SUPABASE_URL'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY'

function isProbablyValidUrl(value) {
  if (!value || typeof value !== 'string') return false
  if (value === 'YOUR_SUPABASE_URL') return false
  try {
    // eslint-disable-next-line no-new
    new URL(value)
    return true
  } catch {
    return false
  }
}

export const supabaseConfigError =
  !isProbablyValidUrl(supabaseUrl) || !supabaseAnonKey || supabaseAnonKey === 'YOUR_SUPABASE_ANON_KEY'
    ? 'Missing Supabase configuration. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY at build time.'
    : null

export function getPublicAppUrl() {
  const configured = import.meta.env.VITE_PUBLIC_APP_URL
  if (configured && typeof configured === 'string') return configured.replace(/\/+$/, '')
  return window.location.origin
}

export const supabase = supabaseConfigError
  ? null
  : createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        flowType: 'pkce',
        detectSessionInUrl: true,
        persistSession: true,
        autoRefreshToken: true,
      },
    })
