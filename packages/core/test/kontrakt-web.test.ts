import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import {
  kontext, mesicniSplatky, prijmy, skutecnost, transakceMesice, vydaje, vytvorPresun, zaplacenoNaDluh, zustatekCelkem, zustatekPenezenky,
  type DataUzivatele,
} from '../src';
import ukazka from './fixtures/data-ukazka.json';
import dluhyUkazka from './fixtures/dluhy-ukazka.json';

/**
 * KONTRAKTNÍ TEST: stejná data přes kód WEBU i přes tento modul → musí vyjít totéž.
 *
 * Potřebuje vedle sebe naklonovaný web (bcmilda/financeflow). Cesta:
 * proměnná WEB_REPO, jinak ../../../bcmilda/financeflow vůči repu. Bez webu se přeskočí.
 * Z webu se vytáhnou jen čisté funkce (bez DOM) a spustí se v izolovaném prostoru.
 */
const WEB = process.env.WEB_REPO ?? join(__dirname, '../../../../bcmilda/financeflow');
const maWeb = existsSync(join(WEB, 'js/helpers.js'));

/** Vyřízne deklaraci funkce/konstanty ze zdrojáku podle párování složených závorek. */
function vyrizni(zdroj: string, jmeno: string): string {
  const re = new RegExp(`(^|\\n)(function ${jmeno}\\s*\\(|const ${jmeno}\\s*=)`);
  const m = re.exec(zdroj);
  if (!m) throw new Error(`Ve webu chybí ${jmeno}`);
  const start = m.index + m[1]!.length;
  const prvni = zdroj.indexOf('{', start);
  const strednik = zdroj.indexOf(';', start);
  // Jednořádková šipková funkce bez bloku (isTransferTx, incSum…)
  if (strednik !== -1 && (prvni === -1 || strednik < prvni || zdroj.slice(start, strednik).includes('=>') && !zdroj.slice(start, strednik).includes('{'))) {
    const konecRadku = zdroj.indexOf('\n', start);
    return zdroj.slice(start, konecRadku === -1 ? undefined : konecRadku);
  }
  let hloubka = 0;
  for (let i = prvni; i < zdroj.length; i++) {
    if (zdroj[i] === '{') hloubka++;
    else if (zdroj[i] === '}' && --hloubka === 0) {
      const konecRadku = zdroj.indexOf('\n', i);
      return zdroj.slice(start, konecRadku === -1 ? undefined : konecRadku);
    }
  }
  throw new Error(`Nepárové závorky u ${jmeno}`);
}

describe.skipIf(!maWeb)('kontrakt s webem (financeflow v11.x)', () => {
  const D = JSON.parse(JSON.stringify(ukazka)) as DataUzivatele;
  const helpers = maWeb ? readFileSync(join(WEB, 'js/helpers.js'), 'utf8') : '';
  const premium = maWeb ? readFileSync(join(WEB, 'js/premium.js'), 'utf8') : '';
  const debts = maWeb ? readFileSync(join(WEB, 'js/debts.js'), 'utf8') : '';
  const kod = [
    ...['getTx', 'isTransferTx', 'txCZK', 'incSum', 'expSum', 'getActual', 'computeBank', 'computeMonthlyDebtPayments'].map(j => vyrizni(helpers, j)),
    vyrizni(debts, 'computeDebtPaid'),
    ...['findWallet', '_txVytvorenoMs', '_walletTxPoStavu', '_walletTxZnak', 'computeWalletBalance'].map(j => vyrizni(premium, j)),
    'globalThis.web = { getTx, incSum, expSum, getActual, computeBank, computeWalletBalance, computeMonthlyDebtPayments, computeDebtPaid };',
  ].join('\n');

  const webData = JSON.parse(JSON.stringify(ukazka));
  const prostor: Record<string, unknown> = {
    window: { _transferCatIds: new Set(webData.categories.filter((c: { type: string }) => c.type === 'transfer').map((c: { id: string }) => c.id)) },
    S: { curMonth: 9, curYear: 2026, wallets: webData.wallets },
    getData: () => webData,
    Date, Set, Math, isFinite, String, Number,
  };
  if (maWeb) vm.runInNewContext(kod, prostor);
  const web = prostor.web as {
    getTx: (m: number, y: number, d: unknown) => unknown[];
    incSum: (t: unknown[], d: unknown) => number; expSum: (t: unknown[], d: unknown) => number;
    getActual: (c: string, s: null, m: number, y: number, d: unknown, typ?: string) => number;
    computeBank: (d: unknown) => number; computeWalletBalance: (w: string, d: unknown) => number;
    computeMonthlyDebtPayments: (d: unknown) => number;
    computeDebtPaid: (dluh: unknown, d: unknown) => { paidSum: number; count: number };
  };
  const k = kontext(D);

  it.each([[2026, 8], [2026, 9], [2026, 10]])('příjmy a výdaje %i-%i', (rok, mesic) => {
    const tw = web.getTx(mesic, rok, webData);
    const tn = transakceMesice(D, rok, mesic);
    expect(tn.length).toBe(tw.length);
    expect(prijmy(tn, k)).toBe(web.incSum(tw, webData));
    expect(vydaje(tn, k)).toBe(web.expSum(tw, webData));
  });

  it.each(['cat1', 'cat2', 'cat7', 'cat9', 'cat_t_reserve'])('kategorie %s (výdaje i příjmy)', cat => {
    expect(skutecnost(D, cat, 2026, 9, k)).toBe(web.getActual(cat, null, 9, 2026, webData));
    expect(skutecnost(D, cat, 2026, 9, k, 'income')).toBe(web.getActual(cat, null, 9, 2026, webData, 'income'));
  });

  it('zůstatek celkem (computeBank)', () => {
    expect(zustatekCelkem(D, 2026, 9, k)).toBe(web.computeBank(webData));
  });

  it.each(['w1', 'w2', 'w3'])('zůstatek peněženky %s', w => {
    expect(zustatekPenezenky(w, D)).toBe(web.computeWalletBalance(w, webData));
  });

  // ── Půjčky (web v12.01–v12.02) ──
  it.each([[2026, 8], [2026, 9], [2026, 11]])('měsíční splátky půjček %i-%i (computeMonthlyDebtPayments)', (rok, mesic) => {
    const S = prostor.S as { curMonth: number; curYear: number };
    const puvodni = { m: S.curMonth, y: S.curYear };
    S.curMonth = mesic; S.curYear = rok;
    try {
      const dw = JSON.parse(JSON.stringify(dluhyUkazka));
      expect(mesicniSplatky(dluhyUkazka as unknown as DataUzivatele, rok, mesic)).toBeCloseTo(web.computeMonthlyDebtPayments(dw), 9);
    } finally { S.curMonth = puvodni.m; S.curYear = puvodni.y; }
  });

  it.each(['d1', 'd2', 'd3', 'd4'])('zaplaceno na půjčku %s (computeDebtPaid)', id => {
    const dn = dluhyUkazka as unknown as DataUzivatele;
    const dw = JSON.parse(JSON.stringify(dluhyUkazka));
    const n = zaplacenoNaDluh(dn.debts!.find(x => x.id === id)!, dn, kontext(dn));
    const w = web.computeDebtPaid(dw.debts.find((x: { id: string }) => x.id === id), dw);
    expect(n.soucet).toBe(w.paidSum);
    expect(n.pocet).toBe(w.count);
  });

  // ── Přesun vytvořený nativní appkou, spočítaný webem ──
  it('přesun z nativní appky: web spočítá stejné zůstatky i součty', () => {
    const texty = { odchozi: (c: string) => `Převod → ${c}`, prichozi: (z: string) => `Převod ← ${z}`, poznamka: 'Převod mezi peněženkami' };
    const par = vytvorPresun({ z: 'w1', do: 'w2', castka: 2500, datum: '2026-10-21', poznamka: '' }, D.wallets, texty, 1793000000000);
    const dn: DataUzivatele = { ...D, transactions: [...D.transactions, ...par] };
    const dw = JSON.parse(JSON.stringify(dn));
    for (const w of ['w1', 'w2']) expect(zustatekPenezenky(w, dn)).toBe(web.computeWalletBalance(w, dw));
    const tw = web.getTx(9, 2026, dw);
    expect(prijmy(transakceMesice(dn, 2026, 9), k)).toBe(web.incSum(tw, dw));
    expect(vydaje(transakceMesice(dn, 2026, 9), k)).toBe(web.expSum(tw, dw));
    expect(zustatekCelkem(dn, 2026, 9, k)).toBe(web.computeBank(dw));
  });
});
