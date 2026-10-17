import { useSyncExternalStore } from 'react';
import {
  onChildAdded, onChildChanged, onChildRemoved, onValue, ref, remove, set, update, type Unsubscribe,
} from 'firebase/database';
import { get as idbGet, set as idbSet } from 'idb-keyval';
import type { DataUzivatele, Dluh, Kategorie, Penezenka, Tx } from '@ff/core';
import { cesta, db } from '../firebase';
import { FrontaZapisu, type Operace } from './fronta-zapisu';

/**
 * Živá data uživatele – jeden sklad pro celou appku.
 *
 * - Transakce se odebírají PO JEDNÉ (onChildAdded/Changed/Removed), stejně jako web.
 *   Změna jedné transakce nepřekreslí nic jiného než to, co ji čte.
 * - Při startu se hned ukáže poslední snímek ze zařízení (i bez internetu),
 *   pak ho nahradí živá data.
 * - Zápisy jdou přes frontu v zařízení (fronta-zapisu.ts) – nic se neztratí.
 */

export interface StavSkladu {
  uid: string | null;
  /** Data už jednou dorazila ze serveru (ne jen ze snímku). */
  nacteno: boolean;
  pripojeno: boolean;
  /** Zápisy, které server ještě nepotvrdil. */
  cekajici: number;
  data: DataUzivatele;
}

const PRAZDNA: DataUzivatele = { transactions: [], categories: [], wallets: [], bank: { startBalance: 0 }, debts: [] };

let stav: StavSkladu = { uid: null, nacteno: false, pripojeno: false, cekajici: 0, data: PRAZDNA };
const posluchaci = new Set<() => void>();
let odhlaseni: Unsubscribe[] = [];
let fronta: FrontaZapisu | null = null;

// Transakce v mapě podle id; pole se postaví jen jednou za dávku změn.
let txMapa = new Map<string, Tx>();
let ostatni: Omit<DataUzivatele, 'transactions'> = { categories: [], wallets: [], bank: { startBalance: 0 }, debts: [] };
let naplanovano = false;
let snimekCasovac: ReturnType<typeof setTimeout> | null = null;

function oznam() {
  if (naplanovano) return;
  naplanovano = true;
  // Při připojení přijdou tisíce transakcí jednotlivě – překreslit jednou za snímek.
  queueMicrotask(() => {
    naplanovano = false;
    stav = { ...stav, data: { ...ostatni, transactions: [...txMapa.values()] } };
    posluchaci.forEach(f => f());
    naplanujSnimek();
  });
}

function zmenStav(z: Partial<StavSkladu>) {
  stav = { ...stav, ...z };
  posluchaci.forEach(f => f());
}

function pole<T>(v: unknown): T[] {
  if (Array.isArray(v)) return v.filter(Boolean) as T[];
  if (v && typeof v === 'object') return Object.values(v).filter(Boolean) as T[];
  return [];
}

const klicSnimku = (uid: string) => `snimek:${uid}`;
const klicFronty = (uid: string) => `fronta:${uid}`;

function naplanujSnimek() {
  const uid = stav.uid;
  if (!uid || !stav.nacteno) return;
  if (snimekCasovac) clearTimeout(snimekCasovac);
  snimekCasovac = setTimeout(() => {
    void idbSet(klicSnimku(uid), { ...stav.data, cas: Date.now() }).catch(() => {});
  }, 3000);
}

/** Připojí sklad k datům přihlášeného uživatele. */
export async function pripojit(uid: string): Promise<void> {
  odpojit();
  stav = { uid, nacteno: false, pripojeno: false, cekajici: 0, data: PRAZDNA };

  // 1) fronta zápisů – hned, ať jde zapisovat i během načítání
  fronta = new FrontaZapisu(
    { nacist: async () => (await idbGet<Operace[]>(klicFronty(uid))) ?? [], ulozit: ops => idbSet(klicFronty(uid), ops) },
    provest,
  );
  odhlaseni.push(fronta.sleduj(n => zmenStav({ cekajici: n })));
  void fronta.prehrat();

  // 2) okamžitě snímek ze zařízení
  try {
    const s = await idbGet<DataUzivatele>(klicSnimku(uid));
    if (s && stav.uid === uid && !stav.nacteno) {
      txMapa = new Map(pole<Tx>(s.transactions).map(t => [String(t.id), t]));
      ostatni = { categories: pole(s.categories), wallets: pole(s.wallets), bank: s.bank ?? { startBalance: 0 }, debts: pole(s.debts) };
      oznam();
    }
  } catch { /* bez snímku */ }

  // 3) živá data
  const txRef = ref(db, cesta(uid, 'transactions'));
  const zivaMapa = new Map<string, Tx>();
  let prvni = true;
  const prijmi = (klic: string | null, t: Tx | null) => {
    if (!klic) return;
    if (t) zivaMapa.set(klic, { ...t, id: t.id ?? klic }); else zivaMapa.delete(klic);
    if (prvni) {
      // Ještě se čeká na úplný seznam ze serveru – ukazuje se snímek. Změnu promítnout i do něj,
      // ať je vidět např. transakce zapsaná bez internetu.
      if (txMapa === zivaMapa) return;
      if (t) txMapa.set(klic, { ...t, id: t.id ?? klic }); else txMapa.delete(klic);
    } else txMapa = zivaMapa;
    oznam();
  };
  odhlaseni.push(
    onChildAdded(txRef, s => prijmi(s.key, s.val() as Tx)),
    onChildChanged(txRef, s => prijmi(s.key, s.val() as Tx)),
    onChildRemoved(txRef, s => prijmi(s.key, null)),
    // onValue se spustí až po všech počátečních onChildAdded → tehdy je seznam úplný.
    onValue(txRef, () => {
      if (prvni) { prvni = false; txMapa = zivaMapa; stav = { ...stav, nacteno: true }; oznam(); }
    }, { onlyOnce: true }),
    onValue(ref(db, cesta(uid, 'categories')), s => { ostatni = { ...ostatni, categories: pole<Kategorie>(s.val()) }; oznam(); }),
    onValue(ref(db, cesta(uid, 'wallets')), s => { ostatni = { ...ostatni, wallets: pole<Penezenka>(s.val()) }; oznam(); }),
    onValue(ref(db, cesta(uid, 'bank')), s => { ostatni = { ...ostatni, bank: (s.val() as { startBalance?: number }) ?? { startBalance: 0 } }; oznam(); }),
    onValue(ref(db, cesta(uid, 'debts')), s => { ostatni = { ...ostatni, debts: pole<Dluh>(s.val()) }; oznam(); }),
    onValue(ref(db, '.info/connected'), s => zmenStav({ pripojeno: s.val() === true })),
  );
}

export function odpojit() {
  odhlaseni.forEach(o => o());
  odhlaseni = [];
  fronta = null;
  txMapa = new Map();
  ostatni = { categories: [], wallets: [], bank: { startBalance: 0 }, debts: [] };
  stav = { uid: null, nacteno: false, pripojeno: false, cekajici: 0, data: PRAZDNA };
  posluchaci.forEach(f => f());
}

async function provest(op: Operace): Promise<void> {
  const r = ref(db, op.cesta);
  if (op.typ === 'set') await set(r, op.hodnota);
  else if (op.typ === 'update') await update(r, op.hodnota as Record<string, unknown>);
  else await remove(r);
}

function cestaTx(id: number | string): string {
  if (!stav.uid) throw new Error('Nepřihlášen');
  return cesta(stav.uid, `transactions/${id}`);
}

/** Id ve tvaru webu (genTxId): čas v ms × 16 + náhoda 0–15. */
export function noveIdTx(): number {
  return Date.now() * 16 + Math.floor(Math.random() * 16);
}

/**
 * Změna se promítne do skladu hned (i bez internetu, kdy Firebase o datech
 * ze snímku neví a vlastní událost nevyvolá). Server ji pak potvrdí stejnou hodnotou.
 */
function promitnout(id: number | string, fn: (t: Tx | undefined) => Tx | null) {
  const klic = String(id);
  const nova = fn(txMapa.get(klic));
  txMapa = new Map(txMapa);
  if (nova) txMapa.set(klic, nova); else txMapa.delete(klic);
  oznam();
}

/** Nová transakce – zapíše se jen její cesta, nic jiného. */
export async function pridatTransakci(tx: Tx): Promise<void> {
  if (!fronta) throw new Error('Nepřihlášen');
  promitnout(tx.id, () => tx);
  await fronta.pridat({ typ: 'set', cesta: cestaTx(tx.id), hodnota: tx });
}

/**
 * Úprava transakce – zapíší se JEN změněná pole. Pole, která appka nezná
 * (položky účtenky, štítky, rozdělení…), zůstanou netknutá.
 * Hodnota `null` pole smaže.
 */
export async function upravitTransakci(id: number | string, zmeny: Record<string, unknown>): Promise<void> {
  if (!fronta) throw new Error('Nepřihlášen');
  if (!Object.keys(zmeny).length) return;
  promitnout(id, t => {
    if (!t) return null;
    const n: Tx = { ...t };
    for (const [k, v] of Object.entries(zmeny)) { if (v === null) delete n[k]; else n[k] = v; }
    return n;
  });
  await fronta.pridat({ typ: 'update', cesta: cestaTx(id), hodnota: zmeny });
}

/** Smazání. Vrací původní transakci – „Zpět“ ji zapíše znovu celou. */
export async function smazatTransakci(id: number | string): Promise<Tx | null> {
  if (!fronta) throw new Error('Nepřihlášen');
  const puvodni = txMapa.get(String(id)) ?? null;
  promitnout(id, () => null);
  await fronta.pridat({ typ: 'remove', cesta: cestaTx(id) });
  return puvodni;
}

export function useSklad(): StavSkladu {
  return useSyncExternalStore(
    f => { posluchaci.add(f); return () => posluchaci.delete(f); },
    () => stav,
  );
}

/** Jen pro testy a náhled: naplní sklad daty bez Firebase. */
export function naplnitProNahled(data: DataUzivatele, uid = 'nahled') {
  const pamet: Operace[] = [];
  fronta = new FrontaZapisu({ nacist: async () => pamet, ulozit: async () => {} }, async () => {});
  txMapa = new Map(data.transactions.map(t => [String(t.id), t]));
  ostatni = { categories: data.categories, wallets: data.wallets, bank: data.bank ?? { startBalance: 0 }, debts: data.debts ?? [] };
  stav = { ...stav, uid, nacteno: true, pripojeno: true };
  oznam();
}
