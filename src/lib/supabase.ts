import { createClient } from '@supabase/supabase-js'

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim()
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim()

/**
 * If the env vars are missing we DON'T throw at import time — that would crash
 * the whole app into a blank white page. Instead we expose an error string the
 * UI can render with setup instructions, and fall back to harmless placeholders
 * so module evaluation succeeds.
 */
export const supabaseConfigError: string | null =
  !supabaseUrl || !supabaseAnonKey
    ? 'Missing Supabase environment variables. Create a .env file (copy .env.example) with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then restart the dev server.'
    : null

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  }
)

/** Shop constants (single-shop app). */
export const SHOP = {
  name: "St. Thomas Men's Wear",
  location: 'Thrissur, Kerala',
  owner: 'Thomas Chetta',
  phone: '+91 88910 74715',
}
