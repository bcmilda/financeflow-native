import { describe, expect, it } from 'vitest';
import { obecnaPravidla, parseCastka } from '../src';

/**
 * Obecná pravidla pro banky, od kterých zatím nemáme skutečné vzorky.
 * Tyto texty jsou PŘÍKLADY tvaru, ne ověřené notifikace – po získání skutečných
 * vzorků se přidají do testu konkrétní banky (doc/BANKY.md).
 */
describe('parseCastka', () => {
  it.each([
    ['145,40', 145.4], ['1 022,40', 1022.4], ['1 022,40', 1022.4], ['1 022,40', 1022.4],
    ['1.022,40', 1022.4], ['1,022.40', 1022.4], ['12.50', 12.5], ['250', 250], ['15 000', 15000],
    ['1,022', 1022], ['1.234', 1234], ['-250', 250], ['0,99', 0.99],
  ])('%s → %d', (vstup, cislo) => expect(parseCastka(vstup)).toBe(cislo));

  it('nesmysl → NaN', () => expect(parseCastka('abc')).toBeNaN());
});

describe('obecná pravidla', () => {
  it('příchozí platba = příjem', () => {
    expect(obecnaPravidla('Příchozí platba', '25 000,00 Kč na účet 123-4567890123/0100 od Zaměstnavatel s.r.o.'))
      .toMatchObject({ typ: 'income', castka: 25000, druh: 'prevod' });
  });

  it('zůstatek se nesplete s částkou', () => {
    expect(obecnaPravidla('Platba kartou', 'Zaplaceno 249 Kč v Lidl. Zůstatek 12 450,00 Kč'))
      .toMatchObject({ typ: 'expense', castka: 249, protistrana: 'Lidl' });
  });

  it('výběr z bankomatu', () => {
    expect(obecnaPravidla('Výběr z bankomatu', '2 000 Kč, bankomat Ostrava Hlavní'))
      .toMatchObject({ typ: 'expense', castka: 2000, druh: 'vyber' });
  });

  it('anglická verze aplikace (měna před částkou)', () => {
    expect(obecnaPravidla('', 'You spent €12.50 at McDonald\'s'))
      .toMatchObject({ typ: 'expense', castka: 12.5, mena: 'EUR', protistrana: 'McDonald\'s', druh: 'karta' });
  });

  it('znaménko bez slovního popisu', () => {
    expect(obecnaPravidla('', '-1 250 Kč LIDL')).toMatchObject({ typ: 'expense', castka: 1250 });
    expect(obecnaPravidla('', '+500 Kč')).toMatchObject({ typ: 'income', castka: 500 });
  });

  it.each([
    ['Ověřte platbu', 'Potvrďte platbu 1 250 Kč u Alza.cz v aplikaci'],
    ['Platba zamítnuta', 'Platba 1 250 Kč u Alza.cz byla zamítnuta'],
    ['Trvalý příkaz', 'Platba 5 000 Kč bude provedena zítra'],
    ['Přihlášení', 'Nové přihlášení do aplikace'],
  ])('neprovedený pohyb se ignoruje: %s', (titulek, text) => {
    expect(obecnaPravidla(titulek, text)).toHaveProperty('ignorovat');
  });

  it('bez směru (jen částka) se nic nezapíše', () => {
    expect(obecnaPravidla('Informace', 'Váš limit je 50 000 Kč')).toBeNull();
  });
});
