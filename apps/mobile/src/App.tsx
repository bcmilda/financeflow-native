import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { User } from 'firebase/auth';
import { sledujUzivatele } from './firebase';
import { Prihlaseni } from './obrazovky/Prihlaseni';
import { ZBanky } from './obrazovky/ZBanky';
import { NastaveniNotifikaci } from './obrazovky/NastaveniNotifikaci';
import { NastaveniObrazovka } from './obrazovky/Nastaveni';

type Obrazovka = 'zBanky' | 'notifikace' | 'nastaveni';

export function App() {
  const { t } = useTranslation();
  const [uzivatel, setUzivatel] = useState<User | null | undefined>(undefined);
  const [obrazovka, setObrazovka] = useState<Obrazovka>('zBanky');

  useEffect(() => sledujUzivatele(setUzivatel), []);

  if (uzivatel === undefined) return <div className="stred">{t('app.nacitam')}</div>;
  if (!uzivatel) return <Prihlaseni />;

  return (
    <div className="appka">
      <header className="hlavicka">
        <h1>{t('app.nazev')}</h1>
      </header>
      <main className="obsah">
        {obrazovka === 'zBanky' && <ZBanky uid={uzivatel.uid} onNastavit={() => setObrazovka('notifikace')} />}
        {obrazovka === 'notifikace' && <NastaveniNotifikaci uid={uzivatel.uid} onHotovo={() => setObrazovka('zBanky')} />}
        {obrazovka === 'nastaveni' && <NastaveniObrazovka email={uzivatel.email ?? ''} />}
      </main>
      <nav className="spodni-menu">
        <button className={obrazovka !== 'nastaveni' ? 'aktivni' : ''} onClick={() => setObrazovka('zBanky')}>
          {t('app.nav.zBanky')}
        </button>
        <button className={obrazovka === 'nastaveni' ? 'aktivni' : ''} onClick={() => setObrazovka('nastaveni')}>
          {t('app.nav.nastaveni')}
        </button>
      </nav>
    </div>
  );
}
