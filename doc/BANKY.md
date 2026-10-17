# Banky a oznámení

## Stav

| Banka | Aplikace (balíček) | Balíček ověřen | Pravidla ověřena na skutečných oznámeních |
|---|---|---|---|
| Komerční banka | KB+ (`cz.kb.ndb`) | ✅ | ✅ platba kartou, odchozí platba, budoucí splátka (17. 10. 2026) |
| Česká spořitelna | George (`cz.csas.georgego`) | ✅ | ❌ |
| ČSOB | ČSOB Smart (`cz.csob.smart`) | ✅ | ❌ |
| MONETA | Smart Banka (`cz.moneta.smartbanka`) | ✅ | ❌ |
| Fio banka | Smartbanking (`cz.fio.sb2`) | ✅ | ❌ |
| Revolut | Revolut (`com.revolut.revolut`) | ✅ | ❌ |
| Air Bank | My Air (`cz.airbank.android`) | ❌ odhad | ❌ |
| Raiffeisenbank | (`cz.rb.app.smartphonebanking`) | ❌ odhad | ❌ |
| UniCredit | Smart Banking (`cz.unicredit.smartbanking`) | ❌ odhad | ❌ |
| mBank | mBank CZ (`cz.mbank`) | ❌ odhad | ❌ |

Neověřené banky používají obecná pravidla (`packages/core/src/parsery/obecny.ts`). Ta poznají běžné české i anglické věty („Platba kartou … Kč u obchodníka …“, „Příchozí platba …“, „You spent €… at …“). Jistotu dají až skutečné vzorky.

## Jak doplnit banku

1. **Vzorky:** screenshot oznámení z banky (rozbalené, ať je vidět celý text). Ideálně platba kartou, příchozí platba, odchozí platba, výběr z bankomatu a něco, co platba není (připomínka splátky, přihlášení).
2. **Balíček aplikace:** v appce **Z banky → Nastavit → Nevidíš svou banku? → Hledat 5 minut**. Appka si zapamatuje jen názvy aplikací, které poslaly oznámení. Balíček se dá rovnou přiřadit k bance.
3. **Test:** do `packages/core/test/<banka>.test.ts` přepsat vzorky (anonymizovat číslo karty, účtu a místo, tvar textu nechat přesně) s očekávaným výsledkem.
4. Když obecná pravidla vzorek nepoznají, dostane banka vlastní funkci `rozpoznej` v `packages/core/src/parsery/banky.ts`.
5. V katalogu přepnout `pravidlaOverena: true`, případně `overeno: true` u balíčku.

## Zásady

- Radši nerozpoznat než zapsat špatně. Bez jasného směru (příchozí / odchozí / kartou / znaménko) se nic nezapíše.
- Částka se bere jen před slovem „zůstatek“.
- Číslo účtu ani karty se nestane názvem transakce.
- Oznámení, které nepozná, zůstane v telefonu v sekci „nepoznal“ s tlačítkem Kopírovat – odtud se berou nové vzorky.
