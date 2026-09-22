/**
 * Price calculation utilities for Gold & Silver Calculator
 * Contains purity definitions, currency config, city database, and calculation/formatting helpers.
 */

// ── Purity multipliers (fraction of pure metal) ────────────────

export const GOLD_PURITIES = [
  { label: "24K", value: 1.0,    description: "99.9% Pure (Investment)" },
  { label: "22K", value: 0.9167, description: "91.6% Hallmark (Jewelry)" },
  { label: "18K", value: 0.75,   description: "75.0% Diamond Jewelry" },
  { label: "14K", value: 0.5833, description: "58.3% Modern Ornaments" },
];

export const SILVER_PURITIES = [
  { label: "999", value: 1.0,   description: "99.9% Pure Fine Silver" },
  { label: "925", value: 0.925, description: "92.5% Sterling Silver" },
  { label: "900", value: 0.9,   description: "90.0% Coin / Artifact" },
  { label: "800", value: 0.8,   description: "80.0% Traditional Utensils" },
];

// ── Supported currencies ───────────────────────────────────────

export const CURRENCIES = [
  { code: "INR", symbol: "₹", name: "Indian Rupee" },
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "AED", symbol: "د.إ", name: "UAE Dirham", rateFromUsd: 3.6725 },
  { code: "EUR", symbol: "€", name: "Euro", rateFromUsd: 0.92 },
  { code: "GBP", symbol: "£", name: "British Pound", rateFromUsd: 0.79 },
];

// ── Quick weight presets ───────────────────────────────────────

export const WEIGHT_PRESETS = [
  { label: "1g", grams: 1, desc: "1 Gram" },
  { label: "8g", grams: 8, desc: "1 Pavan / Sovereign" },
  { label: "10g", grams: 10, desc: "1 Tola (Standard)" },
  { label: "50g", grams: 50, desc: "5 Tolas" },
  { label: "100g", grams: 100, desc: "100 Grams" },
  { label: "1kg", grams: 1000, desc: "1 Kilogram" },
];

// ── Comprehensive Bullion Cities Database ──────────────────────

export const BULLION_CITIES = [
  { name: "Mumbai", state: "Maharashtra", country: "India", hub: "Zaveri Bazaar (Bullion Hub)", varianceInr: 0, region: "Metro" },
  { name: "Delhi", state: "Delhi NCR", country: "India", hub: "Dariba Kalan & Chandni Chowk", varianceInr: 150, region: "Metro" },
  { name: "Kolkata", state: "West Bengal", country: "India", hub: "Bowbazar Gold Market", varianceInr: -120, region: "Metro" },
  { name: "Chennai", state: "Tamil Nadu", country: "India", hub: "T. Nagar (Madras Bullion)", varianceInr: 180, region: "South" },
  { name: "Bengaluru", state: "Karnataka", country: "India", hub: "Commercial Street & Chickpet", varianceInr: 90, region: "South" },
  { name: "Hyderabad", state: "Telangana", country: "India", hub: "Pot Market & Charminar", varianceInr: 120, region: "South" },
  { name: "Ahmedabad", state: "Gujarat", country: "India", hub: "Manek Chowk Bullion Association", varianceInr: -80, region: "West" },
  { name: "Surat", state: "Gujarat", country: "India", hub: "Gopipura & Chauta Bazar", varianceInr: -70, region: "West" },
  { name: "Pune", state: "Maharashtra", country: "India", hub: "Laxmi Road & Raviwar Peth", varianceInr: 20, region: "West" },
  { name: "Jaipur", state: "Rajasthan", country: "India", hub: "Johari Bazaar (Gem Capital)", varianceInr: 140, region: "North" },
  { name: "Lucknow", state: "Uttar Pradesh", country: "India", hub: "Chowk & Aminabad", varianceInr: 160, region: "North" },
  { name: "Kochi", state: "Kerala", country: "India", hub: "Broadway & Jew Town", varianceInr: 60, region: "South" },
  { name: "Thrissur", state: "Kerala", country: "India", hub: "Gold Capital of Kerala", varianceInr: 50, region: "South" },
  { name: "Coimbatore", state: "Tamil Nadu", country: "India", hub: "Big Bazaar Street", varianceInr: 170, region: "South" },
  { name: "Chandigarh", state: "Punjab/Haryana", country: "India", hub: "Sector 22 Market", varianceInr: 190, region: "North" },
  { name: "Indore", state: "Madhya Pradesh", country: "India", hub: "Sarafa Bazaar (Night Jewellers)", varianceInr: 80, region: "Central" },
  { name: "Patna", state: "Bihar", country: "India", hub: "Bakarganj Bullion Market", varianceInr: 210, region: "East" },
  { name: "Bhubaneswar", state: "Odisha", country: "India", hub: "Bapuji Nagar Gold Street", varianceInr: 110, region: "East" },
  { name: "Nagpur", state: "Maharashtra", country: "India", hub: "Itwari Sarafa Bazaar", varianceInr: 40, region: "Central" },
  { name: "Vadodara", state: "Gujarat", country: "India", hub: "Mandvi Sarafa Bazaar", varianceInr: -60, region: "West" },
  { name: "Visakhapatnam", state: "Andhra Pradesh", country: "India", hub: "Kurupam Market", varianceInr: 130, region: "South" },
  { name: "Vijayawada", state: "Andhra Pradesh", country: "India", hub: "Governorpet Bullion", varianceInr: 140, region: "South" },
  { name: "Madurai", state: "Tamil Nadu", country: "India", hub: "South Masi Street", varianceInr: 175, region: "South" },
  { name: "Varanasi", state: "Uttar Pradesh", country: "India", hub: "Thatheri Bazaar", varianceInr: 180, region: "North" },
  { name: "Amritsar", state: "Punjab", country: "India", hub: "Guru Bazaar Gold Souk", varianceInr: 200, region: "North" },
  { name: "Dubai", state: "Dubai", country: "UAE", hub: "Deira Gold Souk (Duty Free)", varianceInr: -8500, region: "International" },
  { name: "London", state: "England", country: "UK", hub: "Hatton Garden / LBMA", varianceInr: -3200, region: "International" },
  { name: "New York", state: "New York", country: "USA", hub: "47th St Diamond District", varianceInr: -3500, region: "International" },
  { name: "Singapore", state: "Central", country: "Singapore", hub: "Little India Serangoon Road", varianceInr: -4200, region: "International" },
];

/**
 * Filter cities database based on user query string
 */
export function searchBullionCities(query) {
  if (!query || !query.trim()) return BULLION_CITIES.slice(0, 8);
  const q = query.toLowerCase().trim();
  return BULLION_CITIES.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      c.state.toLowerCase().includes(q) ||
      c.country.toLowerCase().includes(q) ||
      c.hub.toLowerCase().includes(q)
  );
}

// ── Calculation ────────────────────────────────────────────────

/**
 * Calculate pure base metal cost = (pricePer10g / 10) × purityMultiplier × weight
 */
export function calculateBasePrice(pricePer10g, purityMultiplier, weightInGrams) {
  if (!pricePer10g || !purityMultiplier || !weightInGrams || weightInGrams <= 0) return 0;
  return (pricePer10g / 10) * purityMultiplier * weightInGrams;
}

export function calculatePrice(pricePer10g, purityMultiplier, weightInGrams) {
  return calculateBasePrice(pricePer10g, purityMultiplier, weightInGrams);
}

/**
 * Full breakdown calculation including Making Charges and GST
 */
export function calculateFullBreakdown({
  pricePer10g,
  purityMultiplier,
  weightInGrams,
  makingChargeType = "percentage",
  makingChargeValue = 0,
  includeGst = true,
  gstRate = 3.0,
}) {
  const baseMetal = calculateBasePrice(pricePer10g, purityMultiplier, weightInGrams);
  if (baseMetal <= 0) {
    return {
      baseMetal: 0,
      makingCharges: 0,
      subtotal: 0,
      gstAmount: 0,
      grandTotal: 0,
      ratePerGram: 0,
    };
  }

  const ratePerGram = (pricePer10g / 10) * purityMultiplier;

  let makingCharges = 0;
  const numVal = parseFloat(makingChargeValue) || 0;
  if (numVal > 0) {
    if (makingChargeType === "percentage") {
      makingCharges = baseMetal * (numVal / 100);
    } else {
      makingCharges = numVal * weightInGrams;
    }
  }

  const subtotal = baseMetal + makingCharges;
  const gstAmount = includeGst ? subtotal * (gstRate / 100) : 0;
  const grandTotal = subtotal + gstAmount;

  return {
    baseMetal,
    makingCharges,
    subtotal,
    gstAmount,
    grandTotal,
    ratePerGram,
  };
}

// ── Formatting ─────────────────────────────────────────────────

/**
 * Format a number as a localised currency string.
 */
export function formatCurrency(amount, currencyCode = "INR") {
  const num = typeof amount === "number" && !isNaN(amount) ? amount : 0;
  const locale = currencyCode === "INR" ? "en-IN" : "en-US";
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  } catch (e) {
    const symbol = CURRENCIES.find((c) => c.code === currencyCode)?.symbol || "₹";
    return `${symbol}${num.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
}

/**
 * Format an ISO date string into a human-readable "last updated" label.
 */
export function formatLastUpdated(isoString) {
  if (!isoString) return "Just now";
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return "Live";
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
