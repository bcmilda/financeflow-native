import { Preferences } from '@capacitor/preferences';
import type { KodJazyka } from '@ff/i18n';

/**
 * Nastavení a místní historie v telefonu (Capacitor Preferences – na Androidu
 * SharedPreferences, v prohlížeči localStorage). Do Firebase se odsud nic neposílá.
 */
export interface Nastaveni {
  jazyk: KodJazyka | null;
  souhlasNotifikace: boolean;
  /** Balíčky aplikací, jejichž notifikace se čtou. */
  balicky: string[];
  /** Ručně přiřazené balíčky: balíček → id banky. */
  vlastniBalicky: Record<string, string>;
  /** `kb` nebo `kb:1234` (konkrétní karta) → id peněženky. */
  penezenky: Record<string, string>;
}

const VYCHOZI: Nastaveni = { jazyk: null, souhlasNotifikace: false, balicky: [], vlastniBalicky: {}, penezenky: {} };

export async function nactiNastaveni(): Promise<Nastaveni> {
  const { value } = await Preferences.get({ key: 'nastaveni' });
  if (!value) return { ...VYCHOZI };
  try { return { ...VYCHOZI, ...(JSON.parse(value) as Partial<Nastaveni>) }; }
  catch { return { ...VYCHOZI }; }
}

export async function ulozNastaveni(n: Nastaveni): Promise<void> {
  await Preferences.set({ key: 'nastaveni', value: JSON.stringify(n) });
}

// ── Historie zpracovaných notifikací (jen pro obrazovku „Z banky“) ──

export type StavPolozky = 'zapsano' | 'duplicita' | 'jinaMena' | 'zahozeno';

export interface PolozkaHistorie {
  klic: string;
  cas: number;
  stav: StavPolozky;
  typ: 'expense' | 'income';
  nazev: string;
  castka: number;
  mena: string;
  banka: string;
  karta4?: string;
  /** U duplicity: s čím se shoduje. */
  shodaNazev?: string;
  shodaDatum?: string;
  /** U duplicity / cizí měny: připravená transakce pro „Přesto přidat“. */
  tx?: unknown;
}

export interface Nerozpoznana {
  id: string;
  cas: number;
  balicek: string;
  titulek: string;
  text: string;
}

const MAX_HISTORIE = 100;
const MAX_NEROZPOZNANE = 50;
const NEROZPOZNANE_DNY = 30;

async function nactiPole<T>(klic: string): Promise<T[]> {
  const { value } = await Preferences.get({ key: klic });
  try { return value ? (JSON.parse(value) as T[]) : []; } catch { return []; }
}

export async function nactiHistorii(): Promise<PolozkaHistorie[]> {
  return nactiPole<PolozkaHistorie>('historie');
}

export async function ulozHistorii(h: PolozkaHistorie[]): Promise<void> {
  const serazeno = [...h].sort((a, b) => b.cas - a.cas).slice(0, MAX_HISTORIE);
  await Preferences.set({ key: 'historie', value: JSON.stringify(serazeno) });
}

export async function nactiNerozpoznane(ted = Date.now()): Promise<Nerozpoznana[]> {
  const limit = ted - NEROZPOZNANE_DNY * 86_400_000;
  return (await nactiPole<Nerozpoznana>('nerozpoznane')).filter(n => n.cas >= limit);
}

export async function ulozNerozpoznane(n: Nerozpoznana[]): Promise<void> {
  const serazeno = [...n].sort((a, b) => b.cas - a.cas).slice(0, MAX_NEROZPOZNANE);
  await Preferences.set({ key: 'nerozpoznane', value: JSON.stringify(serazeno) });
}
