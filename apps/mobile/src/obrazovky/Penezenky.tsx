import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { idPresunovychKategorii, pocetTransakciPenezenky, zustatekPenezenky, type Penezenka, type Tx } from '@ff/core';
import { formatDatum, type KodJazyka } from '@ff/i18n';
import { useSklad } from '../data/sklad';
import { Castka, razeniTx } from '../komponenty/spolecne';
import { SeznamPoDnech } from '../komponenty/seznam-transakci';

/** Ikony typů peněženek jako na webu (premium.js WALLET_TYPES). */
const IKONY: Record<string, string> = { cash: '💵', account: '🏦', savings: '🐷', investment: '📈', card: '💳', other: '📦' };
export const ikonaPenezenky = (w: Penezenka) => IKONY[w.type ?? ''] ?? '👛';

/** Popis typu, měny a počtu – typ jen když je zadaný (web bez typu ukáže jen 👛). */
function popisPenezenky(w: Penezenka, t: (k: string, o?: Record<string, unknown>) => string, pocet?: number): string {
  return [
    w.type && IKONY[w.type] ? t(`penezenky.typ.${w.type}`) : null,
    w.currency || 'CZK',
    pocet != null ? t('pocet.transakce', { n: pocet }) : null,
  ].filter(Boolean).join(' · ');
}

/** Seznam peněženek se zůstatky (klon stránky Peněženky webu, zatím bez úprav). */
export function Penezenky({ onDetail, onPresun }: { onDetail: (id: string) => void; onPresun: () => void }) {
  const { t } = useTranslation();
  const { data } = useSklad();
  const [archiv, setArchiv] = useState(false);
  const radky = useMemo(() => data.wallets.map(w => ({
    w, zustatek: zustatekPenezenky(w.id, data), pocet: pocetTransakciPenezenky(w.id, data),
  })), [data]);
  const aktivni = radky.filter(r => !r.w.archived);
  const archivovane = radky.filter(r => r.w.archived);

  const Radek = ({ r }: { r: (typeof radky)[number] }) => (
    <li>
      <button className="tx-radek" onClick={() => onDetail(r.w.id)}>
        <span className="tx-ikona" aria-hidden="true">{ikonaPenezenky(r.w)}</span>
        <span className="tx-info">
          <span className="nazev">{r.w.name}</span>
          <span className="male tlumene">{popisPenezenky(r.w, t, r.pocet)}</span>
        </span>
        <Castka castka={r.zustatek} mena={r.w.currency || 'CZK'} typ={r.zustatek < 0 ? 'expense' : undefined} znamenko={r.zustatek < 0} />
      </button>
    </li>
  );

  return (
    <div className="sloupec">
      <h2>{t('vice.penezenky')}</h2>
      {data.wallets.filter(w => !w.archived).length >= 2 && (
        <button className="hlavni" onClick={onPresun}>↔️ {t('presun.titulek')}</button>
      )}
      {aktivni.length === 0 && <p className="karta tlumene">{t('penezenky.zadne')}</p>}
      {aktivni.length > 0 && <section className="karta"><ul className="seznam">{aktivni.map(r => <Radek key={r.w.id} r={r} />)}</ul></section>}
      {archivovane.length > 0 && (
        <section className="karta">
          <button className="odkaz" aria-expanded={archiv} onClick={() => setArchiv(!archiv)}>
            {archiv ? '▾' : '▸'} {t('penezenky.archiv', { n: archivovane.length })}
          </button>
          {archiv && <ul className="seznam">{archivovane.map(r => <Radek key={r.w.id} r={r} />)}</ul>}
        </section>
      )}
      <p className="male tlumene">{t('penezenky.upravyNaWebu')}</p>
    </div>
  );
}

const PO_STRANKACH = 100;

/** Detail peněženky: zůstatek a všechny její transakce (napříč měsíci). */
export function DetailPenezenky({ id, onOtevrit, onPresun }: { id: string; onOtevrit: (t: Tx) => void; onPresun: (z: string) => void }) {
  const { t, i18n } = useTranslation();
  const { data } = useSklad();
  const [limit, setLimit] = useState(PO_STRANKACH);
  const w = data.wallets.find(x => x.id === id);
  const presunove = useMemo(() => idPresunovychKategorii(data), [data]);
  const txs = useMemo(() => data.transactions.filter(tx => tx.wallet === id).sort(razeniTx), [data, id]);
  if (!w) return <p className="karta tlumene">{t('penezenky.nenalezena')}</p>;
  const zustatek = zustatekPenezenky(id, data);

  return (
    <div className="sloupec">
      <section className="karta">
        <div className="radek">
          <h2>{ikonaPenezenky(w)} {w.name}</h2>
        </div>
        <p className="male tlumene">{popisPenezenky(w, t)}{w.archived ? ` · ${t('penezenky.archivovana')}` : ''}</p>
        <p className="velky-zustatek"><Castka castka={zustatek} mena={w.currency || 'CZK'} typ={zustatek < 0 ? 'expense' : undefined} znamenko={zustatek < 0} /></p>
        {w.balanceDate && <p className="male tlumene">{t('penezenky.zustatekKeDni', { datum: formatDatum(w.balanceDate, i18n.language as KodJazyka) })}</p>}
        {!w.archived && data.wallets.filter(x => !x.archived).length >= 2 && (
          <button onClick={() => onPresun(id)}>↔️ {t('presun.titulek')}</button>
        )}
      </section>
      <p className="male tlumene">{t('pocet.transakce', { n: txs.length })}</p>
      {txs.length === 0 && <p className="karta tlumene">{t('transakce.prazdne')}</p>}
      <SeznamPoDnech transakce={txs.slice(0, limit)} kategorie={data.categories} penezenky={data.wallets} presunove={presunove} onOtevrit={onOtevrit} sRokem />
      {txs.length > limit && <button onClick={() => setLimit(limit + PO_STRANKACH)}>{t('penezenky.dalsi')}</button>}
    </div>
  );
}
