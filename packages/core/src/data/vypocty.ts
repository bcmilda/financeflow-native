import type { DataUzivatele, Kurzy, Penezenka, Tx } from './typy';

/**
 * Výpočty přenesené z webu (bcmilda/financeflow @ v11.77, js/helpers.js a js/premium.js).
 * Musí dávat STEJNÁ čísla jako web – hlídá to tools/kontrakt-web.mjs, který pouští
 * stejná data přes kód webu i přes tento modul.
 */

export function castka(t: Tx): number {
  return Number(t.amount || t.amt || 0);
}

/** 'YYYY-MM' z data transakce. Web: new Date(t.date).getMonth() – u 'YYYY-MM-DD' totéž. */
export function mesicTx(t: Tx): string {
  return String(t.date ?? '').slice(0, 7);
}

export function klicMesice(rok: number, mesic: number): string {
  return `${rok}-${String(mesic + 1).padStart(2, '0')}`;
}

/** Id kategorií typu „transfer“ (Přesuny – spoření, investice). Web: rebuildTransferCatIds. */
export function idPresunovychKategorii(D: Pick<DataUzivatele, 'categories'>): Set<string> {
  return new Set((D.categories ?? []).filter(c => c && c.type === 'transfer').map(c => c.id));
}

/** Přesun není příjem ani výdaj, jen pohyb majetku. Web: isTransferTx. */
export function jePresun(t: Tx, presunove: Set<string>): boolean {
  return !!(t && (t.transferId || t.catId === 'transfer' || t.category === 'transfer' || presunove.has(String(t.catId || t.category || ''))));
}

/**
 * Částka v CZK. Web: txCZK.
 * 1) zafixovaná `amtCZK`, 2) peněženka v CZK nebo bez peněženky → částka,
 * 3) cizí peněženka → přepočet kurzem; bez kurzu 1:1 (stejně jako web bez kurzů).
 */
export function vCZK(t: Tx, penezenky: Penezenka[], kurzy: Kurzy = {}): number {
  if (t.amtCZK != null && Number.isFinite(t.amtCZK)) return t.amtCZK;
  const a = castka(t);
  if (!t.wallet) return a;
  const w = penezenky.find(x => x.id === t.wallet);
  const mena = w?.currency || 'CZK';
  if (mena === 'CZK') return a;
  const k = kurzy[mena];
  return k && Number.isFinite(k) && k > 0 ? a * k : a;
}

export interface Kontext {
  penezenky: Penezenka[];
  presunove: Set<string>;
  kurzy?: Kurzy;
}

export function kontext(D: DataUzivatele, kurzy: Kurzy = {}): Kontext {
  return { penezenky: D.wallets ?? [], presunove: idPresunovychKategorii(D), kurzy };
}

function jePrijemVydaj(t: Tx, typ: 'income' | 'expense', k: Kontext): boolean {
  return t.type === typ && !t.isBalancing && !t.splitParent && !jePresun(t, k.presunove);
}

/** Web: incSum. */
export function prijmy(txs: Tx[], k: Kontext): number {
  return txs.filter(t => jePrijemVydaj(t, 'income', k)).reduce((s, t) => s + vCZK(t, k.penezenky, k.kurzy), 0);
}

/** Web: expSum. */
export function vydaje(txs: Tx[], k: Kontext): number {
  return txs.filter(t => jePrijemVydaj(t, 'expense', k)).reduce((s, t) => s + vCZK(t, k.penezenky, k.kurzy), 0);
}

export function transakceMesice(D: DataUzivatele, rok: number, mesic: number): Tx[] {
  const klic = klicMesice(rok, mesic);
  return (D.transactions ?? []).filter(t => mesicTx(t) === klic);
}

/**
 * Výdaje (nebo příjmy) jedné kategorie v měsíci. Web: getActual.
 * Rozdělený rodič se nepočítá, jen když má děti. Přesuny se nepočítají – kromě
 * případu, kdy se ptáme přímo na přesunovou kategorii (spoření, investice).
 */
export function skutecnost(D: DataUzivatele, catId: string, rok: number, mesic: number, k: Kontext, typ: 'expense' | 'income' = 'expense', sub?: string): number {
  const txs = D.transactions ?? [];
  const rodiceSDetmi = new Set(
    txs.filter(t => t.splitId && t.splitParent).map(t => t.splitId as string)
      .filter(sid => txs.some(c => c.splitId === sid && !c.splitParent)),
  );
  const ptameSeNaPresun = k.presunove.has(catId);
  const klic = klicMesice(rok, mesic);
  return txs
    .filter(t => t.type === typ && !t.isBalancing && t.catId === catId && (!sub || t.subcat === sub))
    .filter(t => ptameSeNaPresun || !jePresun(t, k.presunove))
    .filter(t => mesicTx(t) === klic)
    .filter(t => !(t.splitId && t.splitParent && rodiceSDetmi.has(t.splitId)))
    .reduce((s, t) => s + vCZK(t, k.penezenky, k.kurzy), 0);
}

/** Zůstatek „banky“: počáteční stav + saldo všech měsíců do zvoleného včetně. Web: computeBank. */
export function zustatekCelkem(D: DataUzivatele, rok: number, mesic: number, k: Kontext): number {
  const do_ = klicMesice(rok, mesic);
  const txs = (D.transactions ?? []).filter(t => mesicTx(t) !== '' && mesicTx(t) <= do_);
  return (D.bank?.startBalance || 0) + prijmy(txs, k) - vydaje(txs, k);
}

export interface SouhrnMesice {
  prijmy: number;
  vydaje: number;
  bilance: number;
  minulePrijmy: number;
  minuleVydaje: number;
  /** Změna výdajů proti minulému měsíci v %, null když minulý měsíc nic nebylo. */
  zmenaVydaju: number | null;
  zustatek: number;
  dluhy: number;
  pocetTransakci: number;
}

/** Souhrnné karty Dashboardu. Web: renderSummaryCards. */
export function souhrnMesice(D: DataUzivatele, rok: number, mesic: number, kurzy: Kurzy = {}): SouhrnMesice {
  const k = kontext(D, kurzy);
  const txs = transakceMesice(D, rok, mesic);
  const pm = mesic === 0 ? 11 : mesic - 1;
  const py = mesic === 0 ? rok - 1 : rok;
  const minule = transakceMesice(D, py, pm);
  const p = prijmy(txs, k), v = vydaje(txs, k);
  const mv = vydaje(minule, k);
  return {
    prijmy: p, vydaje: v, bilance: p - v,
    minulePrijmy: prijmy(minule, k), minuleVydaje: mv,
    zmenaVydaju: mv > 0 ? Math.round(((v - mv) / mv) * 100) : null,
    zustatek: zustatekCelkem(D, rok, mesic, k),
    dluhy: (D.debts ?? []).reduce((s, d) => s + (Number(d?.remaining) || 0), 0),
    pocetTransakci: txs.length,
  };
}

export interface PolozkaKategorie { catId: string; celkem: number }

/**
 * Výdaje po kategoriích v měsíci, sestupně. Web: renderDashTreemap.
 * Výdaje bez známé kategorie jdou do položky s catId '' (web: „Ostatní“).
 *
 * Vyladění proti webu: web do „Ostatní“ počítá i přesuny a rozdělené rodiče,
 * takže součet dlaždic může být vyšší než celkové výdaje. Tady platí stejná
 * pravidla jako pro celkové výdaje – součet sedí na kartu Výdaje.
 */
export function vydajePodleKategorii(D: DataUzivatele, rok: number, mesic: number, kurzy: Kurzy = {}): PolozkaKategorie[] {
  const k = kontext(D, kurzy);
  const vydajove = (D.categories ?? []).filter(c => c && (c.type === 'expense' || c.type === 'both'));
  const out = vydajove.map(c => ({ catId: c.id, celkem: skutecnost(D, c.id, rok, mesic, k) })).filter(x => x.celkem > 0);
  const zname = new Set(vydajove.map(c => c.id));
  const bez = transakceMesice(D, rok, mesic)
    .filter(t => jePrijemVydaj(t, 'expense', k) && !zname.has(String(t.catId ?? '')) && !zname.has(String(t.category ?? '')))
    .reduce((s, t) => s + vCZK(t, k.penezenky, k.kurzy), 0);
  if (bez > 0) out.push({ catId: '', celkem: bez });
  return out.sort((a, b) => b.celkem - a.celkem);
}

// ── Peněženky (web: premium.js computeWalletBalance) ──

/** Čas vzniku transakce: createdAt, nebo z id (genTxId = ms*16, uid() = 'id' + ms). */
export function casVzniku(t: Tx): number | null {
  if (typeof t.createdAt === 'number') return t.createdAt;
  if (typeof t.id === 'number' && t.id > 1e13) {
    const ms = Math.floor(t.id / 16);
    if (ms > 1.5e12 && ms < 4.2e12) return ms;
  }
  const m = /^id(\d{13})/.exec(String(t.id ?? ''));
  return m ? Number(m[1]) : null;
}

/** true = transakce v zadaném zůstatku peněženky NENÍ (přičte se k němu). */
function poStavu(t: Tx, w: Penezenka | undefined): boolean {
  if (!w || !w.balanceDate) return true;
  const d = String(t.date ?? '').slice(0, 10);
  if (d > w.balanceDate) return true;
  if (d < w.balanceDate) return false;
  if (t.src === 'import') return false;
  const c = casVzniku(t);
  return !!(c && w.balanceSetAt && c > w.balanceSetAt);
}

function znamenko(t: Tx): number {
  return t.type === 'income' ? (t.amount || 0) : t.type === 'expense' ? -(t.amount || 0) : 0;
}

/** Zůstatek peněženky v její měně. */
export function zustatekPenezenky(walletId: string, D: Pick<DataUzivatele, 'wallets' | 'transactions'>): number {
  const w = (D.wallets ?? []).find(x => x.id === walletId);
  return (w?.balance || 0) + (D.transactions ?? [])
    .filter(t => t.wallet === walletId)
    .reduce((s, t) => s + (poStavu(t, w) ? znamenko(t) : 0), 0);
}
