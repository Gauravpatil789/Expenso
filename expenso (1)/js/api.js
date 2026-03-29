/* ══════════════════════════════════════════════════════════════
   API — External Service Integration
   
   REST Countries:  https://restcountries.com/v3.1/all?fields=name,currencies
   Exchange Rates:  https://api.exchangerate-api.com/v4/latest/{BASE_CURRENCY}
   ══════════════════════════════════════════════════════════════ */

const API = (() => {
  // ── Fallback Exchange Rates (used when API fails) ──
  const FALLBACK_RATES = {
    USD: { INR: 84.0, EUR: 0.92, GBP: 0.79, JPY: 149.0, AUD: 1.53, CAD: 1.36, CHF: 0.88, SGD: 1.34, CNY: 7.24, SEK: 10.8, NOK: 10.9, DKK: 6.88, NZD: 1.68, ZAR: 18.2, BRL: 4.97, MXN: 17.15, KRW: 1340, THB: 35.5, MYR: 4.47 },
    INR: { USD: 0.0119, EUR: 0.011, GBP: 0.0094, JPY: 1.77, AUD: 0.018, CAD: 0.016, CHF: 0.0105, SGD: 0.016, CNY: 0.086 },
    EUR: { USD: 1.09, INR: 91.5, GBP: 0.86, JPY: 162, AUD: 1.66, CAD: 1.48, CHF: 0.96, SGD: 1.46, CNY: 7.87 },
    GBP: { USD: 1.27, INR: 106, EUR: 1.16, JPY: 189, AUD: 1.93, CAD: 1.72, CHF: 1.11, SGD: 1.69, CNY: 9.15 },
  };

  // ── Rate Cache (1 hour TTL) ──
  const CACHE_TTL = 3600000; // 1 hour

  function getCachedRates(baseCurrency) {
    const cached = Store.get('rates_' + baseCurrency);
    if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.rates;
    return null;
  }

  function setCachedRates(baseCurrency, rates) {
    Store.set('rates_' + baseCurrency, { rates, ts: Date.now() });
  }

  /**
   * Fetch all exchange rates for a base currency.
   * Primary API: https://api.exchangerate-api.com/v4/latest/{BASE}
   * Returns object like { USD: 1, EUR: 0.92, INR: 84, ... }
   */
  async function fetchRates(baseCurrency) {
    // Check cache first
    const cached = getCachedRates(baseCurrency);
    if (cached) return cached;

    try {
      const response = await fetch(`https://api.exchangerate-api.com/v4/latest/${baseCurrency}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (data && data.rates) {
        setCachedRates(baseCurrency, data.rates);
        return data.rates;
      }
      throw new Error('Invalid response');
    } catch (err) {
      console.warn('Exchange rate API failed:', err.message);
      // Return fallback
      if (FALLBACK_RATES[baseCurrency]) {
        return { [baseCurrency]: 1, ...FALLBACK_RATES[baseCurrency] };
      }
      return null;
    }
  }

  /**
   * Get single conversion rate FROM → TO
   */
  async function getRate(from, to) {
    if (from === to) return 1;

    const rates = await fetchRates(from);
    if (rates && rates[to]) return rates[to];

    // Try reverse
    const revRates = await fetchRates(to);
    if (revRates && revRates[from]) return 1 / revRates[from];

    // Deep fallback
    if (FALLBACK_RATES[from] && FALLBACK_RATES[from][to]) return FALLBACK_RATES[from][to];
    if (FALLBACK_RATES[to] && FALLBACK_RATES[to][from]) return 1 / FALLBACK_RATES[to][from];

    App.toast('Using estimated exchange rate', 'info');
    return 1;
  }

  /**
   * Convert amount from one currency to another
   */
  async function convert(amount, from, to) {
    const rate = await getRate(from, to);
    return {
      converted: Math.round(amount * rate * 100) / 100,
      rate
    };
  }

  // ── Countries API ──
  const COUNTRIES_URL = 'https://restcountries.com/v3.1/all?fields=name,currencies';

  const FALLBACK_COUNTRIES = [
    { name: { common: 'India' }, currencies: { INR: { name: 'Indian rupee', symbol: '₹' } } },
    { name: { common: 'United States' }, currencies: { USD: { name: 'United States dollar', symbol: '$' } } },
    { name: { common: 'United Kingdom' }, currencies: { GBP: { name: 'British pound', symbol: '£' } } },
    { name: { common: 'Germany' }, currencies: { EUR: { name: 'Euro', symbol: '€' } } },
    { name: { common: 'Japan' }, currencies: { JPY: { name: 'Japanese yen', symbol: '¥' } } },
    { name: { common: 'Australia' }, currencies: { AUD: { name: 'Australian dollar', symbol: '$' } } },
    { name: { common: 'Canada' }, currencies: { CAD: { name: 'Canadian dollar', symbol: '$' } } },
    { name: { common: 'Singapore' }, currencies: { SGD: { name: 'Singapore dollar', symbol: '$' } } },
    { name: { common: 'Switzerland' }, currencies: { CHF: { name: 'Swiss franc', symbol: 'Fr' } } },
    { name: { common: 'China' }, currencies: { CNY: { name: 'Chinese yuan', symbol: '¥' } } },
    { name: { common: 'Brazil' }, currencies: { BRL: { name: 'Brazilian real', symbol: 'R$' } } },
    { name: { common: 'South Africa' }, currencies: { ZAR: { name: 'South African rand', symbol: 'R' } } },
  ];

  /**
   * Fetch all countries with their currencies.
   * Uses caching to avoid repeated API calls.
   */
  async function fetchCountries() {
    const cached = Store.get('countries_cache');
    if (cached) return cached;

    try {
      const response = await fetch(COUNTRIES_URL);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const sorted = data
        .filter(c => c.currencies && Object.keys(c.currencies).length > 0)
        .sort((a, b) => a.name.common.localeCompare(b.name.common));
      Store.set('countries_cache', sorted);
      return sorted;
    } catch (err) {
      console.warn('Countries API failed:', err.message);
      App.toast('Could not load countries — using defaults', 'error');
      return FALLBACK_COUNTRIES;
    }
  }

  return { fetchRates, getRate, convert, fetchCountries };
})();
