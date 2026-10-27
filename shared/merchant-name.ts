/** Merchant matching key only: never use this to change source descriptions or reliable IDs. */
export function cleanMerchantName(value: string): string {
  return value.normalize("NFKC").trim()
    .replace(/^(?:(?:sq|tst|paypal|stripe|venmo|cashapp)\s*(?:\*+\s*|\s+))+/i, "")
    .replace(/\b(?:store|ref(?:erence)?)\s*#?\s*[0-9][a-z0-9-]*\b/gi, " ")
    .replace(/#\s*[a-z0-9-]+\b/gi, " ")
    .replace(/\b\d{4}[-/]\d{1,2}[-/]\d{1,2}\b|\b\d{1,2}[-/]\d{1,2}[-/](?:\d{4}|\d{2})\b/g, " ")
    .replace(/(?:\+?1[-.\s]?)?(?:\(\d{3}\)[-.\s]?|\b\d{3}[-.\s])\d{3}[-.\s]?\d{4}\b|\b(?:1)?\d{10}\b/g, " ")
    .replace(/[\s,]+(?:AL|AK|AZ|AR|CA|CO|CT|DE|DC|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)(?:\s+\d{5}(?:-\d{4})?)?\s*$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
