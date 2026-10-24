import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { idPresunovychKategorii, souhrnMesice, transakceMesice, vydajePodleKategorii, zustatekPenezenky, type Tx } from '@ff/core';
import { localePro, type KodJazyka } from '@ff/i18n';
import { useSklad } from '../data/sklad';
import { Castka, razeniTx, useKategorie, VyberMesice, type Mesic } from '../komponenty/spolecne';
import { TxRadek } from '../komponenty/seznam-transakci';

/**
 * Přehled měsíce – klon Dashboardu webu (souhrnné karty, výdaje podle kategorií,
 * poslední transakce) + zůstatky peněženek. Čísla počítá @ff/core stejně jako web.
 */
export function Prehled({ mesic, onMesic, onOtevrit, onVse }: {
  mesic: Mesic; onMesic: (m: Mesic) => void; onOtevrit: (t: Tx) => void; onVse: () => void;
}) {
  const { t, i18n } = useTranslation();
  const jazyk = i18n.language as KodJazyka;
  const { data, nacteno } = useSklad();
  const kat = useKategorie(data.categories);

  const souhrn = useMemo(() => souhrnMesice(data, mesic.rok, mesic.mesic), [data, mesic]);
  const podleKategorii = useMemo(() => vydajePodleKategorii(data, mesic.rok, mesic.mesic), [data, mesic]);
  const presunove = useMemo(() => idPresunovychKategorii(data), [data]);
  const posledni = useMemo(() => [...transakceMesice(data, mesic.rok, mesic.mesic)].sort(razeniTx).slice(0, 5), [data, mesic]);
  const penezenky = useMemo(
    () => data.wallets.filter(w => !w.archived).map(w => ({ w, zustatek: zustatekPenezenky(w.id, data) })),
    [data],
  );

  const zmena = souhrn.zmenaVydaju === null ? null
    : new Intl.NumberFormat(localePro(jazyk), { style: 'percent', signDisplay: 'exceptZero' }).format(souhrn.zmenaVydaju / 100);
  const nejvic = podleKategorii[0]?.celkem ?? 0;

  return (
    <div className="sloupec">
      <VyberMesice mesic={mesic} onZmena={onMesic} />

      {nacteno && souhrn.pocetTransakci === 0 && <p className="karta tlumene">{t('prehled.prazdnyMesic')}</p>}

      <section className="mrizka-karet">
        <div className="karta stat">
          <span className="stat-popis">{t('prehled.prijmy')}</span>
          <Castka castka={souhrn.prijmy} typ="income" znamenko={false} />
          {souhrn.minulePrijmy > 0 && <span className="male tlumene">{t('prehled.minule')} <Castka castka={souhrn.minulePrijmy} znamenko={false} /></span>}
        </div>
        <div className="karta stat">
          <span className="stat-popis">{t('prehled.vydaje')}</span>
          <Castka castka={souhrn.vydaje} typ="expense" znamenko={false} />
          {zmena && (
            <span className={`male ${souhrn.zmenaVydaju! > 0 ? 'vydaj-text' : 'prijem-text'}`}>
              {t('prehled.zmenaVydaju', { pct: zmena })}
            </span>
          )}
        </div>
        <div className="karta stat">
          <span className="stat-popis">{t('prehled.bilance')}</span>
          <Castka castka={souhrn.bilance} typ={souhrn.bilance >= 0 ? 'income' : 'expense'} />
        </div>
        <div className="karta stat">
          <span className="stat-popis">{t('prehled.zustatek')}</span>
          <Castka castka={souhrn.zustatek} znamenko={false} />
        </div>
        {souhrn.dluhy > 0 && (
          <div className="karta stat">
            <span className="stat-popis">{t('prehled.dluhy')}</span>
            <Castka castka={souhrn.dluhy} typ="expense" znamenko={false} />
          </div>
        )}
      </section>

      <section className="karta">
        <h2>{t('prehled.kategorie')}</h2>
        {podleKategorii.length === 0 && <p className="tlumene">{t('prehled.zadneVydaje')}</p>}
        <ul className="seznam">
          {podleKategorii.map(p => {
            const k = kat(p.catId);
            const podil = souhrn.vydaje > 0 ? p.celkem / souhrn.vydaje : 0;
            return (
              <li key={p.catId || '_bez'} className="kategorie-radek">
                <div className="radek">
                  <span className="nazev">{k.ikona} {k.nazev}</span>
                  <span>
                    <Castka castka={p.celkem} znamenko={false} />
                    <span className="male tlumene"> · {new Intl.NumberFormat(localePro(jazyk), { style: 'percent' }).format(podil)}</span>
                  </span>
                </div>
                <div className="pruh" aria-hidden="true">
                  <div style={{ width: `${nejvic > 0 ? (p.celkem / nejvic) * 100 : 0}%`, background: k.barva }} />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="karta">
        <div className="radek">
          <h2>{t('prehled.posledni')}</h2>
          {posledni.length > 0 && <button className="odkaz" onClick={onVse}>{t('prehled.vse')}</button>}
        </div>
        {posledni.length === 0 && <p className="tlumene">{t('transakce.prazdne')}</p>}
        <ul className="seznam">
          {posledni.map(tx => (
            <li key={String(tx.id)}>
              <TxRadek tx={tx} kategorie={data.categories} penezenky={data.wallets} presunove={presunove} onOtevrit={onOtevrit} />
            </li>
          ))}
        </ul>
      </section>

      {penezenky.length > 0 && (
        <section className="karta">
          <h2>{t('prehled.penezenky')}</h2>
          <ul className="seznam">
            {penezenky.map(({ w, zustatek }) => (
              <li key={w.id} className="radek">
                <span className="nazev">{w.name}</span>
                <Castka castka={zustatek} mena={w.currency || 'CZK'} typ={zustatek < 0 ? 'expense' : undefined} znamenko={zustatek < 0} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
