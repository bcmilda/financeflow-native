import { parseCastka, type Kategorie, type Penezenka, type Tx } from '@ff/core';

/** Stav formuláře transakce (texty tak, jak je uživatel píše). */
export interface HodnotyFormulare {
  typ: 'expense' | 'income';
  castka: string;
  nazev: string;
  catId: string;
  subcat: string;
  datum: string;
  wallet: string;
  poznamka: string;
}

export type ChybaFormulare = 'castka' | 'nazev' | 'datum' | null;

export function prazdnyFormular(datum: string, wallet = ''): HodnotyFormulare {
  return { typ: 'expense', castka: '', nazev: '', catId: '', subcat: '', datum, wallet, poznamka: '' };
}

/** Částka pro zobrazení ve formuláři: desetinná čárka, bez zbytečných nul. */
export function castkaDoPole(n: number, desetinnyOddelovac = ','): string {
  if (!Number.isFinite(n) || n === 0) return '';
  // Celé částky bez haléřů (250), ostatní vždy na dvě místa (145,40 – ne 145,4).
  const r = Math.round(n * 100) / 100;
  return (Number.isInteger(r) ? String(r) : r.toFixed(2)).replace('.', desetinnyOddelovac);
}

export function zTransakce(tx: Tx): HodnotyFormulare {
  return {
    typ: tx.type === 'income' ? 'income' : 'expense',
    castka: castkaDoPole(Number(tx.amount || tx.amt || 0)),
    nazev: tx.name ?? '',
    catId: tx.catId ?? tx.category ?? '',
    subcat: tx.subcat ?? '',
    datum: String(tx.date ?? '').slice(0, 10),
    wallet: tx.wallet ?? '',
    poznamka: tx.note ?? '',
  };
}

/** Kategorie nabízené pro typ: výdaj → expense/both/transfer, příjem → income/both/transfer. */
export function kategorieProTyp(kategorie: Kategorie[], typ: 'expense' | 'income'): Kategorie[] {
  return kategorie.filter(c => c && !c.archived && (c.type === typ || c.type === 'both' || c.type === 'transfer' || !c.type));
}

export function validovat(h: HodnotyFormulare, kategorie: Kategorie[]): ChybaFormulare {
  const c = parseCastka(h.castka);
  if (!Number.isFinite(c) || c <= 0) return 'castka';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(h.datum)) return 'datum';
  if (!h.nazev.trim() && !kategorie.some(k => k.id === h.catId)) return 'nazev';
  return null;
}

/** Název transakce: vyplněný, jinak název kategorie (web transakci bez názvu nezná). */
function nazevTx(h: HodnotyFormulare, kategorie: Kategorie[]): string {
  return h.nazev.trim() || kategorie.find(k => k.id === h.catId)?.name || '';
}

/** Nová transakce ve tvaru webu. */
export function novaTransakce(h: HodnotyFormulare, kategorie: Kategorie[], penezenky: Penezenka[], id: number, ted: number): Tx {
  const castka = parseCastka(h.castka);
  const mena = penezenky.find(w => w.id === h.wallet)?.currency;
  return {
    id,
    type: h.typ,
    name: nazevTx(h, kategorie),
    amount: castka,
    amt: castka,
    catId: h.catId,
    category: h.catId,
    ...(h.subcat ? { subcat: h.subcat } : {}),
    date: h.datum,
    ...(h.wallet ? { wallet: h.wallet } : {}),
    // Cizí měna: web pak dopočítá Kč kurzem (amtCZK se bez kurzu nezapisuje).
    ...(mena && mena !== 'CZK' ? { currency: mena } : {}),
    note: h.poznamka.trim(),
    createdAt: ted,
  };
}

/**
 * Jen změněná pole – zbytek transakce (položky účtenky, štítky, rozdělení,
 * pole, která zná jen web) zůstane netknutý. `null` = pole smazat.
 */
export function zmenyTransakce(puvodni: Tx, h: HodnotyFormulare, kategorie: Kategorie[], penezenky: Penezenka[]): Record<string, unknown> {
  const z: Record<string, unknown> = {};
  const p = zTransakce(puvodni);
  const castka = parseCastka(h.castka);

  if (h.typ !== p.typ) z.type = h.typ;
  const nazev = nazevTx(h, kategorie);
  if (nazev !== (puvodni.name ?? '')) z.name = nazev;
  if (Math.abs(castka - Number(puvodni.amount || puvodni.amt || 0)) > 0.0001) { z.amount = castka; z.amt = castka; }
  if (h.catId !== p.catId) { z.catId = h.catId; z.category = h.catId; }
  if (h.subcat !== p.subcat) z.subcat = h.subcat || null;
  if (h.datum !== p.datum) z.date = h.datum;
  if (h.wallet !== p.wallet) {
    z.wallet = h.wallet || null;
    const mena = penezenky.find(w => w.id === h.wallet)?.currency;
    z.currency = mena && mena !== 'CZK' ? mena : null;
  }
  if (h.poznamka.trim() !== (puvodni.note ?? '')) z.note = h.poznamka.trim();
  // Zafixovaná částka v Kč by po změně částky nebo peněženky lhala – smazat, web ji dopočítá.
  if (puvodni.amtCZK != null && ('amount' in z || 'wallet' in z)) z.amtCZK = null;
  return z;
}
