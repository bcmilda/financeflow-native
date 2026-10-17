# Doskenování účtenky k platbě z oznámení (návrh)

## Problém

Oznámení banky zapíše „Penny, 145,40 Kč“. Když pak uživatel naskenuje účtenku z téhož nákupu, web dnes vytvoří **druhou** transakci (`receipts.js` vždy zakládá novou) a výdaj se započítá dvakrát.

## Řešení

Účtenka se **připojí** k transakci, kterou už zapsalo oznámení. Transakce dostane položky (`receiptItems`), kategorie položek a vazbu na účtenku (`receiptAddedAt`, `receiptDate`, `receiptStore`) – stejná pole, jaká web zapisuje dnes.

1. Po naskenování appka hledá kandidáty: výdaj, stejná částka (tolerance 1 Kč na zaokrouhlení), datum ±2 dny, transakce ještě bez účtenky. Shoda obchodu zvyšuje jistotu.
   Hotové a otestované v `packages/core/src/uctenky/parovani.ts` (`najdiTransakciProUctenku`).
2. Jeden jasný kandidát → nabídne se předvybraný: „Připojit k platbě Penny 145,40 Kč z 16. 10.?“
3. Víc kandidátů → výběr. Žádný → nová transakce jako dnes.
4. Druhý vstup: u transakce z oznámení tlačítko **📷 Doskenovat účtenku**, které rovnou otevře skener pro tuhle transakci.

## Otevřené

- Kategorie transakce po připojení: zůstane odhad z oznámení, nebo převezme hlavní kategorii z položek (jako web)? → Milan.
- Stejná logika by měla platit i na webu (naskenovaná účtenka by tam taky měla nabídnout připojení).
