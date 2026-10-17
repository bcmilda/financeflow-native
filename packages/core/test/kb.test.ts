import { describe, expect, it } from 'vitest';
import { parseNotifikace, vytvorTransakci, type VstupNotifikace } from '../src';

/**
 * Skutečné notifikace z KB+ (screenshot Milana, 17. 10. 2026).
 * Anonymizováno: číslo karty, číslo účtu a města. Tvar textu je zachovaný
 * včetně dvojité mezery za „Kč“ a emoji karty uprostřed věty.
 */
const KB = 'cz.kb.ndb';
const cas = Date.parse('2026-10-16T18:30:00+02:00');
const n = (titulek: string, text: string): VstupNotifikace => ({ balicek: KB, titulek, text, cas });

describe('KB+ – skutečné notifikace', () => {
  it('platba kartou: částka, obchodník, karta', () => {
    const r = parseNotifikace(n('Platba kartou', '145,40 Kč  u obchodníka Penny Ostrava, 💳 VISA Classic 4111 11** **** 1234.'));
    expect(r.stav).toBe('platba');
    if (r.stav !== 'platba') return;
    expect(r.banka.id).toBe('kb');
    expect(r.platba).toEqual({ typ: 'expense', castka: 145.4, mena: 'CZK', protistrana: 'Penny Ostrava', druh: 'karta', karta4: '1234' });
  });

  it('platba kartou nad tisíc (mezera v tisících)', () => {
    const r = parseNotifikace(n('Platba kartou', '1 022,40 Kč  u obchodníka MOL 001 Ostrava, 💳 VISA Classic 4111 11** **** 1234.'));
    expect(r.stav === 'platba' && r.platba.castka).toBe(1022.4);
    expect(r.stav === 'platba' && r.platba.protistrana).toBe('MOL 001 Ostrava');
  });

  it('platba kartou s nezlomitelnou mezerou (Android ji v notifikacích používá)', () => {
    const r = parseNotifikace(n('Platba kartou', '1 022,40 Kč  u obchodníka MOL 001 Ostrava, 💳 VISA Classic 4111 11** **** 1234.'));
    expect(r.stav === 'platba' && r.platba.castka).toBe(1022.4);
  });

  it('odchozí platba: číslo účtu se nestane názvem', () => {
    const r = parseNotifikace(n('💸 Odchozí platba', '840,00 Kč z účtu 123-4567890123/0100'));
    expect(r.stav).toBe('platba');
    if (r.stav !== 'platba') return;
    expect(r.platba).toMatchObject({ typ: 'expense', castka: 840, druh: 'prevod', protistrana: '' });
  });

  it('budoucí splátka kreditní karty se NEZAPÍŠE', () => {
    const r = parseNotifikace(n('Končí bezúročné období', 'Automatická splátka 1 000,00 Kč vaší kreditní karty 4U karta proběhne 20.10.2026 ráno.'));
    expect(r.stav).toBe('ignorovat');
  });

  it('z platby kartou vznikne transakce ve tvaru webu', () => {
    const v = n('Platba kartou', '145,40 Kč  u obchodníka Penny Ostrava, 💳 VISA Classic 4111 11** **** 1234.');
    const r = parseNotifikace(v);
    if (r.stav !== 'platba') throw new Error('nerozpoznáno');
    const tx = vytvorTransakci(v, r.banka, r.platba, { catId: '', wallet: 'w1', casovaZona: 'Europe/Prague', ted: 1 });
    expect(tx).toMatchObject({
      type: 'expense', name: 'Penny Ostrava', amount: 145.4, amt: 145.4, catId: '', category: '',
      date: '2026-10-16', wallet: 'w1', currency: 'CZK', note: '📱 KB+', zdroj: 'notifikace', notifBanka: 'kb', karta4: '1234',
    });
    // Číslo karty ani text notifikace se do transakce neukládá.
    expect(JSON.stringify(tx)).not.toContain('4111');
  });

  it('tatáž notifikace dá vždy totéž id (opakovaný zápis nevytvoří druhou transakci)', () => {
    const v = n('Platba kartou', '145,40 Kč  u obchodníka Penny Ostrava, 💳 VISA Classic 4111 11** **** 1234.');
    const r = parseNotifikace(v);
    if (r.stav !== 'platba') throw new Error();
    const a = vytvorTransakci(v, r.banka, r.platba, { catId: '' });
    const b = vytvorTransakci(v, r.banka, r.platba, { catId: '' });
    expect(a.id).toBe(b.id);
    expect(a.notifKlic).toBe(b.notifKlic);
    expect(Number.isSafeInteger(a.id)).toBe(true);
  });

  it('platba po půlnoci patří do místního dne, ne do UTC', () => {
    const v = { ...n('Platba kartou', '50,00 Kč  u obchodníka Penny Ostrava, 💳 VISA Classic 4111 11** **** 1234.'), cas: Date.parse('2026-10-17T00:30:00+02:00') };
    const r = parseNotifikace(v);
    if (r.stav !== 'platba') throw new Error();
    expect(vytvorTransakci(v, r.banka, r.platba, { catId: '', casovaZona: 'Europe/Prague' }).date).toBe('2026-10-17');
  });
});

describe('neznámá aplikace', () => {
  it('notifikace z aplikace, která není banka, se nečte', () => {
    expect(parseNotifikace({ balicek: 'com.whatsapp', titulek: 'Platba kartou', text: '100 Kč u obchodníka X', cas }).stav).toBe('nerozpoznano');
  });
  it('vlastní přiřazení balíčku k bance', () => {
    const r = parseNotifikace({ balicek: 'cz.kb.novaapp', titulek: 'Platba kartou', text: '100,00 Kč  u obchodníka Lidl Brno, 💳 VISA 4111 11** **** 1234.', cas }, { 'cz.kb.novaapp': 'kb' });
    expect(r.stav).toBe('platba');
  });
});
