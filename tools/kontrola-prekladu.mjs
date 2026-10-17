#!/usr/bin/env node
// Kontrola překladů – build selže, když:
//   1. jazyku chybí klíč, který má čeština (nebo má navíc klíč, který čeština nemá),
//   2. zpráva není platné ICU (překlep v {n, plural, …}),
//   3. množné číslo nemá všechny tvary, které jazyk potřebuje (Intl.PluralRules),
//   4. překlad používá jiné proměnné než čeština ({castka} vs {suma}).
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { IntlMessageFormat } from 'intl-messageformat';
import { parse, TYPE } from '@formatjs/icu-messageformat-parser';

const koren = join(dirname(fileURLToPath(import.meta.url)), '..');
const slozka = join(koren, 'packages/i18n/locales');
const VZOR = 'cs';

function ploche(obj, pref = '') {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const cesta = pref ? `${pref}.${k}` : k;
    if (v && typeof v === 'object') Object.assign(out, ploche(v, cesta));
    else out[cesta] = String(v);
  }
  return out;
}

function promenne(ast, out = new Set()) {
  for (const el of ast) {
    if (el.value && typeof el.value === 'string' && [TYPE.argument, TYPE.number, TYPE.date, TYPE.time, TYPE.select, TYPE.plural].includes(el.type)) out.add(el.value);
    if (el.options) for (const o of Object.values(el.options)) promenne(o.value, out);
  }
  return out;
}

function pluraly(ast, out = []) {
  for (const el of ast) {
    if (el.type === TYPE.plural) out.push(el);
    if (el.options) for (const o of Object.values(el.options)) pluraly(o.value, out);
  }
  return out;
}

const jazyky = readdirSync(slozka).filter(f => f.endsWith('.json')).map(f => f.replace('.json', ''));
const data = Object.fromEntries(jazyky.map(j => [j, ploche(JSON.parse(readFileSync(join(slozka, `${j}.json`), 'utf8')))]));
const vzor = data[VZOR];
const chyby = [];

for (const j of jazyky) {
  const d = data[j];
  for (const k of Object.keys(vzor)) if (!(k in d)) chyby.push(`${j}: chybí klíč ${k}`);
  for (const k of Object.keys(d)) if (!(k in vzor)) chyby.push(`${j}: klíč navíc ${k} (není v ${VZOR}.json)`);
  const potreba = new Intl.PluralRules(j).resolvedOptions().pluralCategories;
  for (const [k, zprava] of Object.entries(d)) {
    let ast;
    try { ast = parse(zprava); new IntlMessageFormat(zprava, j); }
    catch (e) { chyby.push(`${j}: ${k} není platné ICU – ${e.message}`); continue; }
    for (const p of pluraly(ast)) {
      const chybi = potreba.filter(c => !(c in p.options));
      if (chybi.length) chyby.push(`${j}: ${k} – množné číslo nemá tvary: ${chybi.join(', ')}`);
    }
    if (k in vzor && j !== VZOR) {
      const a = [...promenne(parse(vzor[k]))].sort().join(',');
      const b = [...promenne(ast)].sort().join(',');
      if (a !== b) chyby.push(`${j}: ${k} – proměnné {${b}} se liší od češtiny {${a}}`);
    }
  }
}

if (chyby.length) {
  console.error(`❌ Překlady: ${chyby.length} chyb\n` + chyby.map(c => '  ' + c).join('\n'));
  process.exit(1);
}
console.log(`✅ Překlady v pořádku: ${jazyky.length} jazyků (${jazyky.join(', ')}), ${Object.keys(vzor).length} klíčů`);
