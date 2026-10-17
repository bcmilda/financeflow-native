/**
 * Převod částky z textu notifikace na číslo.
 *
 * Banky píšou částky různě: `1 022,40` (CZ, mezera i nezlomitelná mezera),
 * `1.022,40` (DE), `1,022.40` (EN), `-250`. Vrací kladné číslo nebo NaN.
 */
export function parseCastka(vstup: string): number {
  let s = vstup.replace(/[\s   ']/g, '').replace(/^[+−-]/, '');
  if (!/^\d[\d.,]*$/.test(s)) return NaN;

  const posledniCarka = s.lastIndexOf(',');
  const posledniTecka = s.lastIndexOf('.');
  if (posledniCarka >= 0 && posledniTecka >= 0) {
    // Oddělovač desetin je ten, který je víc vpravo.
    if (posledniCarka > posledniTecka) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (posledniCarka >= 0) {
    // Jen čárka: desetinná, pokud za ní jsou 1–2 číslice. `1,022` (3 číslice) = tisíce.
    s = /,\d{1,2}$/.test(s) ? s.replace(/,(?=\d{1,2}$)/, '.').replace(/,/g, '') : s.replace(/,/g, '');
  } else if (posledniTecka >= 0) {
    s = /\.\d{1,2}$/.test(s) ? s.replace(/\.(?=\d{1,2}$)/, 'X').replace(/\./g, '').replace('X', '.') : s.replace(/\./g, '');
  }
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
}

const MENY: Record<string, string> = {
  'kč': 'CZK', 'czk': 'CZK', 'kc': 'CZK',
  '€': 'EUR', 'eur': 'EUR',
  '$': 'USD', 'usd': 'USD',
  '£': 'GBP', 'gbp': 'GBP',
  'zł': 'PLN', 'zl': 'PLN', 'pln': 'PLN',
  'грн': 'UAH', 'uah': 'UAH',
  'chf': 'CHF',
};

export function normMena(vstup: string | undefined): string {
  if (!vstup) return 'CZK';
  return MENY[vstup.trim().toLowerCase()] ?? vstup.trim().toUpperCase();
}

/** Regex skupina pro měnu – sdílená všemi bankami. */
export const RE_MENA = '(Kč|CZK|EUR|€|USD|\\$|GBP|£|PLN|zł|CHF|UAH)';
/** Regex skupina pro částku (číslice, mezery, tečky, čárky). */
export const RE_CASTKA = '(\\d[\\d\\s\\u00a0\\u202f.,]*\\d|\\d)';
