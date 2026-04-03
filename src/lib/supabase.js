import { createClient } from '@supabase/supabase-js'

// When Railway/build omits VITE_* vars, placeholders would crash createClient() at import time (white screen).
// These defaults match the SimuFlow Supabase project; override with VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.
const DEFAULT_SUPABASE_URL = 'https://lwszdwguarzowduzthbz.supabase.co'
const DEFAULT_SUPABASE_ANON_KEY =
  'sb_publishable_1S3ZG6pQnaDRUyxPK7jM1Q_VRsA6jnw'

const rawUrl = import.meta.env.VITE_SUPABASE_URL
const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY

const supabaseUrl =
  typeof rawUrl === 'string' && rawUrl.trim() && rawUrl.trim() !== 'YOUR_SUPABASE_URL'
    ? rawUrl.trim()
    : DEFAULT_SUPABASE_URL

const supabaseAnonKey =
  typeof rawKey === 'string' && rawKey.trim() && rawKey.trim() !== 'YOUR_SUPABASE_ANON_KEY'
    ? rawKey.trim()
    : DEFAULT_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
