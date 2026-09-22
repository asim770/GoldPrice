/**
 * Price Fallback Module
 * ---------------------
 * Coordinates Gemini AI real-time price fetch with graceful city-aware fallback defaults.
 * All base rates are stored per 10 grams in INR and USD.
 */

import { fetchLivePrices } from "../gemini";
import { BULLION_CITIES } from "./priceUtils";

// ── Default 2026 realistic baseline prices (per 10 grams) ──────
const DEFAULT_PRICES = Object.freeze({
  gold: {
    INR: 154750,      // ~₹1,54,750 per 10g (24K Pure)
    INR_22k: 141850,  // ~₹1,41,850 per 10g (22K Hallmark 916)
    INR_18k: 116060,  // ~₹1,16,060 per 10g (18K Jewelry 750)
    INR_per_gram: 15475,
    USD: 1613.2,      // ~$1,613 per 10g
  },
  silver: {
    INR: 2500,        // ~₹2,500 per 10g (999 Fine Silver)
    INR_kg: 250000,   // ~₹2,50,000 per 1 kg
    INR_925: 2312,    // ~₹2,312 per 10g (925 Sterling)
    INR_per_gram: 250,
    USD: 26.1,        // ~$26.1 per 10g
  },
  ratio: 61.9,
  source: "Market Benchmark Rates",
});

/**
 * Get realistic localized rates for any specific place
 */
function getCityAdjustedDefaults(location = "") {
  const locLower = location.toLowerCase();
  const matched = BULLION_CITIES.find(
    (c) => locLower.includes(c.name.toLowerCase()) || locLower.includes(c.state.toLowerCase())
  );
  const variance = matched ? matched.varianceInr : 0;

  const baseGold = DEFAULT_PRICES.gold.INR + variance;
  const baseSilver = DEFAULT_PRICES.silver.INR + Math.round(variance * 0.015);

  return {
    gold: {
      INR: baseGold,
      INR_22k: Math.round(baseGold * (22 / 24)),
      INR_18k: Math.round(baseGold * (18 / 24)),
      INR_per_gram: Math.round(baseGold / 10),
      USD: DEFAULT_PRICES.gold.USD,
    },
    silver: {
      INR: baseSilver,
      INR_kg: baseSilver * 100,
      INR_925: Math.round(baseSilver * 0.925),
      INR_per_gram: Math.round((baseSilver / 10) * 10) / 10,
      USD: DEFAULT_PRICES.silver.USD,
    },
    ratio: Math.round((baseGold / baseSilver) * 10) / 10,
    source: matched
      ? `${matched.name} Bullion Market Benchmark (${matched.hub})`
      : "National Bullion Benchmark",
  };
}

/**
 * Fetch live prices from Gemini AI with automatic city-aware fallback.
 */
export async function fetchPricesWithFallback(
  location = "India (National)",
  date = new Date().toISOString().split("T")[0]
) {
  try {
    const liveData = await fetchLivePrices(location, date);

    if (
      !liveData ||
      !liveData.gold ||
      !liveData.silver ||
      typeof liveData.gold.INR !== "number" ||
      typeof liveData.silver.INR !== "number"
    ) {
      throw new Error("Incomplete price payload received.");
    }

    return {
      ...liveData,
      isFallback: false,
    };
  } catch (error) {
    const reason = error?.message || "Unknown error";
    console.warn(`⚠️ [PriceFallback] Real-time fetch failed for "${location}" — using city benchmark: ${reason}`);

    const cityDefaults = getCityAdjustedDefaults(location);

    return {
      gold: { ...cityDefaults.gold },
      silver: { ...cityDefaults.silver },
      ratio: cityDefaults.ratio,
      source: cityDefaults.source,
      location: location || "India (National)",
      date: date || new Date().toISOString().split("T")[0],
      fetchedAt: new Date().toISOString(),
      isFallback: true,
      fallbackReason: reason,
    };
  }
}

/**
 * Returns a copy of the default prices object.
 */
export function getDefaultPrices() {
  return {
    gold: { ...DEFAULT_PRICES.gold },
    silver: { ...DEFAULT_PRICES.silver },
    ratio: DEFAULT_PRICES.ratio,
  };
}
