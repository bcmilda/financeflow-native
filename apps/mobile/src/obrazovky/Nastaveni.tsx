import { useTranslation } from 'react-i18next';
import { JAZYKY, REGIONY, type KodJazyka } from '@ff/i18n';
import { odhlasit } from '../firebase';
import { nactiNastaveni, ulozNastaveni } from '../uloziste';

declare const __VERZE__: string;

export function NastaveniObrazovka({ email }: { email: string }) {
  const { t, i18n } = useTranslation();

  async function zmenitJazyk(kod: KodJazyka) {
    await i18n.changeLanguage(kod);
    document.documentElement.lang = kod;
    await ulozNastaveni({ ...(await nactiNastaveni()), jazyk: kod });
  }

  return (
    <div className="sloupec">
      <h2>{t('nastaveni.titulek')}</h2>
      <section className="karta">
        <label>
          {t('nastaveni.jazyk')}
          <select value={i18n.language} onChange={e => void zmenitJazyk(e.target.value as KodJazyka)}>
            {JAZYKY.map(j => <option key={j.kod} value={j.kod}>{j.nazev}</option>)}
          </select>
        </label>
        <label>
          {t('nastaveni.region')}
          <select value="CZ" disabled>
            {REGIONY.map(r => <option key={r.kod} value={r.kod}>{t(`nastaveni.region${r.kod}`)}</option>)}
          </select>
        </label>
      </section>
      <section className="karta">
        <h3>{t('nastaveni.ucet')}</h3>
        <p className="tlumene">{email}</p>
        <button className="vedlejsi" onClick={() => void odhlasit()}>{t('nastaveni.odhlasit')}</button>
      </section>
      <p className="tlumene male stred-text">{t('nastaveni.verze', { verze: __VERZE__ })}</p>
    </div>
  );
}
