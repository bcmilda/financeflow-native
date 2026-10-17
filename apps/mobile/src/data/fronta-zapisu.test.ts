import { describe, expect, it } from 'vitest';
import { FrontaZapisu, type Operace, type UlozisteFronty } from './fronta-zapisu';

function pametoveUloziste(start: Operace[] = []): UlozisteFronty & { stav: Operace[] } {
  const u = { stav: [...start], async nacist() { return [...u.stav]; }, async ulozit(o: Operace[]) { u.stav = [...o]; } };
  return u;
}
const pockej = () => new Promise(r => setTimeout(r, 0));

describe('fronta zápisů', () => {
  it('zápis se uloží do zařízení a po potvrzení serverem zmizí', async () => {
    const u = pametoveUloziste();
    let potvrd!: () => void;
    const f = new FrontaZapisu(u, () => new Promise<void>(r => { potvrd = r; }));
    await f.pridat({ typ: 'set', cesta: 'a', hodnota: 1 });
    expect(u.stav).toHaveLength(1);           // bez internetu zůstává uložený
    potvrd(); await pockej(); await pockej();
    expect(u.stav).toHaveLength(0);
  });

  it('po restartu se neodeslané zápisy pošlou znovu ve stejném pořadí', async () => {
    const u = pametoveUloziste([
      { id: '1', typ: 'set', cesta: 'a', hodnota: 1, cas: 1 },
      { id: '2', typ: 'remove', cesta: 'b', cas: 2 },
    ]);
    const poslane: string[] = [];
    const f = new FrontaZapisu(u, async op => { poslane.push(op.cesta); });
    expect(await f.prehrat()).toBe(2);
    await pockej(); await pockej(); await pockej();
    expect(poslane).toEqual(['a', 'b']);
    expect(u.stav).toHaveLength(0);
  });

  it('zápis odmítnutý serverem se z fronty odstraní (nezkouší se donekonečna)', async () => {
    const u = pametoveUloziste();
    const f = new FrontaZapisu(u, async () => { throw new Error('PERMISSION_DENIED'); });
    await f.pridat({ typ: 'update', cesta: 'x', hodnota: {} });
    await pockej(); await pockej();
    expect(u.stav).toHaveLength(0);
  });

  it('souběžné zápisy se nepřepíšou', async () => {
    const u = pametoveUloziste();
    const f = new FrontaZapisu(u, () => new Promise<void>(() => {}));   // server nikdy neodpoví
    await Promise.all([f.pridat({ typ: 'set', cesta: 'a' }), f.pridat({ typ: 'set', cesta: 'b' }), f.pridat({ typ: 'set', cesta: 'c' })]);
    expect(u.stav.map(o => o.cesta).sort()).toEqual(['a', 'b', 'c']);
  });
});
