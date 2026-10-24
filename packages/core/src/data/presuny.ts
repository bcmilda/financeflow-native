import type { Penezenka, Tx } from './typy';

/**
 * Přesun mezi peněženkami – stejně jako web (premium.js doTransfer):
 * dvě transakce se společným `transferId` a `category: 'transfer'`,
 * výdaj z jedné peněženky a příjem do druhé. Do příjmů a výdajů se nepočítá
 * (jePresun), zůstatky obou peněženek se pohnou.
 *
 * Vyladění proti webu (N-108): web při různých měnách zapíše do obou peněženek
 * stejné číslo (100 € → +100 Kč). Tady má cílová peněženka vlastní částku.
 */
export interface ZadaniPresunu {
  z: string;
  do: string;
  /** Částka v měně zdrojové peněženky. */
  castka: number;
  /** Částka v měně cílové peněženky – povinná, když se měny liší. */
  castkaCil?: number;
  datum: string;
  poznamka: string;
}

export interface TextyPresunu {
  /** Název odchozí transakce, např. „Převod → Hotovost“. */
  odchozi: (cil: string) => string;
  /** Název příchozí transakce, např. „Převod ← Běžný účet“. */
  prichozi: (zdroj: string) => string;
  /** Poznámka, když uživatel žádnou nenapíše. */
  poznamka: string;
}

export type ChybaPresunu = 'penezenky' | 'stejne' | 'castka' | 'castkaCil' | 'datum' | null;

export function menaPenezenky(id: string, penezenky: Penezenka[]): string {
  return penezenky.find(w => w.id === id)?.currency || 'CZK';
}

export function ruzneMeny(z: string, do_: string, penezenky: Penezenka[]): boolean {
  return !!z && !!do_ && menaPenezenky(z, penezenky) !== menaPenezenky(do_, penezenky);
}

export function zkontrolovatPresun(p: ZadaniPresunu, penezenky: Penezenka[]): ChybaPresunu {
  if (!p.z || !p.do || !penezenky.some(w => w.id === p.z) || !penezenky.some(w => w.id === p.do)) return 'penezenky';
  if (p.z === p.do) return 'stejne';
  if (!(p.castka > 0) || !Number.isFinite(p.castka)) return 'castka';
  if (ruzneMeny(p.z, p.do, penezenky) && !(p.castkaCil != null && p.castkaCil > 0 && Number.isFinite(p.castkaCil))) return 'castkaCil';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.datum)) return 'datum';
  return null;
}

/** Id ve tvaru webu `uid()`: 'id' + čas v ms + 4 znaky. */
export function idWebu(ted: number, nahoda: () => number = Math.random): string {
  return `id${ted}${nahoda().toString(36).slice(2, 6).padEnd(4, '0')}`;
}

/** Dvojice transakcí přesunu ve tvaru webu. Před voláním zkontrolovat (zkontrolovatPresun). */
export function vytvorPresun(p: ZadaniPresunu, penezenky: Penezenka[], texty: TextyPresunu, ted: number, nahoda: () => number = Math.random): [Tx, Tx] {
  const wz = penezenky.find(w => w.id === p.z);
  const wd = penezenky.find(w => w.id === p.do);
  const transferId = idWebu(ted, nahoda);
  const poznamka = p.poznamka.trim() || texty.poznamka;
  const cil = ruzneMeny(p.z, p.do, penezenky) ? (p.castkaCil as number) : p.castka;
  const zaokr = (n: number) => Math.round(n * 100) / 100;
  const odchozi: Tx = {
    id: idWebu(ted, nahoda), name: texty.odchozi(wd?.name ?? ''), amount: zaokr(p.castka), type: 'expense',
    date: p.datum, wallet: p.z, note: poznamka, transferId, category: 'transfer', createdAt: ted,
  };
  const prichozi: Tx = {
    id: idWebu(ted + 1, nahoda), name: texty.prichozi(wz?.name ?? ''), amount: zaokr(cil), type: 'income',
    date: p.datum, wallet: p.do, note: poznamka, transferId, category: 'transfer', createdAt: ted,
  };
  return [odchozi, prichozi];
}
