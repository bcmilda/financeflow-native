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

type Zalozka = 'prehled' | 'transakce' | 'zBanky' | 'nastaveni';
const ZALOZKY: Zalozka[] = ['prehled', 'transakce', 'zBanky', 'nastaveni'];

/** Otevřený formulář: null = žádný, 'novy' = nová transakce, jinak upravovaná. */
type Formular = null | 'novy' | Tx;

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
  const [nastaveniNotifikaci, setNastaveniNotifikaci] = useState(false);
  const [formular, setFormular] = useState<Formular>(null);
  const [mesic, setMesic] = useState<Mesic>(dnesniMesic);
  const [smazana, setSmazana] = useState<Tx | null>(null);
  const casovacZpet = useRef<ReturnType<typeof setTimeout> | null>(null);

  const ukazZpet = useCallback((tx: Tx) => {
    setSmazana(tx);
    if (casovacZpet.current) clearTimeout(casovacZpet.current);
    casovacZpet.current = setTimeout(() => setSmazana(null), 6000);
  }, []);

  async function vratitSmazanou() {
    if (!smazana) return;
    await pridatTransakci(smazana);
    setSmazana(null);
  }

  // Systémové tlačítko Zpět (Android): formulář → seznam, jiná záložka → Přehled, jinak appku schovat.
  const stavRef = useRef({ formular, nastaveniNotifikaci, zalozka });
  stavRef.current = { formular, nastaveniNotifikaci, zalozka };
  useEffect(() => {
    const p = CapApp.addListener('backButton', () => {
      const s = stavRef.current;
      if (s.formular) setFormular(null);
      else if (s.nastaveniNotifikaci) setNastaveniNotifikaci(false);
      else if (s.zalozka !== 'prehled') setZalozka('prehled');
      else void CapApp.minimizeApp();
    });
    return () => { void p.then(h => h.remove()); };
  }, []);

  function prepni(z: Zalozka) {
    setFormular(null);
    setNastaveniNotifikaci(false);
    setZalozka(z);
    window.scrollTo(0, 0);
  }

  const otevrit = (tx: Tx) => { setFormular(tx); window.scrollTo(0, 0); };
  const ukazujeFab = !formular && (zalozka === 'prehled' || zalozka === 'transakce');

  return (
    <div className="appka">
      <header className="hlavicka">
        <h1>{t('app.nazev')}</h1>
        {(offline || cekajici > 0) && (
          <span className="stav-spojeni male" role="status">
            {[offline ? t('app.offline') : '', cekajici > 0 ? t('app.cekajici', { n: cekajici }) : ''].filter(Boolean).join(' · ')}
          </span>
        )}
      </header>
      <main className="obsah">
        {formular ? (
          <FormularTransakce key={formular === 'novy' ? 'novy' : String(formular.id)} tx={formular === 'novy' ? null : formular}
            onHotovo={() => setFormular(null)} onSmazano={ukazZpet} />
        ) : nastaveniNotifikaci ? (
          <NastaveniNotifikaci uid={uzivatel.uid} onHotovo={() => setNastaveniNotifikaci(false)} />
        ) : (
          <>
            {zalozka === 'prehled' && <Prehled mesic={mesic} onMesic={setMesic} onOtevrit={otevrit} onVse={() => prepni('transakce')} />}
            {zalozka === 'transakce' && <Transakce mesic={mesic} onMesic={setMesic} onOtevrit={otevrit} />}
            {zalozka === 'zBanky' && <ZBanky uid={uzivatel.uid} onNastavit={() => setNastaveniNotifikaci(true)} />}
            {zalozka === 'nastaveni' && <NastaveniObrazovka email={uzivatel.email ?? ''} />}
          </>
        )}
      </main>

      {ukazujeFab && (
        <button className="fab" aria-label={t('app.pridat')} onClick={() => { setFormular('novy'); window.scrollTo(0, 0); }}>+</button>
      )}

      {smazana && (
        <div className="toast" role="status">
          <span>{t('formular.smazano')}</span>
          <button onClick={() => void vratitSmazanou()}>{t('formular.zpet')}</button>
        </div>
      )}

      <nav className="spodni-menu">
        {ZALOZKY.map(z => (
          <button key={z} className={zalozka === z && !formular ? 'aktivni' : ''} onClick={() => prepni(z)}>
            {t(`app.nav.${z}`)}
          </button>
        ))}
      </nav>
    </div>
  );
}
