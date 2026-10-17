import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { GoogleNeniNastavene, obnovitHeslo, prihlasit, prihlasitGoogle } from '../firebase';

export function Prihlaseni() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [heslo, setHeslo] = useState('');
  const [chyba, setChyba] = useState('');
  const [info, setInfo] = useState('');
  const [pracuji, setPracuji] = useState(false);

  async function akce(fn: () => Promise<void>, naChybu: (err: unknown) => string) {
    setChyba(''); setInfo(''); setPracuji(true);
    try { await fn(); } catch (err) { setChyba(naChybu(err)); } finally { setPracuji(false); }
  }

  const chybaEmailu = (err: unknown) => {
    const kod = (err as { code?: string }).code ?? '';
    return /invalid|wrong-password|user-not-found/.test(kod) ? t('prihlaseni.chybaUdaje') : t('prihlaseni.chybaObecna');
  };

  function odeslat(e: FormEvent) {
    e.preventDefault();
    void akce(() => prihlasit(email, heslo), chybaEmailu);
  }

  function google() {
    void akce(prihlasitGoogle, err => (err instanceof GoogleNeniNastavene ? t('prihlaseni.googleNenastaveno') : t('prihlaseni.googleZruseno')));
  }

  function zapomenute() {
    if (!email.trim()) { setChyba(t('prihlaseni.resetZadejEmail')); return; }
    void akce(async () => { await obnovitHeslo(email); setInfo(t('prihlaseni.resetOdeslan', { email: email.trim() })); }, chybaEmailu);
  }

  return (
    <div className="prihlaseni">
      <h1>{t('app.nazev')}</h1>
      <div className="karta">
        <h2>{t('prihlaseni.titulek')}</h2>
        <p className="tlumene">{t('prihlaseni.popis')}</p>
        <button className="google" onClick={google} disabled={pracuji}>{t('prihlaseni.google')}</button>
        <p className="oddelovac male tlumene">{t('prihlaseni.nebo')}</p>
        <form onSubmit={odeslat}>
          <label>
            {t('prihlaseni.email')}
            <input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required />
          </label>
          <label>
            {t('prihlaseni.heslo')}
            <input type="password" autoComplete="current-password" value={heslo} onChange={e => setHeslo(e.target.value)} required />
          </label>
          {chyba && <p className="chyba" role="alert">{chyba}</p>}
          {info && <p className="ok" role="status">{info}</p>}
          <button className="hlavni" type="submit" disabled={pracuji}>{t('prihlaseni.prihlasit')}</button>
        </form>
        <button className="odkaz" onClick={zapomenute} disabled={pracuji}>{t('prihlaseni.zapomenuteHeslo')}</button>
        <p className="tlumene male">{t('prihlaseni.zalozitUcet')}</p>
      </div>
    </div>
  );
}
