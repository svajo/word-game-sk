# Hádaj slová

Jednoduchá slovenská slovná hra pre rodinu a kamarátov. Vyberte kategóriu, dohodnite sa, kto háda a kto dáva nápovedy, nastavte čas a skúste uhádnuť čo najviac slov.

Hra je dostupná na: https://svajo.github.io/word-game-sk/

## Lokálne spustenie

```powershell
python -m http.server 8000
```

Potom otvorte `http://localhost:8000`.

## Ako hrať

Hráči si sami určia, kto vidí slovo, kto háda a kto dáva nápovedy. V hre si možno vybrať kategóriu, meno hádajúceho a dĺžku kola. K dispozícii sú prednastavené časy aj vlastný čas od 0 do 10 minút s voľbou sekúnd po 15 sekundách.

Pravidlá si prispôsobte podľa seba. Ako bežné pravidlá odporúčame:

- V nápovede nepoužívajte žiadnu časť hľadaného slova, ani jeho koreň či odvodený tvar.
- Nepomáhajte si prvým písmenom, hláskovaním ani tým, že sa slovo „začína ako“ iné slovo.
- Keď sa zaseknete, slovo preskočte a skúste ďalšie.

Počas kola možno zapnúť alebo vypnúť zvukové a vizuálne efekty. Po skončení sa zobrazí skóre, poradie v skupinách s rovnakým časom a kategóriou a rekapitulácia slov vrátane výsledku a času stráveného pri každom slove. Tlačidlo na rýchle opakovanie spustí ďalšie kolo s rovnakou kategóriou, menom a časom.

## Výsledky a uložené slová

Výsledky dokončených kôl sa ukladajú v `localStorage` tohto prehliadača; história uchováva najviac 500 výsledkov. V okne výsledkov možno záznamy filtrovať, zoradiť a stránkovať po 10. Kolo ukončené tlačidlom **Skončiť hru** sa do histórie výsledkov neuloží.

Zobrazené slová sa ukladajú osobitne v `sessionStorage` a v rámci série sa neopakujú ani po obnovení stránky. Platí to aj pre preskočené slová a slovo zobrazené pri konci kola. Po vyčerpaní kategórie treba vybrať inú alebo na úvodnej obrazovke povoliť opakovanie a vynulovať počítadlo. Používané mená hádajúcich a nastavenia zvuku a efektov sa takisto uchovávajú v tomto prehliadači.

## Vysvetlenia slov

Mnohé slová majú krátke vysvetlenie, ktoré sa zobrazí pod slovom ako dodatočná informácia alebo nápoveda. Vysvetlenia sú v `data/word_descriptions.json`; kľúč musí presne zodpovedať slovu v `data/words.json` vrátane diakritiky a veľkých písmen. Jedno vysvetlenie sa používa vo všetkých kategóriách, v ktorých sa dané slovo nachádza.

```json
{
    "Franz Kafka": {
        "description": "Pražský spisovateľ píšuci po nemecky, autor diel Proces a Premena.",
        "source": "https://en.wikipedia.org/wiki/Franz_Kafka"
    }
}
```

Vysvetlenie má byť krátka slovenská veta (najviac 160 znakov), napísaná vlastnými slovami a overená podľa uvedeného zdroja. Uprednostňujte stabilné fakty a jeden rozpoznateľný detail. Pri nejednoznačných názvoch najprv overte, čo označujú. Odkaz na zdroj slúži na údržbu dát; hra počas kola nenačítava externé stránky. Ak slovo vysvetlenie nemá alebo voliteľný súbor nie je dostupný, zobrazí sa iba slovo.

## Kontroly

Bez inštalácie ďalších balíkov:

```powershell
node --check script.js
node tests/game.test.js
```

Kontroly overujú slovník a vysvetlenia, neopakovanie slov medzi kategóriami, obnovenie a vynulovanie série, skórovanie, časový limit, zatvorenie dialógu pri konci kola a pokračovanie hry pri chybe načítania voliteľných dát alebo úložiska.
