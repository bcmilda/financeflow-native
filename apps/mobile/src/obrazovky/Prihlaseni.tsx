import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { prihlasit } from '../firebase';

export function Prihlaseni() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [heslo, setHeslo] = useState('');
  const [chyba, setChyba] = useState('');
  const [pracuji, setPracuji] = useState(false);

  async function odeslat(e: FormEvent) {
    e.preventDefault();
    setChyba('');
    setPracuji(true);
    try {
      await prihlasit(email, heslo);
    } catch (err) {
      const kod = (err as { code?: string }).code ?? '';
      setChyba(/invalid|wrong-password|user-not-found/.test(kod) ? t('prihlaseni.chybaUdaje') : t('prihlaseni.chybaObecna'));
    } finally {
      setPracuji(false);
    }
  }

  return (
    <div className="prihlaseni">
      <h1>{t('app.nazev')}</h1>
      <form className="karta" onSubmit={odeslat}>
        <h2>{t('prihlaseni.titulek')}</h2>
        <p className="tlumene">{t('prihlaseni.popis')}</p>
        <label>
          {t('prihlaseni.email')}
          <input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required />
        </label>
        <label>
          {t('prihlaseni.heslo')}
          <input type="password" autoComplete="current-password" value={heslo} onChange={e => setHeslo(e.target.value)} required />
        </label>
        {chyba && <p className="chyba" role="alert">{chyba}</p>}
        <button className="hlavni" type="submit" disabled={pracuji}>{t('prihlaseni.prihlasit')}</button>
        <p className="tlumene male">{t('prihlaseni.google')}</p>
      </form>
    </div>
  );
}
