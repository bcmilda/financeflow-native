import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { bezDiakritiky, type Kategorie, type Penezenka, type Tx } from '@ff/core';
import { formatCastka, localePro, type KodJazyka } from '@ff/i18n';

export interface Mesic { rok: number; mesic: number }

export function dnesniMesic(): Mesic {
  const d = new Date();
  return { rok: d.getFullYear(), mesic: d.getMonth() };
}

export function posunMesic(m: Mesic, o: number): Mesic {
  const d = new Date(m.rok, m.mesic + o, 1);
  return { rok: d.getFullYear(), mesic: d.getMonth() };
}

function velkePrvni(s: string): string {
  return s.charAt(0).toLocaleUpperCase() + s.slice(1);
}

export function nazevMesice(m: Mesic, jazyk: KodJazyka): string {
  return velkePrvni(new Intl.DateTimeFormat(localePro(jazyk), { month: 'long', year: 'numeric' }).format(new Date(m.rok, m.mesic, 1)));
}

export function VyberMesice({ mesic, onZmena }: { mesic: Mesic; onZmena: (m: Mesic) => void }) {
  const { t, i18n } = useTranslation();
  return (
    <div className="vyber-mesice">
      <button className="ikona" aria-label={t('mesic.predchozi')} onClick={() => onZmena(posunMesic(mesic, -1))}>‹</button>
      <span>{nazevMesice(mesic, i18n.language as KodJazyka)}</span>
      <button className="ikona" aria-label={t('mesic.dalsi')} onClick={() => onZmena(posunMesic(mesic, 1))}>›</button>
    </div>
  );
}

export interface InfoKategorie { ikona: string; nazev: string; barva: string }

/** Kategorie transakce pro zobrazení. Bez kategorie = přeložený popisek. */
export function useKategorie(kategorie: Kategorie[]) {
  const { t } = useTranslation();
  return useCallback((catId: string | undefined): InfoKategorie => {
    const c = catId ? kategorie.find(k => k.id === catId) : undefined;
    if (!c) return { ikona: '❓', nazev: t('kategorie.bez'), barva: '#94a3b8' };
    return { ikona: c.icon || '📦', nazev: c.name, barva: c.color || '#60a5fa' };
  }, [kategorie, t]);
}

export function Castka({ castka, mena = 'CZK', typ, znamenko = true }: { castka: number; mena?: string; typ?: string; znamenko?: boolean }) {
  const { i18n } = useTranslation();
  const z = !znamenko ? '' : typ === 'income' ? '+' : typ === 'expense' ? '−' : '';
  return <span className={`castka ${typ ?? ''}`}>{z}{formatCastka(Math.abs(castka), mena, i18n.language as KodJazyka)}</span>;
}

/** Měna transakce = měna peněženky (web: popisek částky je v měně peněženky). */
export function menaTx(t: Tx, penezenky: Penezenka[]): string {
  const w = t.wallet ? penezenky.find(p => p.id === t.wallet) : undefined;
  return w?.currency || 'CZK';
}

export function obsahujeText(t: Tx, hledat: string, nazevKategorie: string): boolean {
  if (!hledat.trim()) return true;
  const h = bezDiakritiky(hledat.trim());
  return [t.name, t.note, nazevKategorie, t.subcat].some(x => typeof x === 'string' && bezDiakritiky(x).includes(h));
}

/** Řazení jako ve webu: nejnovější datum první, v rámci dne novější zápis první. */
export function razeniTx(a: Tx, b: Tx): number {
  const d = String(b.date ?? '').localeCompare(String(a.date ?? ''));
  if (d) return d;
  return Number(b.id) - Number(a.id) || 0;
}
