/**
 * Data uživatele tak, jak je ukládá web (users/{uid}/data). Jen pole, která
 * nativní appka čte – zbytek se při úpravách nedotýká (zápis po polích).
 */
export interface Tx {
  id: number | string;
  type?: 'expense' | 'income' | string;
  name?: string;
  amount?: number;
  /** Starší transakce mají jen `amt` – web čte `t.amount || t.amt`. */
  amt?: number;
  /** Zafixovaná částka v CZK (cizí měna). Má přednost. */
  amtCZK?: number;
  catId?: string;
  category?: string;
  subcat?: string;
  date?: string;
  wallet?: string;
  note?: string;
  tags?: string | string[];
  currency?: string;
  createdAt?: number;
  /** Rozdělená transakce: rodič nese celou částku, děti části. */
  splitParent?: boolean | number | string;
  splitId?: string;
  /** Vyrovnávací úhrada – do příjmů/výdajů se nepočítá. */
  isBalancing?: boolean;
  /** Pár přesunu mezi peněženkami. */
  transferId?: string;
  src?: string;
  receiptItems?: unknown[];
  receiptAddedAt?: number;
  zdroj?: string;
  notifKlic?: string;
  /** Splátka půjčky. */
  debtId?: string;
  /** Splátka z Opakované platby založená dopředu – ještě nezaplacená. */
  debtCeka?: boolean;
  [pole: string]: unknown;
}

export interface Kategorie {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  /** expense | income | both | transfer (Přesuny – spoření, investice) */
  type?: string;
  subs?: string[];
  isSaving?: boolean;
  isInvest?: boolean;
  archived?: boolean;
}

export interface Penezenka {
  id: string;
  name: string;
  type?: string;
  currency?: string;
  /** Zůstatek – bez `balanceDate` počáteční stav, s ním stav ke konci toho dne. */
  balance?: number;
  balanceDate?: string;
  balanceSetAt?: number;
  archived?: boolean;
}

export interface SplatkaPlanu {
  date?: string;
  payment?: number;
  principal?: number;
  interest?: number;
  paid?: boolean;
}

export interface Dluh {
  id?: string;
  name?: string;
  /** personal | mortgage | nonbank | credit | ico | friend */
  type?: string;
  creditor?: string;
  /** Úrok % p.a. */
  interest?: number;
  total?: number;
  remaining?: number;
  /** Splátka v jednom období (podle `freq`). */
  payment?: number;
  installment?: number;
  /** monthly | weekly | biweekly */
  freq?: string;
  /** Proměnná splátka: od měsíce 'YYYY-MM' platí `amt`. */
  installments?: { from?: string; amt?: number }[];
  /** Budoucí splátky (web je generuje, zaplacené mají `paid`). */
  schedule?: SplatkaPlanu[];
  priority?: string;
  startDate?: string;
}

export interface DataUzivatele {
  transactions: Tx[];
  categories: Kategorie[];
  wallets: Penezenka[];
  bank?: { startBalance?: number };
  debts?: Dluh[];
}

/** Kurzy ČNB: kolik Kč za 1 jednotku měny. Bez kurzu se cizí částka bere 1:1 (jako web). */
export type Kurzy = Partial<Record<string, number>>;
