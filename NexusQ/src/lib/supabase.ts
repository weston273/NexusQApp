import { createClient } from '@supabase/supabase-js';
import { getAppConfig } from "@/lib/config";

const { supabaseUrl, supabaseAnonKey } = getAppConfig();

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
