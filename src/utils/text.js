/**
 * Text formatting utilities
 */

/**
 * Convert string to Title Case (first letter of each word capitalized)
 * @param {string} str 
 * @returns {string}
 */
export function toTitleCase(str) {
  if (!str) return '';
  return str.toLowerCase().split(' ').map(word => {
    return word.charAt(0).toUpperCase() + word.slice(1);
  }).join(' ');
}
