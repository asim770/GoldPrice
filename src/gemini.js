/**
 * Gemini API integration for fetching live gold & silver prices.
 * Uses the Gemini 2.0 Flash model with structured JSON output.
 */

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;

const PRICE_PROMPT = `You are a financial data assistant. Return ONLY a valid JSON object with the current approximate market prices for gold and silver per 10 grams in INR and USD. Use the most recent prices you have knowledge of. Do not include any explanation, markdown formatting, or code blocks — just raw JSON in exactly this format:
{"gold_price_per_10g_inr": <number>, "silver_price_per_10g_inr": <number>, "gold_price_per_10g_usd": <number>, "silver_price_per_10g_usd": <number>}`;

const REQUEST_TIMEOUT_MS = 15_000;

/**
 * Fetches live gold & silver prices (per 10 grams) from the Gemini API.
 * @returns {Promise<{gold: {INR: number, USD: number}, silver: {INR: number, USD: number}, fetchedAt: string}>}
 */
export async function fetchLivePrices() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text: PRICE_PROMPT }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 256,
        },
      }),
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`API request failed (HTTP ${response.status})`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      throw new Error("Empty response from Gemini API");
    }

    // Strip possible markdown fences
    const cleaned = text
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
    const prices = JSON.parse(cleaned);

    // Validate shape
    const required = [
      "gold_price_per_10g_inr",
      "silver_price_per_10g_inr",
      "gold_price_per_10g_usd",
      "silver_price_per_10g_usd",
    ];
    for (const key of required) {
      if (typeof prices[key] !== "number" || prices[key] <= 0) {
        throw new Error(`Invalid or missing field: ${key}`);
      }
    }

    return {
      gold: {
        INR: prices.gold_price_per_10g_inr,
        USD: prices.gold_price_per_10g_usd,
      },
      silver: {
        INR: prices.silver_price_per_10g_inr,
        USD: prices.silver_price_per_10g_usd,
      },
      fetchedAt: new Date().toISOString(),
    };
  } catch (error) {
    clearTimeout(timeoutId);

    if (error.name === "AbortError") {
      throw new Error("Request timed out — please try again.");
    }

    throw error;
  }
}
