import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jhcymugxtimtqtsukxxx.supabase.co';
const supabaseKey = 'sb_publishable_lss5nBc9gmpm1VE7vCYQxg_kJSO_GQ-';

export const supabase = createClient(supabaseUrl, supabaseKey);

// Auth Helpers
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) return null;
  return data.session;
}

