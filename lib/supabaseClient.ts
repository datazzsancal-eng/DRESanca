
import { createClient } from '@supabase/supabase-js';

// Tenta pegar das variáveis de ambiente (Vercel/Vite) com acesso seguro, senão usa o fallback hardcoded.
// O uso de ?. previne o erro se import.meta.env for undefined.
export const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://oezifbbcnqfpjakyrohh.supabase.co';
export const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9lemlmYmJjbnFmcGpha3lyb2hoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2NTk0MjAsImV4cCI6MjA3NzIzNTQyMH0.bVMA366N2Bm3EMAGyRpk-MHaVbSovlQUjr4ExSePxdE';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase URL and Anon Key are required.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
