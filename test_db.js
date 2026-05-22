import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jhcymugxtimtqtsukxxx.supabase.co';
const supabaseKey = 'sb_publishable_lss5nBc9gmpm1VE7vCYQxg_kJSO_GQ-';

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, error } = await supabase.from('settings').select('*');
  if (error) {
    console.error('Error fetching settings:', error);
    process.exit(1);
  }
  console.log('✅ Connection successful. Settings found:', data.length);
  process.exit(0);
}

test();
