import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jhcymugxtimtqtsukxxx.supabase.co';
const supabaseKey = 'sb_publishable_lss5nBc9gmpm1VE7vCYQxg_kJSO_GQ-';

export const supabase = createClient(supabaseUrl, supabaseKey);
