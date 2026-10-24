import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { User } from 'firebase/auth';
import { App as CapApp } from '@capacitor/app';
import type { Tx } from '@ff/core';
import { sledujUzivatele } from './firebase';
import { odpojit, pridatTransakci, pripojit, useSklad } from './data/sklad';
import { dnesniMesic, type Mesic } from './komponenty/spolecne';
import { Prihlaseni } from './obrazovky/Prihlaseni';
import { Prehled } from './obrazovky/Prehled';
import { Transakce } from './obrazovky/Transakce';
import { FormularTransakce } from './obrazovky/FormularTransakce';
import { ZBanky } from './obrazovky/ZBanky';
import { NastaveniNotifikaci } from './obrazovky/NastaveniNotifikaci';
import { NastaveniObrazovka } from './obrazovky/Nastaveni';
import { Vice, type PolozkaVice } from './obrazovky/Vice';
import { DetailPenezenky, Penezenky } from './obrazovky/Penezenky';
import { DetailPresunu, Presun } from './obrazovky/Presun';
import { Kategorie } from './obrazovky/Kategorie';
import { Pujcky } from './obrazovky/Pujcky';

type Zalozka = 'prehled' | 'transakce' | 'zBanky' | 'vice';
const ZALOZKY: Zalozka[] = ['prehled', 'transakce', 'zBanky', 'vice'];

/**
 * Co je otevřené nad záložkou. Zpět (systémové tlačítko i po uložení) vede o úroveň výš:
 * formulář/detail → podstránka → záložka → Přehled.
 */
type Podstranka =
  | null
  | { typ: 'vice'; polozka: PolozkaVice }
  | { typ: 'penezenka'; id: string }
  | { typ: 'notifikace' };

/** Překryv nad vším: formulář transakce, nový přesun, detail přesunu. */
type Prekryv =
  | null
  | { typ: 'tx'; tx: Tx | null }
  | { typ: 'presun'; z: string | null }
  | { typ: 'detailPresunu'; transferId: string };

export function App() {
  const { t } = useTranslation();
  const [uzivatel, setUzivatel] = useState<User | null | undefined>(undefined);

  useEffect(() => sledujUzivatele(u => {
    setUzivatel(u);
    if (u) void pripojit(u.uid); else odpojit();
  }), []);

  if (uzivatel === undefined) return <div className="stred">{t('app.nacitam')}</div>;
  if (!uzivatel) return <Prihlaseni />;
  return <Prihlaseny uzivatel={uzivatel} />;
}

export function Prihlaseny({ uzivatel }: { uzivatel: Pick<User, 'uid' | 'email'> }) {
  const { t } = useTranslation();
  const { pripojeno, cekajici } = useSklad();
  // „Bez připojení“ ukázat až po chvíli – při startu se spojení teprve navazuje.
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    if (pripojeno) { setOffline(false); return; }
    const id = setTimeout(() => setOffline(true), 3000);
    return () => clearTimeout(id);
  }, [pripojeno]);
  const [zalozka, setZalozka] = useState<Zalozka>('prehled');
  const [podstranka, setPodstranka] = useState<Podstranka>(null);
  const [prekryv, setPrekryv] = useState<Prekryv>(null);
  const [mesic, setMesic] = useState<Mesic>(dnesniMesic);
  const [filtrKategorie, setFiltrKategorie] = useState<string | null>(null);
  const [smazane, setSmazane] = useState<Tx[]>([]);
  const casovacZpet = useRef<ReturnType<typeof setTimeout> | null>(null);

  const ukazZpet = useCallback((txs: Tx[]) => {
    if (!txs.length) return;
    setSmazane(txs);
    if (casovacZpet.current) clearTimeout(casovacZpet.current);
    casovacZpet.current = setTimeout(() => setSmazane([]), 6000);
  }, []);

  async function vratitSmazane() {
    const k = smazane;
    setSmazane([]);
    for (const tx of k) await pridatTransakci(tx);
  }

  const nahoru = () => window.scrollTo(0, 0);

  /** O úroveň zpět. Vrací false, když už není kam (appka se schová). */
  const zpet = useCallback((): boolean => {
    if (prekryv) { setPrekryv(null); return true; }
    if (podstranka?.typ === 'penezenka') { setPodstranka({ typ: 'vice', polozka: 'penezenky' }); return true; }
    if (podstranka) { setPodstranka(null); return true; }
    if (filtrKategorie && zalozka === 'transakce') { setFiltrKategorie(null); setZalozka('vice'); setPodstranka({ typ: 'vice', polozka: 'kategorie' }); return true; }
    if (zalozka !== 'prehled') { setZalozka('prehled'); return true; }
    return false;
  }, [prekryv, podstranka, zalozka, filtrKategorie]);

  const zpetRef = useRef(zpet);
  zpetRef.current = zpet;
  useEffect(() => {
    const p = CapApp.addListener('backButton', () => { if (!zpetRef.current()) void CapApp.minimizeApp(); });
    return () => { void p.then(h => h.remove()); };
  }, []);

  function prepni(z: Zalozka) {
    setPrekryv(null);
    setPodstranka(null);
    if (z !== 'transakce') setFiltrKategorie(null);
    setZalozka(z);
    nahoru();
  }

  /** Transakce z přesunu se otevírá jako celý přesun (obě strany), ostatní ve formuláři. */
  const otevrit = (tx: Tx) => {
    setPrekryv(tx.transferId ? { typ: 'detailPresunu', transferId: String(tx.transferId) } : { typ: 'tx', tx });
    nahoru();
  };

  function obsah() {
    if (prekryv?.typ === 'tx') {
      return <FormularTransakce key={prekryv.tx ? String(prekryv.tx.id) : 'novy'} tx={prekryv.tx}
        onHotovo={() => setPrekryv(null)} onSmazano={tx => ukazZpet([tx])} />;
    }
    if (prekryv?.typ === 'presun') return <Presun z={prekryv.z} onHotovo={() => setPrekryv(null)} />;
    if (prekryv?.typ === 'detailPresunu') {
      return <DetailPresunu transferId={prekryv.transferId} onHotovo={() => setPrekryv(null)} onSmazano={ukazZpet} />;
    }
    if (podstranka?.typ === 'notifikace') return <NastaveniNotifikaci uid={uzivatel.uid} onHotovo={() => setPodstranka(null)} />;
    if (podstranka?.typ === 'penezenka') {
      return <DetailPenezenky id={podstranka.id} onOtevrit={otevrit} onPresun={z => { setPrekryv({ typ: 'presun', z }); nahoru(); }} />;
    }
    if (podstranka?.typ === 'vice') {
      switch (podstranka.polozka) {
        case 'penezenky':
          return <Penezenky onDetail={id => { setPodstranka({ typ: 'penezenka', id }); nahoru(); }} onPresun={() => { setPrekryv({ typ: 'presun', z: null }); nahoru(); }} />;
        case 'kategorie':
          return <Kategorie mesic={mesic} onMesic={setMesic} onOtevrit={catId => { setFiltrKategorie(catId); setPodstranka(null); setZalozka('transakce'); nahoru(); }} />;
        case 'pujcky': return <Pujcky />;
        case 'nastaveni': return <NastaveniObrazovka email={uzivatel.email ?? ''} />;
      }
    }
    switch (zalozka) {
      case 'prehled': return <Prehled mesic={mesic} onMesic={setMesic} onOtevrit={otevrit} onVse={() => prepni('transakce')} />;
      case 'transakce':
        return <Transakce mesic={mesic} onMesic={setMesic} onOtevrit={otevrit} kategorie={filtrKategorie} onZrusitKategorii={() => setFiltrKategorie(null)} />;
      case 'zBanky': return <ZBanky uid={uzivatel.uid} onNastavit={() => setPodstranka({ typ: 'notifikace' })} />;
      case 'vice': return <Vice onOtevrit={p => { setPodstranka({ typ: 'vice', polozka: p }); nahoru(); }} />;
    }
  }

  const ukazujeFab = !prekryv && !podstranka && (zalozka === 'prehled' || zalozka === 'transakce');
  const ukazujeZpet = !!prekryv || !!podstranka;

  return (
    <div className="appka">
      <header className="hlavicka">
        <div className="hlavicka-levo">
          {ukazujeZpet && <button className="ikona zpet" aria-label={t('app.zpet')} onClick={() => { zpet(); nahoru(); }}>‹</button>}
          <h1>{t('app.nazev')}</h1>
        </div>
        {(offline || cekajici > 0) && (
          <span className="stav-spojeni male" role="status">
            {[offline ? t('app.offline') : '', cekajici > 0 ? t('app.cekajici', { n: cekajici }) : ''].filter(Boolean).join(' · ')}
          </span>
        )}
      </header>
      <main className="obsah">{obsah()}</main>

      {ukazujeFab && (
        <button className="fab" aria-label={t('app.pridat')} onClick={() => { setPrekryv({ typ: 'tx', tx: null }); nahoru(); }}>+</button>
      )}

      {smazane.length > 0 && (
        <div className="toast" role="status">
          <span>{smazane.length > 1 ? t('presun.smazan') : t('formular.smazano')}</span>
          <button onClick={() => void vratitSmazane()}>{t('formular.zpet')}</button>
        </div>
      )}

      <nav className="spodni-menu">
        {ZALOZKY.map(z => (
          <button key={z} className={zalozka === z && !prekryv && !podstranka ? 'aktivni' : ''} onClick={() => prepni(z)}>
            {t(`app.nav.${z}`)}
          </button>
        ))}
      </nav>
    </div>
  );
}
