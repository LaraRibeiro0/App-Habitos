// Cria a ligação ao Supabase. Todos os outros ficheiros importam
// o "supa" daqui, para haver uma só ligação na app inteira.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

export const supa = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,      // guarda a sessão no dispositivo (login 1 vez)
    autoRefreshToken: true,    // renova a sessão sozinha em segundo plano
    detectSessionInUrl: true,  // apanha o regresso do login com Google
    flowType: 'pkce',          // o Google devolve ?code=… (não mexe no #)
  },
});
