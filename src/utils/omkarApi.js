/**
 * Omkar Cloud Real-Time Gold Price API integration
 * Endpoint: GET https://gold-price-api.omkar.cloud/price
 * Header: API-Key: ok_466e09bc5774646b2a07f09cc22a315e
 */

const OMKAR_API_KEY =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_OMKAR_GOLD_API_KEY) ||
  "ok_466e09bc5774646b2a07f09cc22a315e";

export async function fetchOmkarGoldPrice() {
  const url = "https://gold-price-api.omkar.cloud/price";

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "API-Key": OMKAR_API_KEY,
    },
  });

  const data = await response.json();

  if (!response.ok || typeof data.price_usd !== "number") {
    throw new Error(data.message || `HTTP ${response.status}: Omkar Gold Price API error`);
  }

  // 1 Troy Ounce = 31.1034768 grams -> 10 grams = price_usd * (10 / 31.1034768)
  const usdPer10g = data.price_usd * (10 / 31.1034768);
  // Estimated exchange rate 1 USD = 86.5 INR
  const inrPer10g = usdPer10g * 86.5;

  return {
    gold: {
      INR: Math.round(inrPer10g),
      USD: Math.round(usdPer10g * 10) / 10,
    },
    silver: {
      INR: Math.round(inrPer10g * 0.012),
      USD: Math.round(usdPer10g * 0.012 * 10) / 10,
    },
    fetchedAt: data.updated_at || new Date().toISOString(),
    apiSource: "Omkar Real-Time Gold API",
  };
}
