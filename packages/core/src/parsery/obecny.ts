import { normMena, parseCastka, RE_CASTKA, RE_MENA } from './cislo';
import type { DruhPlatby, TypPohybu, VysledekPravidla } from './typy';

/**
 * Obecná pravidla pro notifikace českých bank (a anglické verze jejich aplikací).
 *
 * Notifikace z aplikace banky na rozdíl od SMS neobsahuje název banky – banku
 * pozná appka podle balíčku aplikace. Text bývá „titulek + věta s částkou“.
 *
 * Zásada: radši nerozpoznat než zapsat špatně. Bez jasného směru (příchozí /
 * odchozí / platba kartou / znaménko) se nic nezapíše.
 */

/** Notifikace, které nejsou provedený pohyb peněz (budoucí splátka, ověření platby, kód…). */
const RE_IGNOROVAT = new RegExp(
  [
    'proběhne', 'bude\\s+(?:provedena|stržena|odepsána|zaúčtována)', 'naplánovan', 'plánovan',
    'ověřte', 'potvrďte', 'schvalte', 'autorizujte', 'ověřovací', 'kód', 'heslo', 'přihlášení',
    'zablokov', 'zamítnut', 'odmítnut', 'neprovedena', 'nebyla\\s+provedena',
    'will\\s+be', 'scheduled', 'verify', 'confirm', 'approve', 'declined', 'failed', 'code', 'login',
  ].join('|'),
  'i',
);

const RE_PRIJEM = /příchozí|přijat|připsán|obdržel|vklad|incoming|received|credited|deposit/i;
const RE_VYBER = /výběr|bankomat|\batm\b|withdrawal/i;
const RE_KARTA = /kart|\bcard\b|apple\s*pay|google\s*pay|zaplacen|zaplatili|you\s+spent|\bspent\b|nákup|purchase/i;
const RE_ODCHOZI = /odchozí|odešl|odeslan|převod|outgoing|\bsent\b|úhrada|inkaso|trvalý\s+příkaz|direct\s+debit/i;

/** Text za tímto slovem (včetně) už je zůstatek, ne částka platby. */
const RE_ZUSTATEK = /\b(?:zůstatek|disponibiln|available\s+balance|balance)\b/i;

const RE_CASTKA_MENA = new RegExp(`([+−-]\\s*)?${RE_CASTKA}\\s*${RE_MENA}`, 'i');
const RE_MENA_CASTKA = new RegExp(`([+−-]\\s*)?${RE_MENA}\\s*${RE_CASTKA}`, 'i');

const RE_PROTISTRANA = /(?:u\s+obchodníka|u\s+obchodnika|\bu|\bv|\bna|\bat|\bod|\bfrom|\bto|příjemci|merchant:?)\s+(.+?)(?:\s*[,|]|\.\s|\.$|\s+zůstatek|\s+balance|$)/i;

export function vycistiText(s: string): string {
  return s
    // emoji a piktogramy (💳 💸 …) – banky je dávají do titulku i doprostřed věty
    .replace(/[\p{Extended_Pictographic}️‍]/gu, ' ')
    .replace(/[\s  ]+/g, ' ')
    .trim();
}

export function najdiKartu4(text: string): string | undefined {
  const m = text.match(/\*{2,}[\s*]*(\d{4})\b/) ?? text.match(/(?:karta|card)[^\d]{0,20}(?:\d{2,4}[\s*]+)*\*+\s*(\d{4})\b/i);
  return m?.[1];
}

export function maBytIgnorovano(titulek: string, text: string): string | null {
  const m = `${titulek} ${text}`.match(RE_IGNOROVAT);
  return m ? m[0].toLowerCase() : null;
}

export function obecnaPravidla(titulekSurovy: string, textSurovy: string): VysledekPravidla {
  const titulek = vycistiText(titulekSurovy);
  const text = vycistiText(textSurovy);
  const vse = `${titulek} ${text}`;

  const ign = maBytIgnorovano(titulek, text);
  if (ign) return { ignorovat: ign };

  // Částku hledáme jen před slovem „zůstatek“.
  const zus = vse.search(RE_ZUSTATEK);
  const castPlatby = zus > 0 ? vse.slice(0, zus) : vse;

  let castkaTxt: string | undefined;
  let menaTxt: string | undefined;
  let znamenko: string | undefined;
  let konecCastky = -1;

  const a = castPlatby.match(RE_CASTKA_MENA);
  const b = castPlatby.match(RE_MENA_CASTKA);
  // Bereme tu shodu, která je v textu dřív.
  if (a && (!b || (a.index ?? 0) <= (b.index ?? 0))) {
    znamenko = a[1]; castkaTxt = a[2]; menaTxt = a[3];
    konecCastky = (a.index ?? 0) + a[0].length;
  } else if (b) {
    znamenko = b[1]; menaTxt = b[2]; castkaTxt = b[3];
    konecCastky = (b.index ?? 0) + b[0].length;
  }
  if (!castkaTxt) return null;

  const castka = parseCastka(castkaTxt);
  if (!Number.isFinite(castka) || castka <= 0) return null;

  let typ: TypPohybu | null = null;
  let druh: DruhPlatby = 'jine';
  const z = znamenko?.trim();
  if (RE_PRIJEM.test(vse)) { typ = 'income'; druh = 'prevod'; }
  else if (RE_VYBER.test(vse)) { typ = 'expense'; druh = 'vyber'; }
  else if (RE_KARTA.test(vse)) { typ = 'expense'; druh = 'karta'; }
  else if (RE_ODCHOZI.test(vse)) { typ = 'expense'; druh = 'prevod'; }
  else if (z === '-' || z === '−') { typ = 'expense'; }
  else if (z === '+') { typ = 'income'; }
  if (!typ) return null;

  // Protistrana: věta za částkou („… 145,40 Kč u obchodníka Penny, …“).
  const zbytek = castPlatby.slice(konecCastky);
  const p = zbytek.match(RE_PROTISTRANA);
  let protistrana = p?.[1]?.trim() ?? '';
  // Číslo účtu ani karty jako název neukládáme.
  if (/^(?:účtu|účet|ucet|account|kartou|kartu|card)\b/i.test(protistrana) || /\d{4,}[-/]\d/.test(protistrana)) protistrana = '';
  protistrana = protistrana.replace(/\s+\d{2,4}\s*\*+.*$/, '').trim();

  const karta4 = najdiKartu4(vse);
  return {
    typ, castka, mena: normMena(menaTxt), protistrana, druh,
    ...(karta4 ? { karta4 } : {}),
  };
}
