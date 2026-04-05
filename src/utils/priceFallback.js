/**
 * Price Fallback Module
 * ---------------------
 * Wraps the Gemini API fetch with a graceful fallback mechanism.
 * If the API fails for any reason (network, invalid response, timeout, etc.)
 * the module returns sensible default prices so the UI and calculations
 * continue to work uninterrupted.
 *
 * Default gold price (24K, per gram, INR): ₹9,300 (≈ ₹153,009 per 10g ÷ 10 ≈ mapped below)
 * The user-specified fallback of 153,009 is the **10-gram** rate; we store per-gram.
 */

import { fetchLivePrices } from "../gemini";

// ── Default prices (per gram) ────────────────────────────────────
// Gold fallback: ₹153,009 for 10 g → ₹15,300.9 / g  (rounded)
// Silver, USD equivalents are approximate defaults.
const DEFAULT_PRICES = Object.freeze({
  gold: {
    INR: 15300.9, // ₹153,009 per 10 g  →  per gram
    USD: 93.5,
  },
  silver: {
    INR: 100.0,
    USD: 1.15,
  },
});

/**
 * Fetch live prices from the Gemini API with an automatic fallback.
 *
 * @returns {Promise<{
 *   gold:       { INR: number, USD: number },
 *   silver:     { INR: number, USD: number },
 *   fetchedAt:  string,
 *   isFallback: boolean,
 *   fallbackReason?: string
 * }>}
 */
export async function fetchPricesWithFallback() {
  try {
    const data = await fetchLivePrices();

    // Extra guard: if the returned data is somehow empty / malformed
    if (
      !data ||
      !data.gold ||
      !data.silver ||
      typeof data.gold.INR !== "number" ||
      typeof data.silver.INR !== "number"
    ) {
      throw new Error("API returned an incomplete price payload.");
    }

    return {
      ...data,
      isFallback: false,
    };
  } catch (error) {
    const reason = error?.message || "Unknown error";

    // ── Log the fallback event ──────────────────────────────────
    console.warn(
      `⚠️ [PriceFallback] API fetch failed — using default prices.\n   Reason: ${reason}`
    );

    return {
      gold: { ...DEFAULT_PRICES.gold },
      silver: { ...DEFAULT_PRICES.silver },
      fetchedAt: new Date().toISOString(),
      isFallback: true,
      fallbackReason: reason,
    };
  }
}

/**
 * Returns a copy of the default prices object.
 * Useful if other modules need access to the fallback values directly.
 */
export function getDefaultPrices() {
  return {
    gold: { ...DEFAULT_PRICES.gold },
    silver: { ...DEFAULT_PRICES.silver },
  };
}
