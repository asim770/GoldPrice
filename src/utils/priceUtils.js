/**
 * Price calculation utilities for Gold & Silver Calculator
 * Contains purity definitions, currency config, and calculation/formatting helpers.
 */

// ── Purity multipliers (fraction of pure metal) ────────────────

export const GOLD_PURITIES = [
  { label: "24K", value: 1.0,    description: "99.9% Pure" },
  { label: "22K", value: 0.9167, description: "91.67% Pure" },
  { label: "18K", value: 0.75,   description: "75% Pure" },
  { label: "14K", value: 0.5833, description: "58.33% Pure" },
];

export const SILVER_PURITIES = [
  { label: "999", value: 1.0,   description: "99.9% Pure" },
  { label: "925", value: 0.925, description: "Sterling Silver" },
  { label: "900", value: 0.9,   description: "Coin Silver" },
  { label: "800", value: 0.8,   description: "European Silver" },
];

// ── Supported currencies ───────────────────────────────────────

export const CURRENCIES = [
  { code: "INR", symbol: "₹", name: "Indian Rupee" },
  { code: "USD", symbol: "$", name: "US Dollar" },
];

// ── Calculation ────────────────────────────────────────────────

/**
 * Calculate total price = (pricePer10g / 10) × purityMultiplier × weight
 * @param {number} pricePer10g      - Price per 10 grams of pure metal
 * @param {number} purityMultiplier - Purity fraction (0–1)
 * @param {number} weightInGrams    - Weight in grams
 * @returns {number} Total calculated price (0 if any input is falsy)
 */
export function calculatePrice(pricePer10g, purityMultiplier, weightInGrams) {
  if (!pricePer10g || !purityMultiplier || !weightInGrams) return 0;
  return (pricePer10g / 10) * purityMultiplier * weightInGrams;
}

// ── Formatting ─────────────────────────────────────────────────

/**
 * Format a number as a localised currency string.
 * @param {number}  amount
 * @param {string}  currencyCode – "INR" or "USD"
 * @returns {string}
 */
export function formatCurrency(amount, currencyCode = "INR") {
  const locale = currencyCode === "INR" ? "en-IN" : "en-US";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format an ISO date string into a human-readable "last updated" label.
 * @param {string} isoString
 * @returns {string}
 */
export function formatLastUpdated(isoString) {
  if (!isoString) return "";
  const date = new Date(isoString);
  return date.toLocaleString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour12: true,
  });
}
