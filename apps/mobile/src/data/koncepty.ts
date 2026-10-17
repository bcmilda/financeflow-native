import { Preferences } from '@capacitor/preferences';

/**
 * Koncepty rozepsaných formulářů. Každá změna ve formuláři se průběžně uloží
 * do zařízení – po zavření appky, pádu nebo odchodu z obrazovky se nic neztratí
 * a formulář nabídne pokračování.
 */
export interface Koncept<T> {
  cas: number;
  hodnota: T;
}

const klic = (k: string) => `koncept:${k}`;

export async function nactiKoncept<T>(k: string): Promise<Koncept<T> | null> {
  const { value } = await Preferences.get({ key: klic(k) });
  if (!value) return null;
  try { return JSON.parse(value) as Koncept<T>; } catch { return null; }
}

export async function ulozKoncept<T>(k: string, hodnota: T): Promise<void> {
  await Preferences.set({ key: klic(k), value: JSON.stringify({ cas: Date.now(), hodnota }) });
}

export async function smazatKoncept(k: string): Promise<void> {
  await Preferences.remove({ key: klic(k) });
}
