# Hádaj slová

Jednoduchá slovenská slovná hra pre rodinu a kamarátov. Vyberte si kategóriu a dĺžku hry, potom uhádnite čo najviac slov.

Hra je dostupná na: https://svajo.github.io/word-game-sk/

## Lokálne spustenie

```powershell
python -m http.server 8000
```

Potom otvorte `http://localhost:8000`.

## Krátke vysvetlenia slov

Voliteľné vysvetlenia sa zobrazujú pod slovom. Sú uložené v `data/word_descriptions.json`;
kľúč musí presne zodpovedať slovu v `data/words.json` vrátane diakritiky a veľkých písmen.
Jedno vysvetlenie sa používa vo všetkých kategóriách, v ktorých sa dané slovo nachádza.

```json
{
    "Franz Kafka": {
        "description": "Pražský spisovateľ píšuci po nemecky, autor diel Proces a Premena.",
        "source": "https://en.wikipedia.org/wiki/Franz_Kafka"
    }
}
```

Vysvetlenie má byť krátka slovenská veta (najviac 160 znakov), napísaná vlastnými slovami
a overená podľa uvedeného zdroja. Uprednostňujte stabilné fakty a jeden rozpoznateľný detail.
Pri nejednoznačných názvoch najprv overte, čo označujú. Odkaz na zdroj slúži na údržbu dát;
počas hry sa externé stránky nenačítavajú. Ak slovo nemá vysvetlenie alebo voliteľný súbor
nie je dostupný, hra zobrazí iba slovo.

Súbor obsahuje 1 230 vysvetlení, najmä pre osoby, fiktívne postavy, hudobné skupiny
a športové kluby.

## Kontroly

Bez inštalácie ďalších balíkov:

```powershell
node --check script.js
node tests/game.test.js
```

Kontroly overujú vysvetlenia, skórovanie, časový limit, zatvorenie dialógu pri konci kola
a pokračovanie hry pri chybe načítania voliteľných dát.
