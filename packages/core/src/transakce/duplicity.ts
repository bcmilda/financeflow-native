import { bezDiakritiky } from '../kategorie/odhad';
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
