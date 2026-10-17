#!/usr/bin/env node
// Kontrola „žádný text natvrdo“ – build selže, když komponenta obsahuje text
// pro uživatele mimo překlady (t('…')).
//
// Hlídá:
//   - text mezi JSX značkami:            <p>Uložit</p>
//   - textové atributy pro uživatele:    placeholder="Hledat", title, aria-label, alt, label
//   - řetězce předané do JSX výrazem:    <p>{'Uložit'}</p>
// Nehlídá znaky bez písmen (•, –, +, čísla) – ty se nepřekládají.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const koren = join(dirname(fileURLToPath(import.meta.url)), '..');
const SLOZKY = ['apps/mobile/src'];
const ATRIBUTY = new Set(['placeholder', 'title', 'aria-label', 'alt', 'label']);
const PISMENO = /\p{L}/u;

function soubory(d) {
  return readdirSync(d).flatMap(f => {
    const p = join(d, f);
    return statSync(p).isDirectory() ? soubory(p) : p.endsWith('.tsx') && !p.endsWith('.test.tsx') ? [p] : [];
  });
}

const nalezy = [];
for (const slozka of SLOZKY) {
  for (const soubor of soubory(join(koren, slozka))) {
    const zdroj = ts.createSourceFile(soubor, readFileSync(soubor, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const nahlas = (uzel, text) => {
      const { line } = zdroj.getLineAndCharacterOfPosition(uzel.getStart());
      nalezy.push(`${relative(koren, soubor)}:${line + 1}  „${text.trim().slice(0, 60)}“`);
    };
    const projdi = uzel => {
      if (ts.isJsxText(uzel) && PISMENO.test(uzel.text)) nahlas(uzel, uzel.text);
      if (ts.isJsxAttribute(uzel) && ATRIBUTY.has(uzel.name.getText()) && uzel.initializer && ts.isStringLiteral(uzel.initializer) && PISMENO.test(uzel.initializer.text)) {
        nahlas(uzel, uzel.initializer.text);
      }
      if (ts.isJsxExpression(uzel) && uzel.expression && (ts.isStringLiteral(uzel.expression) || ts.isNoSubstitutionTemplateLiteral(uzel.expression)) && PISMENO.test(uzel.expression.text)) {
        nahlas(uzel, uzel.expression.text);
      }
      ts.forEachChild(uzel, projdi);
    };
    projdi(zdroj);
  }
}

if (nalezy.length) {
  console.error(`❌ Text natvrdo (${nalezy.length}) – použij t('klíč') a přidej klíč do packages/i18n/locales/*.json:\n` + nalezy.map(n => '  ' + n).join('\n'));
  process.exit(1);
}
console.log('✅ Žádný text natvrdo v komponentách');
