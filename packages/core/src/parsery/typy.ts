/** Jedna notifikace tak, jak ji předá telefon (Android NotificationListenerService). */
export interface VstupNotifikace {
  /** Balíček aplikace, která notifikaci poslala, např. `cz.kb.ndb` (KB+). */
  balicek: string;
  titulek: string;
  text: string;
  /** Čas doručení v ms (postTime). */
  cas: number;
}

export type TypPohybu = 'expense' | 'income';
export type DruhPlatby = 'karta' | 'prevod' | 'vyber' | 'jine';

/** Co parser z notifikace vytáhl. Nic dalšího se z textu nebere (žádná čísla účtů). */
export interface RozpoznanaPlatba {
  typ: TypPohybu;
  /** Vždy kladné číslo, směr určuje `typ`. */
  castka: number;
  /** ISO kód: CZK, EUR, USD… */
  mena: string;
  /** Obchodník nebo popis protistrany. Prázdné, když ho notifikace neuvádí. */
  protistrana: string;
  druh: DruhPlatby;
  /** Poslední 4 číslice karty, pokud je notifikace uvádí (kvůli přiřazení peněženky). */
  karta4?: string;
}

/** Výsledek pravidla jedné banky. `null` = tohle pravidlo notifikaci nezná. */
export type VysledekPravidla = RozpoznanaPlatba | { ignorovat: string } | null;

export interface BankaDef {
  /** Krátký stálý klíč, ukládá se do transakce (`notifBanka`). */
  id: string;
  nazev: string;
  /**
   * Balíčky aplikací banky. `overeno: true` = ověřeno na Google Play,
   * `false` = odhad, potvrdí průzkum aplikací v telefonu.
   */
  aplikace: { balicek: string; nazev: string; overeno: boolean }[];
  /**
   * `true` = pravidla ověřena na skutečných notifikacích (vzorky v testech).
   * `false` = pravidla převzatá z webu, nikdo je na skutečné notifikaci neověřil.
   */
  pravidlaOverena: boolean;
  rozpoznej(titulek: string, text: string): VysledekPravidla;
}

export type VysledekParseru =
  | { stav: 'platba'; banka: BankaDef; platba: RozpoznanaPlatba }
  | { stav: 'ignorovat'; banka: BankaDef; duvod: string }
  | { stav: 'nerozpoznano'; banka: BankaDef | null };
