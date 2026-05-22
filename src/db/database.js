import { supabase } from '../services/supabase.js';

/**
 * A mock of the getDB interface specifically for settings,
 * so we don't have to rewrite the settings fetch logic in other files.
 */
export async function getDB() {
  return {
    async get(storeName, key) {
      if (storeName === 'settings') {
        const { data, error } = await supabase
          .from('settings')
          .select('value')
          .eq('key', key)
          .maybeSingle();
        
        if (error) {
          console.error('Error fetching setting from Supabase:', error);
          return undefined;
        }
        if (!data) return undefined;
        
        // Return in the format expected by the app { key, value }
        let val = data.value;
        // In PostgreSQL JSONB, strings might be wrapped in quotes if not careful, 
        // but Supabase JS handles JSON parsing automatically.
        return { key, value: val };
      }
      return undefined;
    },
    async put(storeName, obj) {
      if (storeName === 'settings') {
        const { error } = await supabase
          .from('settings')
          .upsert({ key: obj.key, value: obj.value });
        
        if (error) {
          console.error('Error saving setting to Supabase:', error);
          throw error;
        }
      }
    }
  };
}

/**
 * No local initialization needed since schema.sql seeds default settings.
 */
export async function initDB() {
  // No-op
}
