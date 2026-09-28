import { createClient } from '@supabase/supabase-js'

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://peidiahxyqeozveoceao.supabase.co'

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_fMkk0AWbv_IgMtUlbDFwHQ_I_bSLFRJ'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)