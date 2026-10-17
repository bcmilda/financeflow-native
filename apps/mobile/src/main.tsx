import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';
import { jazykZarizeni, vytvorI18n } from '@ff/i18n';
import { App } from './App';
import { nactiNastaveni } from './uloziste';
import './styles.css';

async function start() {
  const n = await nactiNastaveni();
  const jazyk = n.jazyk ?? jazykZarizeni();
  const i18n = await vytvorI18n(jazyk);
  document.documentElement.lang = jazyk;
  const koren = document.getElementById('root');
  if (!koren) return;
  createRoot(koren).render(
    <StrictMode>
      <I18nextProvider i18n={i18n}>
        <App />
      </I18nextProvider>
    </StrictMode>,
  );
}

void start();
