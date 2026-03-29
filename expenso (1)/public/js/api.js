/* ══════════════════════════════════════════════════════════════
   API — External Service Integration
   REST Countries + Exchange Rates
   ══════════════════════════════════════════════════════════════ */

const ExternalAPI = (() => {
  const FALLBACK_RATES = {
    USD: { INR: 84.0, EUR: 0.92, GBP: 0.79, JPY: 149.0, AUD: 1.53, CAD: 1.36, CHF: 0.88, SGD: 1.34, CNY: 7.24 },
    INR: { USD: 0.0119, EUR: 0.011, GBP: 0.0094, JPY: 1.77, AUD: 0.018, CAD: 0.016, CHF: 0.0105, SGD: 0.016, CNY: 0.086 },
    EUR: { USD: 1.09, INR: 91.5, GBP: 0.86, JPY: 162, AUD: 1.66, CAD: 1.48, CHF: 0.96, SGD: 1.46, CNY: 7.87 },
    GBP: { USD: 1.27, INR: 106, EUR: 1.16, JPY: 189, AUD: 1.93, CAD: 1.72, CHF: 1.11, SGD: 1.69, CNY: 9.15 },
  };

  const CACHE_TTL = 3600000;
  const rateCache = {};

  async function fetchRates(baseCurrency) {
    if (rateCache[baseCurrency] && Date.now() - rateCache[baseCurrency].ts < CACHE_TTL) {
      return rateCache[baseCurrency].rates;
    }
    try {
      const response = await fetch(`https://api.exchangerate-api.com/v4/latest/${baseCurrency}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (data && data.rates) {
        rateCache[baseCurrency] = { rates: data.rates, ts: Date.now() };
        return data.rates;
      }
      throw new Error('Invalid response');
    } catch (err) {
      console.warn('Exchange rate API failed:', err.message);
      if (FALLBACK_RATES[baseCurrency]) return { [baseCurrency]: 1, ...FALLBACK_RATES[baseCurrency] };
      return null;
    }
  }

  async function getRate(from, to) {
    if (from === to) return 1;
    const rates = await fetchRates(from);
    if (rates && rates[to]) return rates[to];
    const revRates = await fetchRates(to);
    if (revRates && revRates[from]) return 1 / revRates[from];
    if (FALLBACK_RATES[from] && FALLBACK_RATES[from][to]) return FALLBACK_RATES[from][to];
    if (FALLBACK_RATES[to] && FALLBACK_RATES[to][from]) return 1 / FALLBACK_RATES[to][from];
    return 1;
  }

  async function convert(amount, from, to) {
    const rate = await getRate(from, to);
    return { converted: Math.round(amount * rate * 100) / 100, rate };
  }

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
  ];

  let countriesCache = null;
  async function fetchCountries() {
    if (countriesCache) return countriesCache;
    try {
      const response = await fetch(COUNTRIES_URL);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      countriesCache = data
        .filter(c => c.currencies && Object.keys(c.currencies).length > 0)
        .sort((a, b) => a.name.common.localeCompare(b.name.common));
      return countriesCache;
    } catch (err) {
      console.warn('Countries API failed:', err.message);
      return FALLBACK_COUNTRIES;
    }
  }

  return { fetchRates, getRate, convert, fetchCountries };
})();
