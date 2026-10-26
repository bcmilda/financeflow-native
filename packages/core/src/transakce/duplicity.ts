import { bezDiakritiky } from '../text/normalizace';
import { castkaTx, type TransakceLehka } from '../schema/transakce';

export type VysledekDuplicity =
  | { stav: 'nova' }
  /** Tatáž notifikace už transakci vytvořila (např. opakované doručení). */
  | { stav: 'uz-zapsana'; transakce: TransakceLehka }
  /** Stejná platba už je zapsaná jinak (ručně, importem, účtenkou). */
  | { stav: 'mozna-duplicita'; transakce: TransakceLehka };

function dnyMezi(a: string, b: string): number {
  return Math.abs(Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / 86_400_000;
}

export function prvniSlovo(s: string | undefined): string {
  return bezDiakritiky(s ?? '').replace(/[^a-z0-9 ]/g, ' ').trim().split(/\s+/)[0] ?? '';
}

/**
 * Hledá, jestli nová transakce z notifikace už nemá dvojče.
 *
 * Dvě notifikace se stejnou částkou ve stejný den NEJSOU duplicita – dvě kávy
 * za 65 Kč jsou dva nákupy. Duplicita je jen notifikace proti záznamu z jiného
 * zdroje (ruční zápis, import výpisu, účtenka).
 */
export function najdiDuplicitu(
  nova: { type: string; amount: number; date: string; name: string; notifKlic: string },
  existujici: TransakceLehka[],
): VysledekDuplicity {
  for (const t of existujici) {
    if (t.notifKlic && t.notifKlic === nova.notifKlic) return { stav: 'uz-zapsana', transakce: t };
  }
  let nejlepsi: { t: TransakceLehka; skore: number } | null = null;
  for (const t of existujici) {
    if (t.zdroj === 'notifikace' || t.splitParent) continue;
    if ((t.type ?? 'expense') !== nova.type) continue;
    if (Math.abs(castkaTx(t) - nova.amount) > 0.005) continue;
    if (!t.date || dnyMezi(t.date, nova.date) > 1) continue;
    const stejneJmeno = prvniSlovo(t.name) !== '' && prvniSlovo(t.name) === prvniSlovo(nova.name);
    const skore = (t.date === nova.date ? 2 : 1) + (stejneJmeno ? 2 : 0);
    if (!nejlepsi || skore > nejlepsi.skore) nejlepsi = { t, skore };
  }
  return nejlepsi ? { stav: 'mozna-duplicita', transakce: nejlepsi.t } : { stav: 'nova' };
}

/** Okno, ve kterém banka doplní své oznámení (web v12.06: 10 minut). */
export const OKNO_DOPLNENI_MS = 10 * 60_000;

/**
 * Banka (KB+) pošle oznámení o platbě a hned ho doplní: nejdřív krátce
 * „Platba 1 168 Kč u obchodníka Alza.cz“, pak celé i s kartou. Telefon zachytí obě
 * (jsou to dvě různá oznámení). Jedna platba = jedna transakce.
 *
 * Doplnění téže platby = stejná banka, typ a částka do 10 minut A jedno z oznámení
 * má méně údajů (chybí karta nebo obchodník), kde jsou oba údaje, shodují se.
 * Dvě úplně stejná oznámení (obě s kartou i obchodníkem) jsou dvě platby – dvě kávy.
 * (Vyladění proti webu: web bere jako duplikát vše se stejnou částkou do 10 minut.)
 */
export function najdiDoplneni(
  nova: { type: string; amount: number; notifBanka: string; notifCas: number; notifObchodnik?: string; karta4?: string; notifKlic: string },
  existujici: TransakceLehka[],
): TransakceLehka | null {
  const stejne = (a?: string, b?: string) => !a || !b || bezDiakritiky(a) === bezDiakritiky(b);
  for (const t of existujici) {
    if (t.zdroj !== 'notifikace' || t.notifKlic === nova.notifKlic) continue;
    if (t.notifBanka !== nova.notifBanka || (t.type ?? 'expense') !== nova.type) continue;
    if (Math.abs(castkaTx(t) - nova.amount) > 0.005) continue;
    if (t.notifCas == null || Math.abs(t.notifCas - nova.notifCas) > OKNO_DOPLNENI_MS) continue;
    const obaUplna = !!(t.karta4 && nova.karta4 && t.notifObchodnik && nova.notifObchodnik);
    if (obaUplna) continue;
    if (stejne(t.karta4, nova.karta4) && stejne(t.notifObchodnik, nova.notifObchodnik)) return t;
  }
  return null;
}

/**
 * Co z plnějšího oznámení doplnit do už zapsané transakce. Jen prázdná místa –
 * co uživatel mezitím upravil (název, peněženka), se nepřepisuje.
 */
export function zmenyZDoplneni(
  stara: TransakceLehka,
  nova: { name: string; notifObchodnik?: string; karta4?: string; wallet?: string },
  /** Automatický název, který krátké oznámení dostalo (nadpis oznámení, např. „Platba kartou“). */
  automatickyNazev: string,
  /** Peněženka, kterou krátké oznámení dostalo automaticky (peněženka banky). */
  automatickaPenezenka?: string,
): Record<string, unknown> {
  const z: Record<string, unknown> = {};
  if (!stara.notifObchodnik && nova.notifObchodnik) {
    z.notifObchodnik = nova.notifObchodnik;
    // Název se doplní, jen když je pořád ten automatický (uživatel ho mezitím nepřepsal).
    if (!stara.name || stara.name === automatickyNazev) z.name = nova.name;
  }
  if (!stara.karta4 && nova.karta4) z.karta4 = nova.karta4;
  // Plné oznámení zná kartu → peněženka karty (např. kreditka) má přednost před peněženkou banky,
  // pokud ji uživatel mezitím sám nezměnil.
  if (nova.wallet && nova.wallet !== stara.wallet && (!stara.wallet || stara.wallet === automatickaPenezenka)) z.wallet = nova.wallet;
  return z;
}
