import { createClient } from '@supabase/supabase-js';

// Substitua com as suas credenciais do Supabase.
// É altamente recomendável usar variáveis de ambiente para isso em produção.
const supabaseUrl = 'https://oezifbbcnqfpjakyrohh.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9lemlmYmJjbnFmcGpha3lyb2hoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2NTk0MjAsImV4cCI6MjA3NzIzNTQyMH0.bVMA366N2Bm3EMAGyRpk-MHaVbSovlQUjr4ExSePxdE';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase URL and Anon Key are required.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
