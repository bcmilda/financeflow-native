import { describe, expect, it } from 'vitest';
import { souhrnMesice, vydajePodleKategorii, zustatekPenezenky, casVzniku, type DataUzivatele } from '../src';
import ukazka from './fixtures/data-ukazka.json';

/**
 * Očekávané hodnoty spočítané ručně z test/fixtures/data-ukazka.json.
 * Stejná data pouští tools/kontrakt-web.mjs přes kód webu – musí vyjít totéž.
 */
const D = ukazka as unknown as DataUzivatele;

describe('souhrn měsíce (Dashboard)', () => {
  const s = souhrnMesice(D, 2026, 9);

  it('výdaje bez vyrovnávacích, rozdělených rodičů a přesunů', () => {
    // 1200 + 800 (jen amt) + 1000 + 2000 (děti rozdělení) + 700 + 300 + 400 + 250 + 100 + 500 (amtCZK) + 10 (EUR bez kurzu) + 600
    expect(s.vydaje).toBe(7860);
  });
  it('příjmy bez přesunů (převod mezi peněženkami, výběr z rezervy)', () => expect(s.prijmy).toBe(32000));
  it('bilance', () => expect(s.bilance).toBe(24140));
  it('změna výdajů proti minulému měsíci', () => {
    expect(s.minuleVydaje).toBe(4000);
    expect(s.zmenaVydaju).toBe(97);
  });
  it('zůstatek = počáteční stav + saldo všech měsíců do zvoleného (listopad se nepočítá)', () => expect(s.zustatek).toBe(55140));
  it('dluhy', () => expect(s.dluhy).toBe(128000));
  it('kurz se použije u cizí peněženky bez amtCZK', () => {
    expect(souhrnMesice(D, 2026, 9, { EUR: 25 }).vydaje).toBe(7860 - 10 + 250);
  });
  it('leden se porovná s prosincem předchozího roku', () => {
    const d: DataUzivatele = { ...D, transactions: [
      { id: 1, type: 'expense', amount: 100, date: '2025-12-31' },
      { id: 2, type: 'expense', amount: 150, date: '2026-01-02' },
    ] };
    expect(souhrnMesice(d, 2026, 0)).toMatchObject({ vydaje: 150, minuleVydaje: 100, zmenaVydaju: 50 });
  });
});

describe('výdaje po kategoriích', () => {
  it('součet dlaždic sedí na celkové výdaje', () => {
    const k = vydajePodleKategorii(D, 2026, 9);
    expect(k).toEqual([
      { catId: 'cat1', celkem: 3650 },
      { catId: 'cat2', celkem: 2910 },
      { catId: '', celkem: 1300 },
    ]);
    expect(k.reduce((s, x) => s + x.celkem, 0)).toBe(souhrnMesice(D, 2026, 9).vydaje);
  });
});

describe('zůstatky peněženek', () => {
  it('bez data zůstatku: počáteční stav + všechny transakce (web čte jen amount)', () => {
    expect(zustatekPenezenky('w1', D)).toBe(45302);
  });
  it('se zůstatkem ke dni: starší a importované ze stejného dne už v něm jsou', () => {
    expect(zustatekPenezenky('w2', D)).toBe(1650);
  });
  it('cizí měna v měně peněženky', () => expect(zustatekPenezenky('w3', D)).toBe(70));
  it('čas vzniku z id ve tvaru webu', () => {
    expect(casVzniku({ id: 1791000000000 * 16 + 3 })).toBe(1791000000000);
    expect(casVzniku({ id: 'id1791000000000abc' })).toBe(1791000000000);
    expect(casVzniku({ id: 5 })).toBeNull();
  });
});
