/* ══════════════════════════════════════════════════════════════
   OCR — Tesseract.js Receipt Scanner
   Uses Tesseract.js v5 loaded via CDN <script> tag
   Global: window.Tesseract.createWorker
   ══════════════════════════════════════════════════════════════ */

const OCR = (() => {
  /**
   * Scan a receipt image file and extract structured data.
   * @param {File} file - Image file (JPG/PNG)
   * @param {Function} onProgress - Callback with { status: string, progress: number (0-1) }
   * @returns {Promise<Object>} Parsed receipt data
   */
  async function scanReceipt(file, onProgress = () => {}) {
    if (!file || !file.type.startsWith('image/')) {
      throw new Error('Invalid file — please upload a JPG or PNG image');
    }

    // Check Tesseract is loaded
    if (typeof Tesseract === 'undefined') {
      throw new Error('Tesseract.js not loaded. Please check your internet connection and reload.');
    }

    onProgress({ status: 'Initializing OCR engine…', progress: 0.1 });

    // Create worker with progress logger
    const worker = await Tesseract.createWorker('eng', 1, {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          onProgress({
            status: 'Scanning receipt text…',
            progress: 0.2 + (m.progress * 0.6)
          });
        } else if (m.status === 'loading language traineddata') {
          onProgress({
            status: 'Loading language data…',
            progress: 0.15
          });
        }
      }
    });

    onProgress({ status: 'Processing image…', progress: 0.2 });

    try {
      const result = await worker.recognize(file);
      const text = result.data.text;

      onProgress({ status: 'Parsing extracted text…', progress: 0.9 });

      await worker.terminate();

      const parsed = parseReceiptText(text);
      parsed.rawText = text;

      onProgress({ status: 'Complete!', progress: 1.0 });

      return parsed;
    } catch (err) {
      await worker.terminate().catch(() => {});
      throw err;
    }
  }

  /**
   * Parse raw OCR text to extract receipt fields using regex heuristics
   */
  function parseReceiptText(text) {
    const result = {
      merchant: '',
      amount: null,
      currency: null,
      date: null,
      category: null,
    };

    if (!text || text.trim().length === 0) return result;

    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    // ── 1. Merchant Name ──
    // First meaningful line that isn't a number, date, or common label
    const skipPatterns = /^(total|subtotal|sub total|tax|gst|cgst|sgst|vat|date|time|receipt|invoice|bill|cash|card|change|balance|payment|thank|welcome|tel|ph|fax|email|www|http|address|\d{1,2}[\/\-\.]\d{1,2})/i;
    for (const line of lines) {
      const cleaned = line.replace(/[^a-zA-Z0-9\s&'.\-,]/g, '').trim();
      if (
        cleaned.length > 2 &&
        !/^[\d\s.\-\/,]+$/.test(cleaned) &&
        !skipPatterns.test(cleaned) &&
        cleaned.length < 80
      ) {
        result.merchant = cleaned.substring(0, 60);
        break;
      }
    }

    // ── 2. Total Amount ──
    // Look for "Total", "Grand Total", "Amount Due", etc.
    const totalPatterns = [
      /(?:grand\s*total|total\s*amount|total\s*due|amount\s*due|net\s*payable|balance\s*due|total)\s*[:\s=]*[₹$€£¥]?\s*([\d,]+\.?\d*)/gi,
      /[₹$€£¥]\s*([\d,]+\.\d{2})/g,
      /([\d,]+\.\d{2})/g,
    ];

    let amounts = [];
    for (const pattern of totalPatterns) {
      const matches = [...text.matchAll(pattern)];
      for (const m of matches) {
        const val = parseFloat(m[1].replace(/,/g, ''));
        if (val > 0 && val < 10000000) amounts.push(val);
      }
      if (amounts.length > 0 && pattern === totalPatterns[0]) {
        // If we found a labeled total, use the last one (usually grand total)
        result.amount = amounts[amounts.length - 1];
        break;
      }
    }
    if (!result.amount && amounts.length > 0) {
      result.amount = Math.max(...amounts);
    }

    // ── 3. Currency Detection ──
    if (/₹|INR|Rs\.?\s*\d/i.test(text)) result.currency = 'INR';
    else if (/\$\s*\d|USD/i.test(text)) result.currency = 'USD';
    else if (/€\s*\d|EUR/i.test(text)) result.currency = 'EUR';
    else if (/£\s*\d|GBP/i.test(text)) result.currency = 'GBP';
    else if (/¥\s*\d|JPY|YEN/i.test(text)) result.currency = 'JPY';
    else if (/A\$|AUD/i.test(text)) result.currency = 'AUD';
    else if (/C\$|CAD/i.test(text)) result.currency = 'CAD';
    else if (/S\$|SGD/i.test(text)) result.currency = 'SGD';

    // ── 4. Date Extraction ──
    const datePatterns = [
      // dd/mm/yyyy or dd-mm-yyyy or dd.mm.yyyy
      { regex: /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/, parse: (m) => new Date(`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`) },
      // yyyy-mm-dd
      { regex: /(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/, parse: (m) => new Date(`${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`) },
      // Month dd, yyyy
      { regex: /(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2}),?\s*(\d{4})/i, parse: (m) => new Date(m[0]) },
      // dd Month yyyy
      { regex: /(\d{1,2})\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{4})/i, parse: (m) => new Date(`${m[2]} ${m[1]}, ${m[3]}`) },
      // dd/mm/yy
      { regex: /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})(?!\d)/, parse: (m) => new Date(`20${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`) },
    ];

    for (const { regex, parse } of datePatterns) {
      const match = text.match(regex);
      if (match) {
        try {
          const d = parse(match);
          if (!isNaN(d.getTime()) && d.getFullYear() >= 2000 && d.getFullYear() <= 2030) {
            result.date = d.toISOString().split('T')[0];
            break;
          }
        } catch {}
      }
    }

    // ── 5. Category Inference ──
    const t = text.toLowerCase();
    if (/hotel|lodge|resort|room\s*(no|number|rate)|check[\s-]?in|accommodation|motel|inn|suite/i.test(t)) {
      result.category = 'Accommodation';
    } else if (/flight|airline|boarding|airport|air\s*india|indigo|spicejet|vistara|travel|cab|uber|ola|lyft|taxi|railway|train|metro|bus\s*ticket|toll/i.test(t)) {
      result.category = 'Travel';
    } else if (/restaurant|café|cafe|bistro|diner|food|lunch|dinner|breakfast|meal|pizza|burger|coffee|tea|snack|swiggy|zomato|domino/i.test(t)) {
      result.category = 'Meals';
    } else if (/software|subscription|license|saas|app\s*store|google\s*play|aws|azure|cloud|heroku|github|jira|slack|notion|figma|adobe/i.test(t)) {
      result.category = 'Software';
    } else if (/office|stationery|supplies|amazon|flipkart|printer|ink|toner|paper|desk|chair|monitor|keyboard/i.test(t)) {
      result.category = 'Office';
    } else if (/phone|mobile|internet|telecom|wifi|broadband|airtel|jio|vodafone|bsnl|data\s*pack/i.test(t)) {
      result.category = 'Communication';
    } else if (/cinema|movie|concert|event|ticket|amusement|entertainment|netflix|spotify|game/i.test(t)) {
      result.category = 'Entertainment';
    }

    return result;
  }

  /**
   * Read file as Data URL for preview
   */
  function readAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Could not read file'));
      reader.readAsDataURL(file);
    });
  }

  return { scanReceipt, parseReceiptText, readAsDataURL };
})();
