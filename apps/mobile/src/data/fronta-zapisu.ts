/**
 * Fronta zápisů do Firebase, uložená v zařízení.
 *
 * Firebase drží neodeslané zápisy jen v paměti – když se appka bez internetu zavře,
 * zmizí. Proto se každý zápis nejdřív uloží sem a smaže se, až ho server potvrdí.
 * Při dalším startu se neodeslané zápisy pošlou znovu. Operace jsou idempotentní
 * (zápis celé hodnoty, úprava polí, smazání), takže opakování nic nezdvojí.
 */
export interface Operace {
  id: string;
  typ: 'set' | 'update' | 'remove';
  /** Cesta v databázi, např. users/{uid}/data/transactions/123 */
  cesta: string;
  hodnota?: unknown;
  cas: number;
}

export interface UlozisteFronty {
  nacist(): Promise<Operace[]>;
  ulozit(ops: Operace[]): Promise<void>;
}

export type Provedeni = (op: Operace) => Promise<void>;

export class FrontaZapisu {
  private ops: Operace[] = [];
  private nactena: Promise<void>;
  private zamek: Promise<void> = Promise.resolve();
  private posluchaci = new Set<(pocet: number) => void>();

  constructor(private uloziste: UlozisteFronty, private provest: Provedeni) {
    this.nactena = uloziste.nacist().then(o => { this.ops = o; }).catch(() => { this.ops = []; });
  }

  /** Počet zápisů, které ještě server nepotvrdil. */
  get cekajici(): number { return this.ops.length; }

  sleduj(fn: (pocet: number) => void): () => void {
    this.posluchaci.add(fn);
    return () => this.posluchaci.delete(fn);
  }

  private oznam() { this.posluchaci.forEach(f => f(this.ops.length)); }

  /** Úpravy seznamu operací jdou za sebou, aby se uložení nepřebila. */
  private serial(fn: () => Promise<void>): Promise<void> {
    const dalsi = this.zamek.then(fn, fn);
    this.zamek = dalsi.catch(() => {});
    return dalsi;
  }

  /**
   * Uloží operaci do zařízení a pošle ji. Vrátí se hned po uložení do zařízení
   * (UI nečeká na server); potvrzení serverem operaci z fronty smaže.
   */
  async pridat(op: Omit<Operace, 'id' | 'cas'>): Promise<void> {
    await this.nactena;
    const plna: Operace = { ...op, id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`, cas: Date.now() };
    await this.serial(async () => { this.ops = [...this.ops, plna]; await this.uloziste.ulozit(this.ops); });
    this.oznam();
    void this.odeslat(plna);
  }

  private async odeslat(op: Operace): Promise<void> {
    try {
      await this.provest(op);
      await this.serial(async () => { this.ops = this.ops.filter(o => o.id !== op.id); await this.uloziste.ulozit(this.ops); });
      this.oznam();
    } catch {
      // Odmítnuto serverem (např. pravidla). Nechat ve frontě nemá smysl – zkoušelo by se
      // donekonečna. Operace se zahodí, appka ukáže stav podle serveru.
      await this.serial(async () => { this.ops = this.ops.filter(o => o.id !== op.id); await this.uloziste.ulozit(this.ops); });
      this.oznam();
    }
  }

  /** Při startu: znovu pošle, co minule neodešlo (ve stejném pořadí). */
  async prehrat(): Promise<number> {
    await this.nactena;
    const k = [...this.ops];
    for (const op of k) void this.odeslat(op);
    return k.length;
  }
}
