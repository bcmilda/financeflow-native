/**
 * Odhad kategorie podle obchodníka. Převzato z webu (`sms-import.js` MERCHANT_CATEGORIES),
 * s opravou: web hledal podřetězec, takže „mcdonald“ obsahuje „cd“ a padal do Dopravy.
 * Tady se klíč musí shodovat se začátkem slova.
 *
 * Id kategorií odpovídají výchozím kategoriím webu (cat1 Jídlo a nákupy, cat2 Doprava,
 * cat3 Bydlení, cat4 Zdraví, cat5 Zábava). Appka před zápisem ověří, že kategorie
 * u uživatele existuje – jinak nechá kategorii prázdnou.
 */
const SLOVNIK: Record<string, string> = {
  // Supermarkety a jídlo
  albert: 'cat1', lidl: 'cat1', kaufland: 'cat1', tesco: 'cat1', penny: 'cat1', globus: 'cat1',
  billa: 'cat1', coop: 'cat1', jednota: 'cat1', rohlik: 'cat1', kosik: 'cat1', norma: 'cat1',
  mcdonald: 'cat1', kfc: 'cat1', burger: 'cat1', pizza: 'cat1', starbucks: 'cat1', kavarna: 'cat1',
  bageterie: 'cat1', costa: 'cat1', wolt: 'cat1', foodora: 'cat1',
  // Doprava
  shell: 'cat2', omv: 'cat2', benzina: 'cat2', orlen: 'cat2', mol: 'cat2', cepro: 'cat2', eurooil: 'cat2',
  mhd: 'cat2', dpp: 'cat2', dpo: 'cat2', cd: 'cat2', regiojet: 'cat2', bolt: 'cat2', uber: 'cat2', liftago: 'cat2',
  // Bydlení a služby
  najem: 'cat3', cez: 'cat3', eon: 'cat3', innogy: 'cat3', pre: 'cat3', o2: 'cat3', 't-mobile': 'cat3', vodafone: 'cat3',
  // Zdraví
  benu: 'cat4', 'dr.max': 'cat4', drmax: 'cat4', lekarna: 'cat4', pharmacy: 'cat4',
  // Zábava
  netflix: 'cat5', spotify: 'cat5', hbo: 'cat5', disney: 'cat5', kino: 'cat5', cinema: 'cat5', steam: 'cat5',
};

export function bezDiakritiky(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const PRAVIDLA = Object.entries(SLOVNIK).map(([klic, cat]) => ({
  re: new RegExp(`(?:^|[^a-z0-9])${escapeRe(klic)}(?![a-z])`),
  cat,
}));

export function odhadniKategorii(obchodnik: string): string {
  const n = bezDiakritiky(obchodnik);
  for (const p of PRAVIDLA) if (p.re.test(n)) return p.cat;
  return '';
}
