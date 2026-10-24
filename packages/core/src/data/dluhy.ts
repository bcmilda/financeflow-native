import { vCZK, type Kontext } from './vypocty';
import type { DataUzivatele, Dluh, SplatkaPlanu, Tx } from './typy';

/**
 * Půjčky – výpočty z webu (helpers.js computeMonthlyDebtPayments @ v12.01,
 * debts.js computeDebtPaid @ v12.02, transactions.js renderDebts).
 */

/** Půjčka je splacená / uzavřená (zbývá 0). Web v12.01: taková už nemá splátku. */
export function jeSplacena(d: Dluh): boolean {
  return d.remaining != null && !(d.remaining > 0);
}

/** Měsíční splátka jedné půjčky v měsíci 'YYYY-MM' (týdenní × 4,33, dvoutýdenní × 2,17). */
export function mesicniSplatka(d: Dluh, mesic: string): number {
  if (jeSplacena(d)) return 0;
  if (Array.isArray(d.installments) && d.installments.length) {
    let cur = d.installments[0]?.amt || 0;
    for (const i of d.installments) if ((i.from || '') <= mesic) cur = i.amt || cur;
    return cur;
  }
  const zaklad = d.payment || d.installment || 0;
  const f = d.freq || 'monthly';
  return f === 'weekly' ? zaklad * 4.33 : f === 'biweekly' ? zaklad * 2.17 : zaklad;
}

/** Součet měsíčních splátek všech půjček. Web: computeMonthlyDebtPayments. */
export function mesicniSplatky(D: Pick<DataUzivatele, 'debts'>, rok: number, mesic: number): number {
  const m = `${rok}-${String(mesic + 1).padStart(2, '0')}`;
  return (D.debts ?? []).reduce((s, d) => s + (d ? mesicniSplatka(d, m) : 0), 0);
}

export function zbyvaCelkem(D: Pick<DataUzivatele, 'debts'>): number {
  return (D.debts ?? []).reduce((s, d) => s + (Number(d?.remaining) || 0), 0);
}

/**
 * Kolik se na půjčku zaplatilo transakcemi v appce (splátky s `debtId`).
 * Web: computeDebtPaid – bez rozdělených rodičů a bez splátek založených dopředu (`debtCeka`).
 * Rozdělení na jistinu a úrok zatím ne (potřebuje plný splátkový plán).
 */
export function zaplacenoNaDluh(d: Dluh, D: DataUzivatele, k: Kontext): { soucet: number; pocet: number; transakce: Tx[] } {
  const txs = (D.transactions ?? [])
    .filter(t => t.debtId === d.id && !t.splitParent && !t.debtCeka)
    .sort((a, b) => String(a.date ?? '').localeCompare(String(b.date ?? '')));
  return { soucet: txs.reduce((s, t) => s + vCZK(t, k.penezenky, k.kurzy), 0), pocet: txs.length, transakce: txs };
}

export function pristiSplatka(d: Dluh): SplatkaPlanu | null {
  return (d.schedule ?? []).find(s => s && !s.paid) ?? null;
}

/** Nezaplacené splátky plánu s datem před dneškem. */
export function poSplatnosti(d: Dluh, dnes: string): number {
  return (d.schedule ?? []).filter(s => s && !s.paid && String(s.date ?? '') < dnes).length;
}

/** Podíl splaceného z půjčené částky (0–1), null bez údaje o celkové částce. */
export function podilSplaceno(d: Dluh): number | null {
  if (!(Number(d.total) > 0)) return null;
  return Math.min(1, Math.max(0, 1 - (Number(d.remaining) || 0) / Number(d.total)));
}
