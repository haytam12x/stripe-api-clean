export const PLAN_NAMES = {
  basic: "Basic Results",
  full: "Full Results",
  professional: "Full Professional Results",
};

export const ZERO_DECIMAL_CURRENCIES = new Set([
  "JPY",
  "KRW",
  "VND",
  "IDR",
  "CLP",
  "HUF",
]);

export const PAYPAL_SUPPORTED_CURRENCIES = new Set([
  "AUD",
  "BRL",
  "CAD",
  "CNY",
  "CZK",
  "DKK",
  "EUR",
  "HKD",
  "HUF",
  "ILS",
  "JPY",
  "MYR",
  "MXN",
  "TWD",
  "NZD",
  "NOK",
  "PHP",
  "PLN",
  "GBP",
  "SGD",
  "SEK",
  "CHF",
  "THB",
  "USD",
  "KRW",
]);

export const PAYPAL_IN_COUNTRY_ONLY_CURRENCIES = new Set([
  "CNY",
  "MYR",
]);

export const DEFAULT_USD_PRICES = Object.freeze({
  basic: 2.99,
  full: 5.99,
  professional: 19.99,
});

export const TIER1_PRICES_BY_CURRENCY = Object.freeze({
  USD: Object.freeze({ basic: 3.99, full: 7.99, professional: 19.99 }),
  CAD: Object.freeze({ basic: 3.99, full: 7.99, professional: 19.99 }),
  GBP: Object.freeze({ basic: 3.99, full: 7.99, professional: 19.99 }),
  EUR: Object.freeze({ basic: 3.99, full: 7.99, professional: 19.99 }),
  AUD: Object.freeze({ basic: 3.99, full: 7.99, professional: 19.99 }),
  NZD: Object.freeze({ basic: 3.99, full: 7.99, professional: 19.99 }),
  CHF: Object.freeze({ basic: 3.99, full: 7.99, professional: 19.99 }),
  SGD: Object.freeze({ basic: 3.99, full: 7.99, professional: 19.99 }),
  JPY: Object.freeze({ basic: 599, full: 1199, professional: 2999 }),
  KRW: Object.freeze({ basic: 4900, full: 9900, professional: 29900 }),
  HKD: Object.freeze({ basic: 29, full: 59, professional: 149 }),
  TWD: Object.freeze({ basic: 129, full: 249, professional: 629 }),
  SEK: Object.freeze({ basic: 39, full: 79, professional: 199 }),
  NOK: Object.freeze({ basic: 39, full: 79, professional: 199 }),
  DKK: Object.freeze({ basic: 29, full: 59, professional: 149 }),
  ILS: Object.freeze({ basic: 14.9, full: 29.9, professional: 79.9 }),
  AED: Object.freeze({ basic: 14.9, full: 29.9, professional: 79.9 }),
  SAR: Object.freeze({ basic: 14.9, full: 29.9, professional: 79.9 }),
  QAR: Object.freeze({ basic: 14.9, full: 29.9, professional: 79.9 }),
});

export const TIER2_PRICES_BY_CURRENCY = Object.freeze({
  BRL: Object.freeze({ basic: 14.9, full: 29.9, professional: 99.9 }),
  MXN: Object.freeze({ basic: 59, full: 119, professional: 399 }),
  INR: Object.freeze({ basic: 249, full: 499, professional: 1699 }),
  PKR: Object.freeze({ basic: 849, full: 1699, professional: 5499 }),
  IDR: Object.freeze({ basic: 49000, full: 99000, professional: 329000 }),
  PHP: Object.freeze({ basic: 169, full: 339, professional: 1099 }),
  THB: Object.freeze({ basic: 99, full: 199, professional: 699 }),
  VND: Object.freeze({ basic: 79000, full: 149000, professional: 499000 }),
  TRY: Object.freeze({ basic: 99, full: 199, professional: 699 }),
  ZAR: Object.freeze({ basic: 59, full: 119, professional: 399 }),
  NGN: Object.freeze({ basic: 4900, full: 9900, professional: 29900 }),
  EGP: Object.freeze({ basic: 149, full: 299, professional: 999 }),
  COP: Object.freeze({ basic: 11900, full: 23900, professional: 79900 }),
  PEN: Object.freeze({ basic: 10.9, full: 21.9, professional: 74.9 }),
  BDT: Object.freeze({ basic: 349, full: 699, professional: 2399 }),
  MYR: Object.freeze({ basic: 12.9, full: 24.9, professional: 82.9 }),
  PLN: Object.freeze({ basic: 11.99, full: 23.99, professional: 79.99 }),
  CZK: Object.freeze({ basic: 69, full: 129, professional: 429 }),
  RON: Object.freeze({ basic: 13.9, full: 26.9, professional: 89.9 }),
  HUF: Object.freeze({ basic: 990, full: 1990, professional: 6990 }),
  CLP: Object.freeze({ basic: 2990, full: 5990, professional: 19990 }),
});

export const TIER1_COUNTRIES = new Set([
  "US",
  "CA",
  "GB",
  "DE",
  "FR",
  "IT",
  "ES",
  "NL",
  "BE",
  "AT",
  "IE",
  "FI",
  "PT",
  "GR",
  "LU",
  "MT",
  "CY",
  "SK",
  "SI",
  "EE",
  "LV",
  "LT",
  "HR",
  "AU",
  "NZ",
  "CH",
  "SG",
  "JP",
  "KR",
  "HK",
  "TW",
  "SE",
  "NO",
  "DK",
  "IL",
  "AE",
  "SA",
  "QA",
]);

export const TIER2_COUNTRIES = new Set([
  "BR",
  "MX",
  "IN",
  "PK",
  "ID",
  "PH",
  "TH",
  "VN",
  "TR",
  "ZA",
  "NG",
  "EG",
  "CO",
  "PE",
  "BD",
  "MY",
  "PL",
  "CZ",
  "RO",
  "HU",
  "CL",
]);

export const FORCED_USD_COUNTRIES = new Set([
  "MA",
  "AR",
  "KW",
  "BH",
  "OM",
]);

export const COUNTRY_TO_CURRENCY = Object.freeze({
  US: "USD",
  CA: "CAD",
  GB: "GBP",

  DE: "EUR",
  FR: "EUR",
  IT: "EUR",
  ES: "EUR",
  NL: "EUR",
  BE: "EUR",
  AT: "EUR",
  IE: "EUR",
  FI: "EUR",
  PT: "EUR",
  GR: "EUR",
  LU: "EUR",
  MT: "EUR",
  CY: "EUR",
  SK: "EUR",
  SI: "EUR",
  EE: "EUR",
  LV: "EUR",
  LT: "EUR",
  HR: "EUR",

  AU: "AUD",
  NZ: "NZD",
  CH: "CHF",
  SG: "SGD",
  JP: "JPY",
  KR: "KRW",
  HK: "HKD",
  TW: "TWD",
  SE: "SEK",
  NO: "NOK",
  DK: "DKK",
  IL: "ILS",
  AE: "AED",
  SA: "SAR",
  QA: "QAR",

  BR: "BRL",
  MX: "MXN",
  IN: "INR",
  PK: "PKR",
  ID: "IDR",
  PH: "PHP",
  TH: "THB",
  VN: "VND",
  TR: "TRY",
  ZA: "ZAR",
  NG: "NGN",
  EG: "EGP",
  CO: "COP",
  PE: "PEN",
  BD: "BDT",
  MY: "MYR",
  PL: "PLN",
  CZ: "CZK",
  RO: "RON",
  HU: "HUF",
  CL: "CLP",
});

export function normalizeCountryCode(value) {
  return String(value || "").trim().toUpperCase();
}

export function normalizePlanId(value) {
  return String(value || "").trim().toLowerCase();
}

export function normalizeCurrency(value) {
  return String(value || "").trim().toUpperCase();
}

export function isZeroDecimalCurrency(currency) {
  return ZERO_DECIMAL_CURRENCIES.has(normalizeCurrency(currency));
}

export function getPricingTier(countryCode) {
  const code = normalizeCountryCode(countryCode);

  if (FORCED_USD_COUNTRIES.has(code)) {
    return "usd-default";
  }

  if (TIER1_COUNTRIES.has(code)) {
    return "tier1";
  }

  if (TIER2_COUNTRIES.has(code)) {
    return "tier2";
  }

  return "usd-default";
}

export function getCurrencyForCountry(countryCode) {
  const code = normalizeCountryCode(countryCode);
  const tier = getPricingTier(code);

  if (tier === "usd-default") {
    return "USD";
  }

  return COUNTRY_TO_CURRENCY[code] || "USD";
}

export function getPricesForCountry(countryCode) {
  const code = normalizeCountryCode(countryCode);
  const tier = getPricingTier(code);
  const currency = getCurrencyForCountry(code);

  if (tier === "tier1") {
    return {
      countryCode: code || "US",
      tier,
      currency,
      prices: { ...TIER1_PRICES_BY_CURRENCY[currency] },
    };
  }

  if (tier === "tier2") {
    return {
      countryCode: code || "US",
      tier,
      currency,
      prices: { ...TIER2_PRICES_BY_CURRENCY[currency] },
    };
  }

  return {
    countryCode: code || "US",
    tier: "usd-default",
    currency: "USD",
    prices: { ...DEFAULT_USD_PRICES },
  };
}

export function getPlanPricingForCountry(countryCode, planId) {
  const normalizedPlanId = normalizePlanId(planId);

  if (!PLAN_NAMES[normalizedPlanId]) {
    throw new Error(`Unknown plan id: ${planId}`);
  }

  const pricing = getPricesForCountry(countryCode);

  return {
    countryCode: pricing.countryCode,
    tier: pricing.tier,
    currency: pricing.currency,
    planId: normalizedPlanId,
    planName: PLAN_NAMES[normalizedPlanId],
    price: pricing.prices[normalizedPlanId],
  };
}

export function getPayPalCurrencyForDisplayCurrency(currency) {
  const normalizedCurrency = normalizeCurrency(currency);

  if (!PAYPAL_SUPPORTED_CURRENCIES.has(normalizedCurrency)) {
    return "USD";
  }

  if (PAYPAL_IN_COUNTRY_ONLY_CURRENCIES.has(normalizedCurrency)) {
    return "USD";
  }

  return normalizedCurrency;
}
