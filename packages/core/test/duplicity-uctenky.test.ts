import { describe, expect, it } from 'vitest';
import { najdiDuplicitu, najdiTransakciProUctenku } from '../src';

const nova = { type: 'expense', amount: 145.4, date: '2026-10-16', name: 'Penny Ostrava', notifKlic: 'k1' };

describe('duplicity', () => {
  it('tatáž notifikace podruhé = už zapsaná', () => {
    expect(najdiDuplicitu(nova, [{ id: 1, notifKlic: 'k1', zdroj: 'notifikace' }]).stav).toBe('uz-zapsana');
  });

  it('ručně zapsaná stejná platba = možná duplicita', () => {
    const r = najdiDuplicitu(nova, [{ id: 2, type: 'expense', amount: 145.4, date: '2026-10-16', name: 'PENNY' }]);
    expect(r.stav).toBe('mozna-duplicita');
  });

  it('web čte i staré pole amt', () => {
    expect(najdiDuplicitu(nova, [{ id: 2, type: 'expense', amt: 145.4, date: '2026-10-17', name: 'x' }]).stav).toBe('mozna-duplicita');
  });

  it('dvě notifikace se stejnou částkou = dva nákupy, ne duplicita', () => {
    expect(najdiDuplicitu(nova, [{ id: 3, type: 'expense', amount: 145.4, date: '2026-10-16', name: 'Penny Ostrava', zdroj: 'notifikace', notifKlic: 'k0' }]).stav).toBe('nova');
  });

  it('jiná částka nebo datum o 2+ dny = nová', () => {
    expect(najdiDuplicitu(nova, [{ id: 4, type: 'expense', amount: 145, date: '2026-10-16' }]).stav).toBe('nova');
    expect(najdiDuplicitu(nova, [{ id: 5, type: 'expense', amount: 145.4, date: '2026-10-13' }]).stav).toBe('nova');
  });

  it('rodič rozdělené transakce se neporovnává (počítají se jen části)', () => {
    expect(najdiDuplicitu(nova, [{ id: 6, type: 'expense', amount: 145.4, date: '2026-10-16', splitParent: 1 }]).stav).toBe('nova');
  });
});

describe('doskenování účtenky k transakci z notifikace', () => {
  const tx = [
    { id: 10, type: 'expense', amount: 145.4, date: '2026-10-16', name: 'Penny Ostrava', zdroj: 'notifikace' },
    { id: 11, type: 'expense', amount: 145.4, date: '2026-10-14', name: 'Lidl' },
    { id: 12, type: 'expense', amount: 1022.4, date: '2026-10-16', name: 'MOL 001 Ostrava' },
    { id: 13, type: 'expense', amount: 145.4, date: '2026-10-16', name: 'Penny', receiptItems: [{}] },
  ];

  it('najde transakci se stejnou částkou, dnem a obchodem jako nejjistější', () => {
    const k = najdiTransakciProUctenku({ castka: 145.4, datum: '2026-10-16', obchod: 'PENNY MARKET s.r.o.' }, tx);
    expect(k[0]?.transakce.id).toBe(10);
    expect(k[0]?.jistota).toBe(100);
  });

  it('transakci, která už účtenku má, znovu nenabídne', () => {
    const k = najdiTransakciProUctenku({ castka: 145.4, datum: '2026-10-16', obchod: 'Penny' }, tx);
    expect(k.map(x => x.transakce.id)).not.toContain(13);
  });

  it('bez shody nic nenabídne (vznikne nová transakce jako dnes)', () => {
    expect(najdiTransakciProUctenku({ castka: 99, datum: '2026-10-16', obchod: 'Albert' }, tx)).toEqual([]);
  });
});
