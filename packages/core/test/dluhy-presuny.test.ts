import { describe, expect, it } from 'vitest';
import {
  jePresun, kontext, mesicniSplatky, poSplatnosti, podilSplaceno, prijmy, pristiSplatka, souhrnMesice, vydaje,
  vytvorPresun, zaplacenoNaDluh, zbyvaCelkem, zkontrolovatPresun, zustatekPenezenky, idWebu, transakceMesice,
  type DataUzivatele, type ZadaniPresunu,
} from '../src';
import dluhy from './fixtures/dluhy-ukazka.json';
import ukazka from './fixtures/data-ukazka.json';

const DD = dluhy as unknown as DataUzivatele;
const d = (id: string) => DD.debts!.find(x => x.id === id)!;

describe('půjčky', () => {
  it('měsíční splátky: týdenní × 4,33, dvoutýdenní × 2,17, proměnná podle měsíce, splacená 0', () => {
    // 14250 + 900*4,33 + 500*2,17 + 1500 (od 2026-10) + 0 (splacená) + 300 (bez údaje o zbytku)
    expect(mesicniSplatky(DD, 2026, 9)).toBeCloseTo(14250 + 3897 + 1085 + 1500 + 300, 6);
  });
  it('proměnná splátka se mění podle měsíce', () => {
    const jen4 = { debts: [d('d4')] };
    expect(mesicniSplatky(jen4, 2026, 8)).toBe(1000);
    expect(mesicniSplatky(jen4, 2026, 11)).toBe(2000);
  });
  it('zbývá celkem', () => expect(zbyvaCelkem(DD)).toBe(2310000 + 12000 + 3000 + 18000));

  it('zaplaceno v appce: bez splátek dopředu (debtCeka) a bez rozdělených rodičů', () => {
    const k = kontext(DD);
    expect(zaplacenoNaDluh(d('d1'), DD, k)).toMatchObject({ soucet: 28500, pocet: 2 });
    expect(zaplacenoNaDluh(d('d2'), DD, k)).toMatchObject({ soucet: 900, pocet: 1 });
  });
  it('zaplaceno v cizí měně: zafixovaná částka v Kč, jinak kurz', () => {
    expect(zaplacenoNaDluh(d('d4'), DD, kontext(DD)).soucet).toBe(20 + 1000);
    expect(zaplacenoNaDluh(d('d4'), DD, kontext(DD, { EUR: 25 })).soucet).toBe(500 + 1000);
  });
  it('příští splátka a splátky po splatnosti', () => {
    expect(pristiSplatka(d('d1'))?.date).toBe('2026-10-20');
    expect(poSplatnosti(d('d2'), '2026-10-24')).toBe(2);
    expect(poSplatnosti(d('d1'), '2026-10-24')).toBe(1);
    expect(pristiSplatka(d('d3'))).toBeNull();
  });
  it('podíl splaceného', () => {
    expect(podilSplaceno(d('d3'))).toBe(0.5);
    expect(podilSplaceno(d('d5'))).toBe(1);
    expect(podilSplaceno(d('d6'))).toBeNull();
  });
});

describe('přesun mezi peněženkami', () => {
  const D = JSON.parse(JSON.stringify(ukazka)) as DataUzivatele;
  const texty = { odchozi: (c: string) => `Převod → ${c}`, prichozi: (z: string) => `Převod ← ${z}`, poznamka: 'Převod mezi peněženkami' };
  const zadani: ZadaniPresunu = { z: 'w1', do: 'w2', castka: 2500, datum: '2026-10-21', poznamka: '' };

  it('dvě transakce ve tvaru webu se společným transferId', () => {
    const [o, p] = vytvorPresun(zadani, D.wallets, texty, 1793000000000, () => 0.123456);
    expect(o).toMatchObject({ type: 'expense', amount: 2500, wallet: 'w1', name: 'Převod → Hotovost', category: 'transfer', note: 'Převod mezi peněženkami', date: '2026-10-21' });
    expect(p).toMatchObject({ type: 'income', amount: 2500, wallet: 'w2', name: 'Převod ← Běžný účet', category: 'transfer' });
    expect(o.transferId).toBe(p.transferId);
    expect(o.id).not.toBe(p.id);
    expect(String(o.id)).toMatch(/^id1793000000000[0-9a-z]{4}$/);
  });

  it('pohne zůstatky obou peněženek, ale příjmy ani výdaje ne', () => {
    const k = kontext(D);
    const pred = { w1: zustatekPenezenky('w1', D), w2: zustatekPenezenky('w2', D), s: souhrnMesice(D, 2026, 9) };
    const po: DataUzivatele = { ...D, transactions: [...D.transactions, ...vytvorPresun(zadani, D.wallets, texty, 1793000000000)] };
    expect(zustatekPenezenky('w1', po)).toBe(pred.w1 - 2500);
    expect(zustatekPenezenky('w2', po)).toBe(pred.w2 + 2500);
    const txs = transakceMesice(po, 2026, 9);
    expect(prijmy(txs, k)).toBe(pred.s.prijmy);
    expect(vydaje(txs, k)).toBe(pred.s.vydaje);
    expect(txs.filter(t => t.transferId && t.date === '2026-10-21').every(t => jePresun(t, k.presunove))).toBe(true);
  });

  it('různé měny: cílová peněženka dostane svou částku (web by zapsal stejné číslo)', () => {
    const z = { ...zadani, do: 'w3', castka: 2500, castkaCil: 100 };
    expect(zkontrolovatPresun({ ...z, castkaCil: undefined }, D.wallets)).toBe('castkaCil');
    const [, p] = vytvorPresun(z, D.wallets, texty, 1);
    expect(p.amount).toBe(100);
  });

  it('kontrola zadání', () => {
    expect(zkontrolovatPresun(zadani, D.wallets)).toBeNull();
    expect(zkontrolovatPresun({ ...zadani, do: 'w1' }, D.wallets)).toBe('stejne');
    expect(zkontrolovatPresun({ ...zadani, castka: 0 }, D.wallets)).toBe('castka');
    expect(zkontrolovatPresun({ ...zadani, z: 'neni' }, D.wallets)).toBe('penezenky');
    expect(zkontrolovatPresun({ ...zadani, datum: '' }, D.wallets)).toBe('datum');
  });

  it('id ve tvaru webu uid()', () => {
    expect(idWebu(1793000000000, () => 0.5)).toMatch(/^id1793000000000[0-9a-z]{4}$/);
  });
});
