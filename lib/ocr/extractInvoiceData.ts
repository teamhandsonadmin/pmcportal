import Tesseract from 'tesseract.js';

// All fields are best-effort OCR guesses — never auto-committed. The review UI
// must surface these as unverified and require explicit user confirmation.
export interface ExtractedInvoiceLine {
  rawText: string;
  itemNameGuess?: string;
  quantityGuess?: number;
  unitGuess?: string;
  unitCostGuess?: number;
}

export interface ExtractedInvoiceData {
  supplierGuess?: string;
  dateGuess?: string;
  lines: ExtractedInvoiceLine[];
}

const QTY_AT_PRICE = /(\d+(?:\.\d+)?)\s*(?:x|X|pcs?|units?)?\s*(.+?)\s*@\s*[₹$]?\s*(\d+(?:\.\d+)?)/;
const DATE_LIKE = /\b\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}\b/;
const MONTH_DATE_LIKE = /\b\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{2,4}\b/i;
const NUMBER_TOKEN = /-?\(?\$?₹?\d[\d,]*(?:\.\d+)?\)?%?/g;
// A "price-like" number has a decimal (money) or a currency prefix — unlike a
// bare integer, which is just as likely to be a zip code, street number, or
// invoice ID as an actual quantity/amount.
const PRICE_LIKE_NUMBER = /[$₹]\s?\d[\d,]*(?:\.\d{1,2})?|\d[\d,]*\.\d{1,2}\b/;

// Lines containing any of these are structural boilerplate (headers, totals,
// addresses, terms) — never real purchasable line items, even when they
// happen to contain numbers (e.g. "Discount(6.00%)  (-)388.80").
const NOISE_KEYWORDS = [
  'invoice', 'bill to', 'ship to', 'invoice date', 'invoice#', 'invoice no',
  'due date', 'terms', 'p.o.', 'purchase order',
  'sub total', 'subtotal', 'discount', 'shipping charge', 'shipping',
  'balance due', 'grand total', 'total', 'tax%', 'amount due',
  'thanks for your business', 'terms & conditions', 'terms and conditions',
  'notes:', 'description', 'qty', 'rate', 'item &',
];

function isNoiseLine(line: string): boolean {
  const lower = line.toLowerCase();
  if (NOISE_KEYWORDS.some((kw) => lower.includes(kw))) return true;
  if (MONTH_DATE_LIKE.test(line) || DATE_LIKE.test(line)) return true;
  if (line.trim().length < 3) return true; // stray row-index digits, OCR noise chars
  // Require at least one money-shaped number (decimal or currency-prefixed) —
  // this is what separates a real item/amount row from an address, zip code,
  // invoice ID, or other plain-digit noise that isn't actually a line item.
  if (!PRICE_LIKE_NUMBER.test(line)) return true;
  return false;
}

function parseLineHeuristic(line: string): ExtractedInvoiceLine | null {
  if (isNoiseLine(line)) return null;

  const qtyAtPrice = line.match(QTY_AT_PRICE);
  if (qtyAtPrice) {
    return {
      rawText: line,
      itemNameGuess: qtyAtPrice[2].trim(),
      quantityGuess: Number(qtyAtPrice[1]),
      unitCostGuess: Number(qtyAtPrice[3]),
    };
  }

  const numbers = line.match(NUMBER_TOKEN) ?? [];
  // A genuine item row on a real invoice table carries at least two numbers
  // (e.g. qty + rate, or rate + amount) — a bare line of prose won't.
  if (numbers.length < 2) {
    // Still surface it (better to over-show than silently drop a real item),
    // but with no numeric guesses rather than fabricating zeros.
    const name = line.trim();
    return name ? { rawText: line, itemNameGuess: name } : null;
  }

  const parsedNumbers = numbers.map((n) => Number(n.replace(/[^0-9.]/g, '')));
  const lastNumber = parsedNumbers[parsedNumbers.length - 1];
  // The leading number is only trusted as a quantity if it's both small (a
  // piece count, not a rupee amount) and actually leads the line — otherwise
  // leave it undefined rather than guess wrong (the UI defaults blank qty to 1).
  const firstNumber = parsedNumbers[0];
  const quantityGuess = firstNumber < 1000 && line.trim().startsWith(numbers[0] ?? '') ? firstNumber : undefined;

  const itemNameGuess = line.replace(NUMBER_TOKEN, '').replace(/\s{2,}/g, ' ').trim() || undefined;

  return {
    rawText: line,
    itemNameGuess,
    quantityGuess,
    unitCostGuess: lastNumber,
  };
}

function guessSupplierAndDate(lines: string[]): { supplierGuess?: string; dateGuess?: string } {
  const dateLine = lines.find((l) => DATE_LIKE.test(l) || MONTH_DATE_LIKE.test(l));
  const dateMatch = dateLine?.match(DATE_LIKE) ?? dateLine?.match(MONTH_DATE_LIKE);
  // The first non-empty, non-date line is a weak guess at a supplier/letterhead name.
  const supplierLine = lines.find((l) => l.length > 2 && !DATE_LIKE.test(l) && !MONTH_DATE_LIKE.test(l));
  return {
    supplierGuess: supplierLine,
    dateGuess: dateMatch?.[0],
  };
}

export async function extractInvoiceData(imageBuffer: Buffer): Promise<ExtractedInvoiceData> {
  const { data } = await Tesseract.recognize(imageBuffer, 'eng');
  const rawLines = data.text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const lines = rawLines
    .map(parseLineHeuristic)
    .filter((l): l is ExtractedInvoiceLine => l !== null);
  const { supplierGuess, dateGuess } = guessSupplierAndDate(rawLines);

  return { supplierGuess, dateGuess, lines };
}
