import { describe, expect, it } from 'vitest';
import { formatCastka, formatDatum, jazykZarizeni, vytvorI18n } from '../src';

describe('překlady', () => {
  it('české množné číslo: 1 / 2 / 5 transakcí', async () => {
    const i = await vytvorI18n('cs');
    expect(i.t('pocet.transakce', { n: 1 })).toBe('1 transakce');
    expect(i.t('pocet.transakce', { n: 3 })).toBe('3 transakce');
    expect(i.t('pocet.transakce', { n: 5 })).toBe('5 transakcí');
  });

  it('ukrajinské množné číslo má čtyři tvary', async () => {
    const i = await vytvorI18n('uk');
    expect(i.t('pocet.transakce', { n: 1 })).toBe('1 транзакція');
    expect(i.t('pocet.transakce', { n: 3 })).toBe('3 транзакції');
    expect(i.t('pocet.transakce', { n: 5 })).toBe('5 транзакцій');
    expect(i.t('pocet.transakce', { n: 21 })).toBe('21 транзакція');
  });

  it('polské: 2 transakcje, 5 transakcji, 22 transakcje', async () => {
    const i = await vytvorI18n('pl');
    expect(i.t('pocet.transakce', { n: 2 })).toBe('2 transakcje');
    expect(i.t('pocet.transakce', { n: 5 })).toBe('5 transakcji');
    expect(i.t('pocet.transakce', { n: 22 })).toBe('22 transakcje');
  });

  it('výběr podle typu (select)', async () => {
    const i = await vytvorI18n('de');
    expect(i.t('zBanky.vysledekPlatba', { typ: 'income', castka: '10 €', nazev: 'X' })).toBe('Einnahme 10 € · X');
  });
});

describe('formátování', () => {
  const bez = (s: string) => s.replace(/[  ]/g, ' ');
  it('měna podle jazyka', () => {
    expect(bez(formatCastka(1022.4, 'CZK', 'cs'))).toBe('1 022,40 Kč');
    expect(bez(formatCastka(25000, 'CZK', 'cs'))).toBe('25 000 Kč');
    expect(bez(formatCastka(1022.4, 'CZK', 'en'))).toBe('CZK 1,022.40');
  });
  it('datum podle jazyka', () => {
    expect(bez(formatDatum('2026-10-16', 'cs'))).toBe('16. 10. 2026');
    expect(formatDatum('2026-10-16', 'de')).toBe('16.10.2026');
  });
  it('jazyk zařízení', () => {
    expect(jazykZarizeni(['uk-UA', 'en'])).toBe('uk');
    expect(jazykZarizeni(['fr-FR'])).toBe('cs');
  });
});
