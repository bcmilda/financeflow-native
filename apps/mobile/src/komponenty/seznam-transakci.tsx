import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { jePresun, type Kategorie, type Penezenka, type Tx } from '@ff/core';
import { localePro, type KodJazyka } from '@ff/i18n';
import { Castka, menaTx, useKategorie } from './spolecne';

/** Jeden řádek transakce (Přehled, Transakce, detail peněženky). */
export function TxRadek({ tx, kategorie, penezenky, presunove, onOtevrit }: {
  tx: Tx; kategorie: Kategorie[]; penezenky: Penezenka[]; presunove: Set<string>; onOtevrit: (t: Tx) => void;
}) {
  const { t } = useTranslation();
  const kat = useKategorie(kategorie);
  const presun = jePresun(tx, presunove);
  // Přesun mezi peněženkami nemá kategorii – místo „Bez kategorie“ ukázat „Přesun“.
  const znama = kategorie.some(c => c.id === tx.catId);
  const k = presun && !znama ? { ikona: '↔️', nazev: t('transakce.presunNazev') } : kat(tx.catId);
  return (
    <button className="tx-radek" onClick={() => onOtevrit(tx)}>
      <span className="tx-ikona" aria-hidden="true">{k.ikona}</span>
      <span className="tx-info">
        <span className="nazev">{tx.name || k.nazev}</span>
        <span className="male tlumene">
          {k.nazev}
          {presun && znama && <> · {t('transakce.presun')}</>}
          {tx.isBalancing && <> · {t('transakce.vyrovnani')}</>}
          {tx.splitParent && <> · {t('transakce.rozdeleno')}</>}
          {tx.zdroj === 'notifikace' && <> · {t('transakce.zNotifikace')}</>}
        </span>
      </span>
      <Castka castka={Number(tx.amount || tx.amt || 0)} mena={menaTx(tx, penezenky)} typ={presun ? undefined : tx.type} />
    </button>
  );
}

/** Transakce seskupené po dnech (seznam musí být seřazený). */
export function SeznamPoDnech({ transakce, kategorie, penezenky, presunove, onOtevrit, sRokem = false }: {
  transakce: Tx[]; kategorie: Kategorie[]; penezenky: Penezenka[]; presunove: Set<string>; onOtevrit: (t: Tx) => void; sRokem?: boolean;
}) {
  const { i18n } = useTranslation();
  const jazyk = i18n.language as KodJazyka;
  const dny = useMemo(() => {
    const m = new Map<string, Tx[]>();
    for (const tx of transakce) { const d = String(tx.date ?? '').slice(0, 10); m.set(d, [...(m.get(d) ?? []), tx]); }
    return [...m.entries()];
  }, [transakce]);
  const f = new Intl.DateTimeFormat(localePro(jazyk), { weekday: 'short', day: 'numeric', month: 'numeric', ...(sRokem ? { year: 'numeric' } : {}) });

  return (
    <>
      {dny.map(([den, txs]) => (
        <section key={den} className="karta den">
          <h3 className="den-nadpis">{f.format(new Date(`${den}T12:00:00`))}</h3>
          <ul className="seznam">
            {txs.map(tx => (
              <li key={String(tx.id)}>
                <TxRadek tx={tx} kategorie={kategorie} penezenky={penezenky} presunove={presunove} onOtevrit={onOtevrit} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
