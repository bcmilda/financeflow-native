import { describe, expect, it } from 'vitest';
import type { Kategorie, Penezenka, Tx } from '@ff/core';
import { kategorieProTyp, novaTransakce, prazdnyFormular, validovat, zmenyTransakce, zTransakce } from './formular-transakce';

const kat: Kategorie[] = [
  { id: 'cat1', name: 'Jídlo & Nákupy', type: 'expense', subs: ['Potraviny'] },
  { id: 'cat7', name: 'Výplata', type: 'income' },
  { id: 'cat9', name: 'Různé', type: 'both' },
  { id: 'catX', name: 'Stará', type: 'expense', archived: true },
];
const pen: Penezenka[] = [{ id: 'w1', name: 'Účet', currency: 'CZK' }, { id: 'w3', name: 'Euro', currency: 'EUR' }];

describe('formulář transakce', () => {
  it('nová transakce ve tvaru webu (amount i amt, catId i category)', () => {
    const h = { ...prazdnyFormular('2026-10-17', 'w1'), castka: '1 022,40', catId: 'cat1', nazev: ' Penny ' };
    expect(novaTransakce(h, kat, pen, 123, 1)).toEqual({
      id: 123, type: 'expense', name: 'Penny', amount: 1022.4, amt: 1022.4, catId: 'cat1', category: 'cat1',
      date: '2026-10-17', wallet: 'w1', note: '', createdAt: 1,
    });
  });

  it('bez názvu dostane název kategorie', () => {
    const h = { ...prazdnyFormular('2026-10-17'), castka: '50', catId: 'cat1' };
    expect(novaTransakce(h, kat, pen, 1, 1).name).toBe('Jídlo & Nákupy');
  });

  it('peněženka v eurech nastaví měnu', () => {
    const h = { ...prazdnyFormular('2026-10-17', 'w3'), castka: '12,5', nazev: 'Billa' };
    expect(novaTransakce(h, kat, pen, 1, 1)).toMatchObject({ currency: 'EUR', amount: 12.5 });
  });

  it('kontrola: částka, datum, název nebo kategorie', () => {
    expect(validovat({ ...prazdnyFormular('2026-10-17'), castka: '0', nazev: 'x' }, kat)).toBe('castka');
    expect(validovat({ ...prazdnyFormular('2026-10-17'), castka: 'abc', nazev: 'x' }, kat)).toBe('castka');
    expect(validovat({ ...prazdnyFormular(''), castka: '5', nazev: 'x' }, kat)).toBe('datum');
    expect(validovat({ ...prazdnyFormular('2026-10-17'), castka: '5' }, kat)).toBe('nazev');
    expect(validovat({ ...prazdnyFormular('2026-10-17'), castka: '5', catId: 'cat1' }, kat)).toBeNull();
  });

  it('nabídka kategorií podle typu, bez archivovaných', () => {
    expect(kategorieProTyp(kat, 'expense').map(k => k.id)).toEqual(['cat1', 'cat9']);
    expect(kategorieProTyp(kat, 'income').map(k => k.id)).toEqual(['cat7', 'cat9']);
  });
});

describe('úprava transakce – zapisují se jen změněná pole', () => {
  const puvodni: Tx = {
    id: 5, type: 'expense', name: 'Penny', amount: 145.4, amt: 145.4, catId: 'cat1', category: 'cat1', date: '2026-10-16',
    wallet: 'w1', note: '', receiptItems: [{ name: 'Rohlík' }], tags: 'nakup',
  };

  it('beze změny = nic se nezapíše', () => {
    expect(zmenyTransakce(puvodni, zTransakce(puvodni), kat, pen)).toEqual({});
  });

  it('změna kategorie zapíše catId i category, položky účtenky se nedotknou', () => {
    const z = zmenyTransakce(puvodni, { ...zTransakce(puvodni), catId: 'cat9' }, kat, pen);
    expect(z).toEqual({ catId: 'cat9', category: 'cat9' });
  });

  it('změna částky zapíše amount i amt', () => {
    expect(zmenyTransakce(puvodni, { ...zTransakce(puvodni), castka: '150' }, kat, pen)).toEqual({ amount: 150, amt: 150 });
  });

  it('odebrání peněženky pole smaže (null)', () => {
    expect(zmenyTransakce(puvodni, { ...zTransakce(puvodni), wallet: '' }, kat, pen)).toEqual({ wallet: null, currency: null });
  });

  it('zafixovaná částka v Kč se po změně částky smaže (jinak by lhala)', () => {
    const eur: Tx = { ...puvodni, wallet: 'w3', amount: 20, amt: 20, amtCZK: 500 };
    expect(zmenyTransakce(eur, { ...zTransakce(eur), castka: '25' }, kat, pen)).toEqual({ amount: 25, amt: 25, amtCZK: null });
  });

  it('částka ve formuláři na dvě desetinná místa (145,40)', () => {
    expect(zTransakce(puvodni).castka).toBe('145,40');
    expect(zTransakce({ ...puvodni, amount: 250, amt: 250 }).castka).toBe('250');
  });

  it('stará transakce jen s amt', () => {
    const stara: Tx = { id: 1, type: 'expense', amt: 80, name: 'x', catId: 'cat1', date: '2026-01-01' };
    expect(zTransakce(stara).castka).toBe('80');
    expect(zmenyTransakce(stara, zTransakce(stara), kat, pen)).toEqual({});
  });
});
