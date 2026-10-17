import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';

/** Notifikace zachycená v telefonu, čeká ve frontě, dokud ji appka nezpracuje. */
export interface ZachycenaNotifikace {
  id: string;
  balicek: string;
  titulek: string;
  text: string;
  cas: number;
}

export interface StavCteni {
  android: boolean;
  /** Uživatel povolil „Přístup k oznámením“. */
  pristup: boolean;
  /** Appka je vyjmutá z úspory baterie. */
  baterie: boolean;
}

/**
 * Most k nativnímu modulu (android/app/src/main/java/cz/financeflow/nativni/).
 * Nativní služba ukládá notifikace vybraných bankovních aplikací do fronty v telefonu.
 * Z fronty se položka smaže, až když ji appka potvrdí (= zapsala nebo vyhodnotila),
 * takže se nic neztratí ani při pádu appky nebo bez internetu.
 */
export interface BankovniNotifikacePlugin {
  stav(): Promise<StavCteni>;
  otevritPristup(): Promise<void>;
  otevritBaterii(): Promise<void>;
  nastavitBanky(o: { balicky: string[] }): Promise<void>;
  vyzvednout(): Promise<{ polozky: ZachycenaNotifikace[] }>;
  potvrdit(o: { ids: string[] }): Promise<void>;
  spustitPruzkum(o: { minut: number }): Promise<void>;
  vysledekPruzkumu(): Promise<{ do: number; aplikace: { balicek: string; nazev: string }[] }>;
  addListener(udalost: 'notifikace', cb: () => void): Promise<PluginListenerHandle>;
}

/** Prohlížeč / iPhone: nativní modul není, appka ukáže vyzkoušení textu. */
const bezNativu: BankovniNotifikacePlugin = {
  stav: async () => ({ android: false, pristup: false, baterie: false }),
  otevritPristup: async () => {},
  otevritBaterii: async () => {},
  nastavitBanky: async () => {},
  vyzvednout: async () => ({ polozky: [] }),
  potvrdit: async () => {},
  spustitPruzkum: async () => {},
  vysledekPruzkumu: async () => ({ do: 0, aplikace: [] }),
  addListener: async () => ({ remove: async () => {} }),
};

export const BankovniNotifikace: BankovniNotifikacePlugin =
  Capacitor.getPlatform() === 'android'
    ? registerPlugin<BankovniNotifikacePlugin>('BankovniNotifikace')
    : bezNativu;
