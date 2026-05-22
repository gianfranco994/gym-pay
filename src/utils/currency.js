/**
 * Currency formatting utilities for GymPay
 */

let currentCurrency = 'bs';
let currentRate = 0;

/**
 * Set the current display currency
 * @param {'bs'|'usd'} currency
 */
export function setCurrency(currency) {
  currentCurrency = currency;
}

/**
 * Get the current display currency
 * @returns {'bs'|'usd'}
 */
export function getCurrency() {
  return currentCurrency;
}

/**
 * Set the current exchange rate (USD to Bs)
 * @param {number} rate
 */
export function setRate(rate) {
  currentRate = rate;
}

/**
 * Get the current exchange rate
 * @returns {number}
 */
export function getRate() {
  return currentRate;
}

/**
 * Format an amount in Bolívares
 * @param {number} amount
 * @returns {string} e.g. "Bs. 1.250,00"
 */
export function formatBs(amount) {
  if (amount == null || isNaN(amount)) return 'Bs. 0,00';
  return 'Bs. ' + amount.toLocaleString('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Format an amount in USD
 * @param {number} amount
 * @returns {string} e.g. "$ 34.72"
 */
export function formatUsd(amount) {
  if (amount == null || isNaN(amount)) return '$ 0.00';
  return '$ ' + amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Format amount based on current currency setting
 * @param {number} amountBs - Amount in Bolívares
 * @param {number} [amountUsd] - Amount in USD (if not provided, calculated from rate)
 * @returns {string}
 */
export function formatAmount(amountBs, amountUsd) {
  if (currentCurrency === 'usd') {
    if (amountUsd != null) return formatUsd(amountUsd);
    if (currentRate > 0) return formatUsd(amountBs / currentRate);
    return formatUsd(0);
  }
  return formatBs(amountBs);
}

/**
 * Convert Bs to USD
 * @param {number} amountBs
 * @param {number} [rate] - Optional override rate
 * @returns {number}
 */
export function bsToUsd(amountBs, rate) {
  const r = rate || currentRate;
  if (!r || r <= 0) return 0;
  return amountBs / r;
}

/**
 * Convert USD to Bs
 * @param {number} amountUsd
 * @param {number} [rate] - Optional override rate
 * @returns {number}
 */
export function usdToBs(amountUsd, rate) {
  const r = rate || currentRate;
  return amountUsd * r;
}

/**
 * Format rate for display
 * @param {number} rate
 * @returns {string} e.g. "1 USD = 36,50 Bs"
 */
export function formatRate(rate) {
  if (!rate || rate <= 0) return 'Tasa no disponible';
  return `1 USD = ${rate.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs`;
}
