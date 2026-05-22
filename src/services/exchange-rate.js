/**
 * Exchange rate service for GymPay
 * Fetches BCV rate from pydolarvenezuela API
 */

const CACHE_KEY = 'gympay_exchange_rate';
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in ms

/**
 * Get cached rate from localStorage
 * @returns {{ rate: number, timestamp: string, source: string } | null}
 */
function getCachedRate() {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    const data = JSON.parse(cached);
    const age = Date.now() - new Date(data.timestamp).getTime();
    if (age > CACHE_DURATION) return null;
    return data;
  } catch {
    return null;
  }
}

/**
 * Save rate to localStorage cache
 * @param {number} rate
 * @param {string} source
 */
function cacheRate(rate, source) {
  const data = {
    rate,
    timestamp: new Date().toISOString(),
    source,
  };
  localStorage.setItem(CACHE_KEY, JSON.stringify(data));
}

/**
 * Fetch the current BCV exchange rate from pydolarvenezuela API
 * @returns {Promise<{ rate: number, timestamp: string, source: string }>}
 */
export async function fetchExchangeRate() {
  // Check cache first
  const cached = getCachedRate();
  if (cached) return cached;

  try {
    const response = await fetch('https://ve.dolarapi.com/v1/dolares/oficial');

    if (!response.ok) throw new Error(`API error: ${response.status}`);

    const data = await response.json();

    // The API returns { promedio: 523.675 }
    let rate = data.promedio || data.venta || 0;

    if (rate > 0) {
      const result = {
        rate,
        timestamp: new Date().toISOString(),
        source: 'BCV (DolarApi)',
      };
      cacheRate(rate, result.source);
      return result;
    }

    throw new Error('Could not parse rate from API response');
  } catch (error) {
    console.warn('Error fetching exchange rate:', error.message);

    // Try fallback: return cached even if expired
    try {
      const oldCached = localStorage.getItem(CACHE_KEY);
      if (oldCached) {
        const data = JSON.parse(oldCached);
        return { ...data, source: data.source + ' (caché)' };
      }
    } catch { /* ignore */ }

    return null;
  }
}

/**
 * Clear the cached exchange rate
 */
export function clearRateCache() {
  localStorage.removeItem(CACHE_KEY);
}

/**
 * Get the last update timestamp of the cached rate
 * @returns {string|null}
 */
export function getLastUpdateTime() {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    return JSON.parse(cached).timestamp;
  } catch {
    return null;
  }
}
