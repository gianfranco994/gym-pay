import { supabase } from '../services/supabase.js';

/**
 * Escape HTML special characters to prevent XSS attacks.
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Validate Venezuelan phone number format (04XX-XXXXXXX or 04XXXXXXXXX)
 * @param {string} phone
 * @returns {boolean}
 */
export function isValidVenezuelanPhone(phone) {
  if (!phone) return false;
  const cleaned = phone.replace(/[-\s]/g, '');
  return /^04[0-9]{9}$/.test(cleaned);
}

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
        
        return { key, value: data.value };
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
