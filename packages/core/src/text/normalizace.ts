/** Malá písmena bez diakritiky – pro porovnávání názvů (Penny ≈ PENNY ≈ penny). */
export function bezDiakritiky(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}
