/**
 * Flexible Date Utilities for Family Tree
 * Supports partial dates (year only: "1947") as well as full dates ("1947-06-15" or "15/06/1947").
 */

export function normalizeDateInput(val: string | null | undefined): string | null {
  if (!val) return null;
  const trimmed = val.trim();
  if (!trimmed) return null;

  // 1. Year only: "1947"
  if (/^\d{4}$/.test(trimmed)) {
    return trimmed;
  }

  // 2. Standard ISO YYYY-MM-DD: "1947-06-15"
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  // 3. DD-MM-YYYY or DD/MM/YYYY: "15-06-1947" or "15/06/1947"
  const dmyMatch = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(trimmed);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }

  // 4. YYYY/MM/DD
  const ymdMatch = /^(\d{4})[/](\d{1,2})[/](\d{1,2})$/.exec(trimmed);
  if (ymdMatch) {
    const year = ymdMatch[1];
    const month = ymdMatch[2].padStart(2, '0');
    const day = ymdMatch[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // 5. If it contains a 4-digit year, extract year
  const yearMatch = /\b(18\d{2}|19\d{2}|20\d{2})\b/.exec(trimmed);
  if (yearMatch) {
    return yearMatch[1];
  }

  return trimmed;
}

export function formatDateDisplay(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const trimmed = dateStr.trim();
  if (!trimmed) return '';

  // If year only, return year
  if (/^\d{4}$/.test(trimmed)) {
    return trimmed;
  }

  return trimmed;
}
