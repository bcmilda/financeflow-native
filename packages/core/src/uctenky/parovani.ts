import { castkaTx, type TransakceLehka } from '../schema/transakce';
import { prvniSlovo } from '../transakce/duplicity';

/**
 * Doskenování účtenky k transakci z notifikace.
 *
 * Notifikace řekne „145,40 Kč, Penny“. Účtenka řekne, co v tom bylo.
 * Naskenovaná účtenka proto nemá vytvořit druhou transakci (jako dnes na webu),
 * ale doplnit položky do té, kterou už zapsala notifikace.
 *
 * Tahle funkce najde kandidáty. Rozhodne uživatel: jeden jasný kandidát se
 * nabídne předvybraný, víc kandidátů = výběr, žádný = nová transakce jako dnes.
 */
export interface UctenkaKParovani {
  castka: number;
  /** YYYY-MM-DD z účtenky. */
  datum: string;
  obchod: string;
}

export interface KandidatParovani {
  transakce: TransakceLehka;
  /** 0–100, čím víc, tím jistější. */
  jistota: number;
}

function dnyMezi(a: string, b: string): number {
  return Math.abs(Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / 86_400_000;
}

export function najdiTransakciProUctenku(u: UctenkaKParovani, transakce: TransakceLehka[]): KandidatParovani[] {
  const obchod = prvniSlovo(u.obchod);
  const vysledek: KandidatParovani[] = [];
  for (const t of transakce) {
    if ((t.type ?? 'expense') !== 'expense' || t.splitParent) continue;
    // Transakce, ke které už účtenka patří, se znovu nenabízí.
    if ((Array.isArray(t.receiptItems) && t.receiptItems.length) || t.receiptAddedAt) continue;
    if (!t.date) continue;
    const dny = dnyMezi(t.date, u.datum);
    if (dny > 2) continue;
    // Kartou se platí přesně; tolerance 1 Kč kvůli zaokrouhlení na účtence.
    const rozdil = Math.abs(castkaTx(t) - u.castka);
    if (rozdil > 1) continue;

    let jistota = 40;
    if (rozdil < 0.005) jistota += 25;
    if (dny === 0) jistota += 15; else if (dny <= 1) jistota += 5;
    if (obchod && prvniSlovo(t.name) === obchod) jistota += 20;
    vysledek.push({ transakce: t, jistota: Math.min(100, jistota) });
  }
  return vysledek.sort((a, b) => b.jistota - a.jistota);
}
