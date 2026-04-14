import * as cheerio from "cheerio";

export interface RateSelector {
  selector: string;
  label: string;
  regex?: string;
}

export interface BankSelectorConfig {
  mode?: "html" | "json";
  checking?: RateSelector[];
  savings?: RateSelector[];
  cd?: RateSelector[];
}

export interface ScrapedRate {
  rateType: string;
  rateName: string;
  rateValue: string;
}

export interface ScrapeResult {
  success: boolean;
  rates: ScrapedRate[];
  error?: string;
}

const FETCH_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5",
  "Connection": "keep-alive",
  "Upgrade-Insecure-Requests": "1",
};

const APY_PATTERN = /(\d+\.?\d*)\s*%/;

function extractRate(text: string, regex?: string): string | null {
  const pattern = regex ? new RegExp(regex) : APY_PATTERN;
  const match = text.match(pattern);
  if (!match) return null;
  if (match[1]) return `${parseFloat(match[1]).toFixed(2)}%`;
  return match[0].includes("%") ? match[0].trim() : `${match[0]}%`;
}

function getByPath(obj: any, path: string): any {
  return path
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .reduce((cur, key) => cur?.[key], obj);
}

function formatRate(value: any, regex?: string): string | null {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  if (!str) return null;
  if (regex) {
    const m = str.match(new RegExp(regex));
    if (m) return m[0].includes("%") ? m[0].trim() : `${m[1]}%`;
  }
  const n = parseFloat(str);
  if (!isNaN(n)) return `${n.toFixed(2)}%`;
  if (str.includes("%")) return str;
  return null;
}

async function fetchWithTimeout(url: string, timeoutMs = 15000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: FETCH_HEADERS, redirect: "follow" });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

async function scrapeJson(
  bankUrl: string,
  bankName: string,
  config: BankSelectorConfig
): Promise<ScrapeResult> {
  let res: Response;
  try {
    res = await fetchWithTimeout(bankUrl);
  } catch (e: any) {
    return { success: false, rates: [], error: e.name === "AbortError" ? "Request timed out" : e.message };
  }

  if (!res.ok) return { success: false, rates: [], error: `HTTP ${res.status}: ${res.statusText}` };

  let json: any;
  try {
    json = await res.json();
  } catch {
    return { success: false, rates: [], error: "Response is not valid JSON" };
  }

  const rates: ScrapedRate[] = [];
  const types: Array<keyof Pick<BankSelectorConfig, "checking" | "savings" | "cd">> = ["checking", "savings", "cd"];

  for (const type of types) {
    const selectors = config[type];
    if (!selectors) continue;
    for (const sel of selectors) {
      const value = getByPath(json, sel.selector);
      const formatted = formatRate(value, sel.regex);
      if (formatted) {
        rates.push({ rateType: type, rateName: sel.label, rateValue: formatted });
      }
    }
  }

  return { success: true, rates };
}

async function scrapeHtml(
  bankUrl: string,
  bankName: string,
  config: BankSelectorConfig
): Promise<ScrapeResult> {
  let res: Response;
  try {
    res = await fetchWithTimeout(bankUrl);
  } catch (e: any) {
    return { success: false, rates: [], error: e.name === "AbortError" ? "Request timed out" : e.message };
  }

  if (!res.ok) return { success: false, rates: [], error: `HTTP ${res.status}: ${res.statusText}` };

  const html = await res.text();
  const $ = cheerio.load(html);
  const rates: ScrapedRate[] = [];

  const types: Array<keyof Pick<BankSelectorConfig, "checking" | "savings" | "cd">> = ["checking", "savings", "cd"];

  for (const type of types) {
    const selectors = config[type];
    if (!selectors) continue;
    for (const sel of selectors) {
      if (!sel.selector.trim()) continue;
      $(sel.selector).each((_, el) => {
        const text = $(el).text().trim();
        const rate = extractRate(text, sel.regex);
        if (rate) {
          if (!rates.find((r) => r.rateType === type && r.rateName === sel.label && r.rateValue === rate)) {
            rates.push({ rateType: type, rateName: sel.label, rateValue: rate });
          }
        }
      });
    }
  }

  if (rates.length === 0) {
    const bodyText = $.text();
    let count = 0;
    const seen = new Set<string>();
    for (const match of bodyText.matchAll(/(\d+\.?\d+)\s*%\s*APY/gi)) {
      const val = `${parseFloat(match[1]).toFixed(2)}%`;
      if (!seen.has(val)) {
        seen.add(val);
        rates.push({ rateType: "savings", rateName: "APY (auto-detected)", rateValue: val });
        if (++count >= 5) break;
      }
    }
  }

  return { success: true, rates };
}

export async function scrapeBank(
  bankUrl: string,
  bankName: string,
  config: BankSelectorConfig
): Promise<ScrapeResult> {
  if (config.mode === "json") {
    return scrapeJson(bankUrl, bankName, config);
  }
  return scrapeHtml(bankUrl, bankName, config);
}

export const DEFAULT_BANK_CONFIGS: Array<{
  bankName: string;
  bankUrl: string;
  notes: string;
  selectors: BankSelectorConfig;
}> = [
  {
    bankName: "Federal Reserve – Fed Funds Rate",
    bankUrl: "https://markets.newyorkfed.org/read?startDt=2024-01-01&eventCodes=EFFR&productCode=50&sort=postDt:-1&limit=1&format=json",
    notes: "NY Fed JSON API – Effective Federal Funds Rate (EFFR). No authentication required.",
    selectors: {
      mode: "json",
      savings: [
        { selector: "refRates[0].percentRate", label: "Effective Federal Funds Rate" },
      ],
    },
  },
  {
    bankName: "US Treasury – Bill Rates",
    bankUrl: "https://api.fiscaldata.treasury.gov/services/api/v1/accounting/od/avg_interest_rates?sort=-record_date&format=json&fields=record_date,security_type_desc,avg_interest_rate_amt&filter=security_type_desc:eq:Treasury+Bills",
    notes: "US Treasury Fiscal Data API – Average interest rate on Treasury Bills. No authentication required.",
    selectors: {
      mode: "json",
      savings: [
        { selector: "data[0].avg_interest_rate_amt", label: "Treasury Bill Avg Rate" },
      ],
    },
  },
  {
    bankName: "Ally Bank – Online Savings",
    bankUrl: "https://www.ally.com/bank/online-savings-account/",
    notes: "HTML scrape of Ally savings page. Ally's own current APY is JavaScript-rendered; this page includes the FDIC national average for context. To track Ally's current rate, use Manual Entry or update the URL to a JSON API endpoint if you discover one.",
    selectors: {
      mode: "html",
      savings: [
        { selector: "p, span, div", label: "National Avg Savings APY (FDIC)", regex: "(\\d+\\.?\\d*)\\s*%\\s*APY" },
      ],
    },
  },
];
