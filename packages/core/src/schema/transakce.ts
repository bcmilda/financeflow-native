import { z } from 'zod';

/**
 * Transakce ve tvaru, který čte web (users/{uid}/data/transactions/{id}).
 *
 * Web drží transakce jako objekt podle id (ADR-062) a změny z jiného zařízení
 * přijímá po jedné (onChildAdded). Proto nativní appka zapisuje vždy jen
 * jednu cestu `transactions/{id}` a nikdy celé `data`.
 *
 * Pole `amount` i `amt` – web čte `t.amount || t.amt`. `category` = kopie `catId`.
 */
export const TransakceWeb = z.object({
  id: z.number().int().positive(),
  type: z.enum(['expense', 'income']),
  name: z.string().max(299),
  amount: z.number().positive(),
  amt: z.number().positive(),
  catId: z.string(),
  category: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  wallet: z.string().optional(),
  currency: z.string().length(3),
  note: z.string().max(999),
  createdAt: z.number().int(),
  // ── jen nativní appka ──
  zdroj: z.literal('notifikace'),
  /** Otisk notifikace – tatáž notifikace nikdy nevytvoří druhou transakci. */
  notifKlic: z.string(),
  notifBanka: z.string(),
  karta4: z.string().regex(/^\d{4}$/).optional(),
});

export type TransakceWeb = z.infer<typeof TransakceWeb>;

/** Minimum, které potřebují duplicity a párování účtenek (čte se i z webových transakcí). */
export interface TransakceLehka {
  id: number | string;
  type?: string;
  name?: string;
  amount?: number;
  amt?: number;
  date?: string;
  zdroj?: string;
  notifKlic?: string;
  receiptItems?: unknown[];
  receiptAddedAt?: number;
  splitParent?: unknown;
}

export function castkaTx(t: TransakceLehka): number {
  return Number(t.amount || t.amt || 0);
}
