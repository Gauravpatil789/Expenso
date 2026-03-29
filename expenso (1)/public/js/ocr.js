/* ══════════════════════════════════════════════════════════════
   OCR — Tesseract.js Receipt Scanner
   ══════════════════════════════════════════════════════════════ */

const OCR = (() => {
  async function scanReceipt(file, onProgress = () => {}) {
    if (!file || !file.type.startsWith('image/')) {
      throw new Error('Invalid file — please upload a JPG or PNG image');
    }
    if (typeof Tesseract === 'undefined') {
      throw new Error('Tesseract.js not loaded. Check your internet connection and reload.');
    }

    onProgress({ status: 'Initializing OCR engine…', progress: 0.1 });

    const worker = await Tesseract.createWorker('eng', 1, {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          onProgress({ status: 'Scanning receipt…', progress: 0.2 + (m.progress * 0.6) });
        } else if (m.status === 'loading language traineddata') {
          onProgress({ status: 'Loading language data…', progress: 0.15 });
        }
      }
    });

    onProgress({ status: 'Processing image…', progress: 0.2 });

    try {
      const result = await worker.recognize(file);
      const text = result.data.text;
      onProgress({ status: 'Parsing text…', progress: 0.9 });
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

  function parseReceiptText(text) {
    const result = { merchant: '', amount: null, currency: null, date: null, category: null, lines: [] };
    if (!text || text.trim().length === 0) return result;

    const rawLines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    // Merchant
    const skipPatterns = /^(total|subtotal|sub total|tax|gst|cgst|sgst|vat|date|time|receipt|invoice|bill|cash|card|change|balance|payment|thank|welcome|tel|ph|fax|email|www|http|address|\d{1,2}[\/\-\.]\d{1,2})/i;
    for (const line of rawLines) {
      const cleaned = line.replace(/[^a-zA-Z0-9\s&'.\-,]/g, '').trim();
      if (cleaned.length > 2 && !/^[\d\s.\-\/,]+$/.test(cleaned) && !skipPatterns.test(cleaned) && cleaned.length < 80) {
        result.merchant = cleaned.substring(0, 60);
        break;
      }
    }

    // Total amount
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
        result.amount = amounts[amounts.length - 1];
        break;
      }
    }
    if (!result.amount && amounts.length > 0) result.amount = Math.max(...amounts);

    // Currency
    if (/₹|INR|Rs\.?\s*\d/i.test(text)) result.currency = 'INR';
    else if (/\$\s*\d|USD/i.test(text)) result.currency = 'USD';
    else if (/€\s*\d|EUR/i.test(text)) result.currency = 'EUR';
    else if (/£\s*\d|GBP/i.test(text)) result.currency = 'GBP';
    else if (/¥\s*\d|JPY|YEN/i.test(text)) result.currency = 'JPY';

    // Date
    const datePatterns = [
      { regex: /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/, parse: (m) => new Date(`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`) },
      { regex: /(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/, parse: (m) => new Date(`${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`) },
      { regex: /(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2}),?\s*(\d{4})/i, parse: (m) => new Date(m[0]) },
      { regex: /(\d{1,2})\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{4})/i, parse: (m) => new Date(`${m[2]} ${m[1]}, ${m[3]}`) },
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

    // Category
    const t = text.toLowerCase();
    if (/hotel|lodge|resort|accommodation/i.test(t)) result.category = 'Accommodation';
    else if (/flight|airline|airport|travel|cab|uber|ola|taxi|train|metro/i.test(t)) result.category = 'Travel';
    else if (/restaurant|café|cafe|food|lunch|dinner|breakfast|meal|pizza|coffee/i.test(t)) result.category = 'Meals';
    else if (/software|subscription|license|saas|figma|adobe/i.test(t)) result.category = 'Software';
    else if (/office|stationery|supplies|amazon|printer|paper/i.test(t)) result.category = 'Office';
    else if (/phone|mobile|internet|telecom|wifi/i.test(t)) result.category = 'Communication';

    // Extract line items
    const linePattern = /^(.+?)\s+([\d,]+\.?\d*)\s*$/;
    for (const line of rawLines) {
      const m = line.match(linePattern);
      if (m && m[1].length > 2 && !skipPatterns.test(m[1]) && parseFloat(m[2].replace(/,/g,'')) > 0) {
        result.lines.push({ description: m[1].trim(), amount: parseFloat(m[2].replace(/,/g,'')) });
      }
      if (result.lines.length >= 10) break;
    }

    return result;
  }

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
