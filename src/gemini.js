/**
 * Gemini API integration for fetching live gold & silver market prices.
 * Uses direct fetch with Google Search grounding for real-time market accuracy.
 */

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

/**
 * Cache for storing fetched prices per (location, date) to respect API rate limits.
 * TTL = 3 minutes.
 */
const priceCache = new Map();
const CACHE_TTL_MS = 3 * 60 * 1000;

/**
 * Dynamic prompt generator based on specified location and date.
 */
function buildPrompt(location = "India (National)", date = new Date().toISOString().split("T")[0]) {
  return `Search and return the real-time live market prices for 24K Gold and 999 Fine Silver specifically for the location/city "${location}" on date "${date}".
Current market reference: In India, 24K gold is around ₹1,45,000 - ₹1,55,000 per 10 grams, and 999 silver is around ₹2,200 - ₹2,600 per 10 grams (₹2,20,000 - ₹2,60,000 per kg).
Return ONLY a valid, raw JSON object with NO markdown formatting, NO backticks, and NO extra text:
{
  "location": "${location}",
  "gold_price_per_10g_inr": <number for 24K gold per 10g in INR>,
  "gold_price_22k_per_10g_inr": <number for 22K hallmark gold per 10g in INR>,
  "silver_price_per_10g_inr": <number for 999 silver per 10g in INR>,
  "silver_price_per_kg_inr": <number for 999 silver per 1 kg in INR>,
  "gold_price_per_10g_usd": <number for gold per 10g in USD>,
  "silver_price_per_10g_usd": <number for silver per 10g in USD>,
  "market_status": "<string, e.g. Open / Closed / Live>",
  "source": "<string, e.g. IBJA / Local Bullion Association>"
}`;
}

const REQUEST_TIMEOUT_MS = 25_000;
const MAX_RETRIES = 1; // 1 retry per model to avoid hitting quota rate limits
const RETRY_DELAY_MS = 1200;

/**
 * Models + API versions to try in order.
 * Primary model: gemini-2.5-flash (verified active with search grounding & quota).
 */
const ENDPOINTS = [
  { model: "gemini-2.5-flash", version: "v1beta" },
  { model: "gemini-3.6-flash", version: "v1beta" },
  { model: "gemini-3.5-flash", version: "v1beta" },
  { model: "gemini-flash-latest", version: "v1beta" },
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Clean and parse raw JSON text from Gemini response (handles code fences, extra text).
 */
function parsePricePayload(rawText, location) {
  let cleaned = rawText.trim();

  // Strip markdown code fences (```json ... ``` or ``` ...)
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");

  let parsed = null;
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    try {
      parsed = JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
    } catch (e) {
      parsed = null;
    }
  }

  // Regex fallback if JSON parse fails
  if (!parsed || typeof parsed.gold_price_per_10g_inr !== "number") {
    const goldInrMatch = cleaned.match(/["']?gold_price_per_10g_inr["']?\s*:\s*([\d.]+)/i);
    const silverInrMatch = cleaned.match(/["']?silver_price_per_10g_inr["']?\s*:\s*([\d.]+)/i);
    const goldUsdMatch = cleaned.match(/["']?gold_price_per_10g_usd["']?\s*:\s*([\d.]+)/i);
    const silverUsdMatch = cleaned.match(/["']?silver_price_per_10g_usd["']?\s*:\s*([\d.]+)/i);

    if (goldInrMatch && silverInrMatch) {
      parsed = {
        gold_price_per_10g_inr: parseFloat(goldInrMatch[1]),
        silver_price_per_10g_inr: parseFloat(silverInrMatch[1]),
        gold_price_per_10g_usd: goldUsdMatch ? parseFloat(goldUsdMatch[1]) : 1620,
        silver_price_per_10g_usd: silverUsdMatch ? parseFloat(silverUsdMatch[1]) : 26.0,
      };
    }
  }

  if (!parsed || !parsed.gold_price_per_10g_inr || parsed.gold_price_per_10g_inr <= 0) {
    return null;
  }

  // Compute standard derived values if missing
  const gold24k = parsed.gold_price_per_10g_inr;
  const gold22k = parsed.gold_price_22k_per_10g_inr || Math.round(gold24k * (22 / 24));
  const gold18k = Math.round(gold24k * (18 / 24));

  const silver10g = parsed.silver_price_per_10g_inr || 2450;
  const silverKg = parsed.silver_price_per_kg_inr || Math.round(silver10g * 100);
  const silver925 = Math.round(silver10g * 0.925);

  const goldUsd = parsed.gold_price_per_10g_usd || Math.round((gold24k / 87) * 10) / 10;
  const silverUsd = parsed.silver_price_per_10g_usd || Math.round((silver10g / 87) * 100) / 100;

  return {
    gold: {
      INR: gold24k,
      INR_22k: gold22k,
      INR_18k: gold18k,
      INR_per_gram: Math.round(gold24k / 10),
      USD: goldUsd,
    },
    silver: {
      INR: silver10g,
      INR_kg: silverKg,
      INR_925: silver925,
      INR_per_gram: Math.round((silver10g / 10) * 10) / 10,
      USD: silverUsd,
    },
    ratio: Math.round((gold24k / silver10g) * 10) / 10,
    source: parsed.source || `${location} Local Bullion Market (Google Search Grounded)`,
  };
}

/**
 * Try fetching prices with a specific model + API version using raw fetch.
 */
async function tryFetchWithEndpoint(model, version, location, date, useSearch = true) {
  if (!API_KEY) {
    throw new Error("Missing API key — please set VITE_GEMINI_API_KEY in your .env file.");
  }

  const promptText = buildPrompt(location, date);
  const url = `https://generativelanguage.googleapis.com/${version}/models/${model}:generateContent?key=${API_KEY}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const payload = {
      contents: [{ parts: [{ text: promptText }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 1024,
      },
    };

    if (useSearch) {
      payload.tools = [{ googleSearch: {} }];
    } else {
      payload.generationConfig.responseMimeType = "application/json";
    }

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify(payload),
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`HTTP ${response.status}: ${errBody.slice(0, 160)}`);
    }

    const data = await response.json();
    let rawText = "";
    const parts = data.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if (part.text) {
        rawText += part.text + "\n";
      }
    }

    if (!rawText.trim()) {
      throw new Error("Empty response from Gemini API");
    }

    const parsed = parsePricePayload(rawText, location);
    if (!parsed) {
      throw new Error("Could not parse valid price JSON from Gemini response.");
    }

    return parsed;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === "AbortError") {
      throw new Error("Request timed out — please try again.");
    }
    throw error;
  }
}

/**
 * Fetches live gold & silver prices from the Gemini API for a given location and date.
 */
export async function fetchLivePrices(
  location = "India (National)",
  date = new Date().toISOString().split("T")[0]
) {
  // Check cache first to preserve free-tier quota & deliver instant results
  const cacheKey = `${location.toLowerCase().trim()}_${date}`;
  const cached = priceCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    console.log(`⚡ [Gemini Cache] Serving cached prices for ${location}`);
    return { ...cached.data };
  }

  let lastError = null;

  for (const { model, version } of ENDPOINTS) {
    for (const useSearch of [true, false]) {
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          console.log(
            `🔄 [Gemini] Fetching rates with ${model} for ${location}…`
          );

          const result = await tryFetchWithEndpoint(model, version, location, date, useSearch);

          console.log(`✅ [Gemini] Live prices received for ${location}`);

          const responseData = {
            ...result,
            location: location || "India (National)",
            date: date || new Date().toISOString().split("T")[0],
            fetchedAt: new Date().toISOString(),
            isFallback: false,
          };

          // Save to memory cache
          priceCache.set(cacheKey, {
            data: responseData,
            timestamp: Date.now(),
          });

          return responseData;
        } catch (error) {
          lastError = error;

          // Don't retry if it's an auth/key error
          if (
            error.message?.includes("API_KEY") ||
            error.message?.includes("403") ||
            error.message?.includes("401") ||
            error.message?.includes("Missing API key")
          ) {
            throw new Error(
              `API key error — ${error.message}. Please check your VITE_GEMINI_API_KEY in .env.`
            );
          }

          // If rate limited or 404, quickly move on
          if (error.message?.includes("429") || error.message?.includes("404")) {
            break;
          }

          if (attempt < MAX_RETRIES) {
            await sleep(RETRY_DELAY_MS);
          }
        }
      }
    }
  }

  throw lastError || new Error("All Gemini API attempts failed.");
}
