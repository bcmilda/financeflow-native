import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // Jiný balíček než dnešní webová appka v Google Play (cz.financeflow.app – TWA),
  // aby mohly běžet vedle sebe. Až nativní appka web nahradí, rozhodne se, jestli
  // převezme cz.financeflow.app (aktualizace stejné appky v Play).
  appId: 'cz.financeflow.nativni',
  appName: 'FinanceFlow',
  webDir: 'dist',
  plugins: {
    // Přihlášení přes Google (Credential Manager). Ostatní poskytovatele nebalit.
    SocialLogin: {
      providers: { google: true, facebook: false, apple: false, twitter: false },
      logLevel: 1,
    },
  },
  android: {
    // Ladění WebView jen v debug buildu.
    webContentsDebuggingEnabled: false,
  },
};

export default config;
