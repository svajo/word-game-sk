let categories = [];
let allWords = {};
let words = [];
let currentCategory = '';
let currentWordIndex = 0;
let timerInterval;
let remainingTime = 0;
let correctGuesses = 0;
let incorrectGuesses = 0;
let skippedGuesses = 0;
let totalGuesses = 0;
let roundEndsAt = 0;
let audioContext;
let lastWarningSecond = null;
let wordMetadata = {};
let wordDescriptions = {};
let roundActive = false;
const sessionStorageKey = 'hadaj-slova-used-v1';
const resultsStorageKey = 'hadaj-slova-results-v1';
const guessersStorageKey = 'hadaj-slova-guessers-v1';
const resultsLimit = 500;
const resultsPerPage = 10;
const gameSettingsStorageKey = 'hadaj-slova-settings-v1';
let gameResults = [];
let currentPage = 1;
let sortColumn = 'date';
let sortDirection = -1;
let currentGuesser = '';
let selectedDuration = 0;
let durationSelectionType = '';
let customMinutes = 0;
let customSeconds = 0;
let guessers = [];
let soundEnabled = true;
let effectsEnabled = true;
let roundRecap = [];
let activeRecapWord = null;
let usedWords = new Set();

function saveGameSettings() {
    try { window.localStorage.setItem(gameSettingsStorageKey, JSON.stringify({ sound: soundEnabled, effects: effectsEnabled })); } catch (_) {}
}

function updateSettingButtons() {
    const soundButton = document.getElementById('sound-toggle');
    soundButton.setAttribute('aria-pressed', String(soundEnabled));
    soundButton.setAttribute('aria-label', `Zvuk ${soundEnabled ? 'zapnutý' : 'vypnutý'}`);
    soundButton.classList.toggle('is-enabled', soundEnabled);
    soundButton.classList.toggle('is-disabled', !soundEnabled);
    const effectsButton = document.getElementById('effects-toggle');
    effectsButton.setAttribute('aria-pressed', String(effectsEnabled));
    effectsButton.setAttribute('aria-label', `Efekty ${effectsEnabled ? 'zapnuté' : 'vypnuté'}`);
    effectsButton.classList.toggle('is-enabled', effectsEnabled);
    effectsButton.classList.toggle('is-disabled', !effectsEnabled);
}

try {
    const savedSettings = JSON.parse(window.localStorage.getItem(gameSettingsStorageKey) || '{}');
    if (typeof savedSettings.sound === 'boolean') soundEnabled = savedSettings.sound;
    if (typeof savedSettings.effects === 'boolean') effectsEnabled = savedSettings.effects;
} catch (_) {}
updateSettingButtons();

document.getElementById('sound-toggle').addEventListener('click', () => {
    soundEnabled = !soundEnabled; saveGameSettings(); updateSettingButtons();
});
document.getElementById('effects-toggle').addEventListener('click', () => {
    effectsEnabled = !effectsEnabled; saveGameSettings(); updateSettingButtons();
});

function readStoredArray(key) {
    try {
        const parsed = JSON.parse(window.localStorage.getItem(key) || '[]');
        return Array.isArray(parsed) ? parsed : [];
    } catch (_) { return []; }
}

function saveResults() {
    try { window.localStorage.setItem(resultsStorageKey, JSON.stringify(gameResults.slice(0, resultsLimit))); } catch (_) {}
}

function restoreResults() {
    gameResults = readStoredArray(resultsStorageKey).filter(result => result && typeof result === 'object')
        .slice(0, resultsLimit);
    guessers = readStoredArray(guessersStorageKey).filter(name => typeof name === 'string').slice(0, 50);
}

function wordKey(word) {
    return String(word).normalize('NFC').trim().toLocaleLowerCase('sk-SK');
}

function uniqueWords(candidates) {
    const seen = new Set();
    return candidates.filter(word => {
        const key = wordKey(word);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function sessionWordPool() {
    return uniqueWords(Object.values(allWords).filter(Array.isArray).flat());
}

function restoreSession() {
    try {
        const saved = JSON.parse(window.sessionStorage.getItem(sessionStorageKey) || '[]');
        const available = new Set(sessionWordPool().map(wordKey));
        if (Array.isArray(saved)) {
            usedWords = new Set(saved.filter(word => typeof word === 'string')
                .map(wordKey).filter(key => available.has(key)));
        }
    } catch (_) {
        // If storage is unavailable, repeats are still prevented until a refresh.
    }
    updateSessionCounter();
}

function saveSession() {
    try {
        window.sessionStorage.setItem(sessionStorageKey, JSON.stringify([...usedWords]));
    } catch (_) {
        // Private browsing or full storage must not interrupt a round.
    }
}

function updateSessionCounter() {
    document.getElementById('session-counter').textContent =
        `Zobrazené slová: ${usedWords.size} / ${sessionWordPool().length}`;
    document.getElementById('reset-session').disabled = usedWords.size === 0;
}

document.getElementById('reset-session').addEventListener('click', () => {
    if (roundActive) return;
    usedWords.clear();
    saveSession();
    updateSessionCounter();
    document.getElementById('session-message').textContent = 'Nová séria hier. Všetky slová sú opäť dostupné.';
});

async function loadJson(path) {
    const response = await fetch(path);
    if (!response.ok) {
        throw new Error(`Nepodarilo sa načítať ${path} (${response.status}).`);
    }
    return response.json();
}

async function loadOptionalJson(path) {
    try {
        return await loadJson(path);
    } catch (error) {
        console.warn(error);
        return {};
    }
}

const categoryThemes = {
    'Všetko': { color: '#5b5bd6', rgb: '91, 91, 214' },
    'Príroda': { color: '#647a24', rgb: '100, 122, 36' },
    'Zábava a dobrodružstvo': { color: '#7c3aed', rgb: '124, 58, 237' },
    'Zvieratá': { color: '#2f855a', rgb: '47, 133, 90' },
    'Jedlo': { color: '#c05621', rgb: '192, 86, 33' },
    'Geografia': { color: '#0b7285', rgb: '11, 114, 133' },
    'Historické osobnosti': { color: '#805ad5', rgb: '128, 90, 213' },
    'Celebrity': { color: '#b83280', rgb: '184, 50, 128' },
    'Literatúra': { color: '#6b4f3b', rgb: '107, 79, 59' },
    'Hudba': { color: '#6b46c1', rgb: '107, 70, 193' },
    'Filmy a TV': { color: '#1f4e79', rgb: '31, 78, 121' },
    'Povolania': { color: '#a05a00', rgb: '160, 90, 0' },
    'Domácnosť': { color: '#0f766e', rgb: '15, 118, 110' },
    'Šport': { color: '#b91c1c', rgb: '185, 28, 28' },
    'Veda': { color: '#0369a1', rgb: '3, 105, 161' },
    'Značky': { color: '#374151', rgb: '55, 65, 81' }
};

const categoryEmojis = {
    'Všetko': ['✨', '✨'],
    'Príroda': ['🌿', '🌦️'],
    'Zábava a dobrodružstvo': ['🎲', '🧭'],
    'Zvieratá': ['🐾', '🐾'],
    'Jedlo': ['🍽️', '🍽️'],
    'Geografia': ['🌍', '🌍'],
    'Historické osobnosti': ['🏛️', '🏛️'],
    'Celebrity': ['🧑', '🧑'],
    'Literatúra': ['📚', '🪶'],
    'Hudba': ['🎵', '🎵'],
    'Filmy a TV': ['🎬', '🎬'],
    'Povolania': ['💼', '💼'],
    'Domácnosť': ['🏠', '🏠'],
    'Šport': ['⚽', '⚽'],
    'Veda': ['🔬', '🔬'],
    'Značky': ['🛍️', '🛍️']
};

// Load words from JSON and infer categories from the keys
Promise.all([
    loadJson('data/words.json'),
    loadOptionalJson('data/words_metadata.json'),
    loadOptionalJson('data/word_descriptions.json')
]).then(([data, metadata, descriptions]) => {
        categories = Object.keys(data); // Infer categories from keys
        allWords = data; // Save all words data
        wordMetadata = metadata;
        wordDescriptions = descriptions;
        restoreSession();
        restoreResults();
        renderPreviousGuessers();
        displayCategories();
        requestAnimationFrame(updateScrollHint);
    })
    .catch(error => {
        console.error(error);
        document.getElementById('categories').textContent = 'Slová sa nepodarilo načítať. Obnovte stránku.';
    });

function displayCategories() {
    const categoriesDiv = document.getElementById('categories');
    categoriesDiv.innerHTML = '';
    const featuredCategories = ['Všetko', 'Slovensko'];
    const orderedCategories = [...categories].sort((first, second) => {
        const firstPosition = featuredCategories.includes(first)
            ? featuredCategories.indexOf(first)
            : featuredCategories.length + categories.indexOf(first);
        const secondPosition = featuredCategories.includes(second)
            ? featuredCategories.indexOf(second)
            : featuredCategories.length + categories.indexOf(second);
        return firstPosition - secondPosition;
    });

    orderedCategories.forEach(category => {
        const buttonDiv = document.createElement('div');
        buttonDiv.className = category === 'Všetko'
            ? 'col-12 d-flex justify-content-center'
            : 'col-6 d-flex justify-content-center';

        const button = document.createElement('button');
        const theme = categoryThemes[category] || categoryThemes['Všetko'];
        button.className = category === 'Všetko'
            ? 'btn category-button category-all-button w-100'
            : 'btn category-button w-100';
        if (category === 'Slovensko') {
            button.classList.add('slovensko-category-button');
            button.setAttribute('aria-label', 'Slovensko');
            button.innerHTML = `
                <img src="data/flag_of_slovakia.svg" alt="">
                <span>Slovensko</span>
                <img src="data/flag_of_slovakia.svg" alt="">`;
        } else {
            const [leftEmoji, rightEmoji] = categoryEmojis[category] || ['✨', '✨'];
            button.setAttribute('aria-label', category);
            button.innerHTML = `
                <span class="category-button-content">
                    <span class="category-emoji" aria-hidden="true">${leftEmoji}</span>
                    <span>${category}</span>
                    <span class="category-emoji" aria-hidden="true">${rightEmoji}</span>
                </span>`;
        }
        button.style.setProperty('--category-color', theme.color);

        button.style.height = '10vh';
        button.style.fontSize = category.length > 18
            ? 'clamp(1.2rem, 3.5vh, 3rem)'
            : '5vh';

        button.onclick = () => selectCategory(category);

        buttonDiv.appendChild(button);
        categoriesDiv.appendChild(buttonDiv);
    });
}


function selectCategory(category) {
    currentCategory = category;
    selectedDuration = 0;
    durationSelectionType = '';
    document.querySelectorAll('.duration-button').forEach(button => button.classList.remove('selected'));
    document.getElementById('start-selected-game').disabled = true;
    applyTheme(category);
    loadWords(category);
    if (!words.length) {
        document.getElementById('session-message').textContent =
            `V kategórii ${category} ste už videli všetky slová. Vyberte inú kategóriu alebo povoľte opakovanie.`;
        document.getElementById('session-controls').scrollIntoView({ block: 'center' });
        requestAnimationFrame(updateScrollHint);
        return;
    }
    document.getElementById('session-message').textContent = '';
    document.getElementById('category-selection').style.display = 'none';
    document.getElementById('guesser-selection').style.display = 'block';
    window.scrollTo(0, 0);
    requestAnimationFrame(updateScrollHint);
}

function renderPreviousGuessers() {
    const container = document.getElementById('previous-guessers');
    container.innerHTML = '';
    guessers.forEach(name => {
        const button = document.createElement('button');
        button.type = 'button'; button.className = 'btn btn-outline-light btn-sm'; button.textContent = name;
        button.addEventListener('click', () => { document.getElementById('guesser-name').value = name; });
        container.appendChild(button);
    });
}

document.getElementById('continue-to-duration').addEventListener('click', () => {
    currentGuesser = String(document.getElementById('guesser-name').value || '').trim().slice(0, 20) || '—';
    if (currentGuesser !== '—') {
        guessers = [currentGuesser, ...guessers.filter(name => name !== currentGuesser)].slice(0, 50);
        try { window.localStorage.setItem(guessersStorageKey, JSON.stringify(guessers)); } catch (_) {}
        renderPreviousGuessers();
    }
    document.getElementById('guesser-selection').style.display = 'none';
    document.getElementById('round-duration').style.display = 'block';
});

document.getElementById('back-to-category').addEventListener('click', () => {
    document.getElementById('guesser-selection').style.display = 'none';
    document.getElementById('category-selection').style.display = 'block';
    window.scrollTo(0, 0);
    requestAnimationFrame(updateScrollHint);
});

document.getElementById('back-to-guesser').addEventListener('click', () => {
    document.getElementById('round-duration').style.display = 'none';
    document.getElementById('guesser-selection').style.display = 'block';
    window.scrollTo(0, 0);
    requestAnimationFrame(updateScrollHint);
});

function loadWords(category) {
    const candidates = category === 'Všetko' ? sessionWordPool() : (allWords[category] || []);
    words = uniqueWords(candidates).filter(word => !usedWords.has(wordKey(word)));
}

function startGame(duration) {
    if (roundActive) return;
    roundActive = true;
    remainingTime = duration;
    selectedDuration = duration;
    roundRecap = [];
    activeRecapWord = null;
    correctGuesses = 0;
    incorrectGuesses = 0;
    skippedGuesses = 0;
    totalGuesses = 0;
    lastWarningSecond = null;
    document.getElementById('end-reason').textContent = '';
    unlockAudio();
    document.getElementById('round-duration').style.display = 'none';
    document.getElementById('game-round').style.display = 'flex';
    document.body.classList.add('game-active');
    updateScrollHint();
    tryLockLandscape();
    if (displayNextWord()) {
        startTimer();
    }
}

function applyTheme(category) {
    const theme = categoryThemes[category] || categoryThemes['Všetko'];
    document.documentElement.style.setProperty('--theme-color', theme.color);
    document.documentElement.style.setProperty('--theme-rgb', theme.rgb);
}

function formatWord(word) {
    const details = wordMetadata?.[word];
    return Array.isArray(details) ? `${word} ${details[0]}${details[1] ? ` ${details[1]}` : ''}` : String(word);
}

function displayNextWord() {
    words = words.filter(word => !usedWords.has(wordKey(word)));
    if (words.length > 0) {
        currentWordIndex = Math.floor(Math.random() * words.length);
        const word = String(words[currentWordIndex]);
        const wordDisplay = document.getElementById('word-display');
        const formattedWord = formatWord(word);
        wordDisplay.textContent = formattedWord;
        wordDisplay.classList.toggle('long-word', formattedWord.length > 28);
        wordDisplay.classList.toggle('very-long-word', formattedWord.length > 45);
        fitWordToSingleLine(wordDisplay);
        activeRecapWord = { word: formattedWord, startedAt: Date.now() };
        const descriptionDisplay = document.getElementById('word-description');
        const description = wordDescriptions?.[word]?.description;
        descriptionDisplay.textContent = typeof description === 'string' ? description : '';
        descriptionDisplay.hidden = !descriptionDisplay.textContent;
        document.getElementById('word-card').scrollTop = 0;
        words.splice(currentWordIndex, 1);
        usedWords.add(wordKey(word));
        saveSession();
        return true;
    } else {
        document.getElementById('end-reason').textContent =
            'V tejto kategórii už nezostali nevidené slová. Vyberte inú kategóriu alebo na úvodnej obrazovke povoľte opakovanie.';
        endGame();
        return false;
    }
}

function completeActiveRecapWord(outcome) {
    if (!activeRecapWord) return;
    roundRecap.push({
        word: activeRecapWord.word,
        outcome,
        seconds: Math.max(0, (Date.now() - activeRecapWord.startedAt) / 1000)
    });
    activeRecapWord = null;
}

function showAnswerFeedback(kind) {
    if (!effectsEnabled) return;
    const card = document.getElementById('word-card');
    ['correct', 'incorrect', 'skipped'].forEach(name => card.classList.remove(`feedback-${name}`));
    void card.offsetWidth;
    card.classList.add(`feedback-${kind}`);
    if (typeof setTimeout === 'function') setTimeout(() => card.classList.remove(`feedback-${kind}`), 300);
    const vibration = { correct: 25, incorrect: [35, 25, 35], skipped: 15 }[kind];
    try { window.navigator?.vibrate?.(vibration); } catch (_) {}
}

function fitWordToSingleLine(wordDisplay) {
    wordDisplay.style.fontSize = '';
    if (typeof window.getComputedStyle !== 'function' || !wordDisplay.clientWidth) return;
    let fontSize = parseFloat(window.getComputedStyle(wordDisplay).fontSize);
    for (let attempt = 0; attempt < 30 && wordDisplay.scrollWidth > wordDisplay.clientWidth && fontSize > 14; attempt++) {
        fontSize = Math.max(14, fontSize * Math.min(0.95, (wordDisplay.clientWidth / wordDisplay.scrollWidth) * 0.98));
        wordDisplay.style.fontSize = `${fontSize}px`;
    }
}

function startTimer() {
    clearInterval(timerInterval);
    roundEndsAt = Date.now() + remainingTime * 1000;
    document.getElementById('timer').textContent = formatTime(remainingTime);
    document.getElementById('timer').style.borderColor = 'lightgreen';
    document.getElementById('timer').style.color = 'lightgreen';
    timerInterval = setInterval(() => {
        remainingTime = Math.max(0, Math.ceil((roundEndsAt - Date.now()) / 1000));
        document.getElementById('timer').textContent = formatTime(remainingTime);
        if (remainingTime <= 10) {
            document.getElementById('timer').style.borderColor = 'red';
            document.getElementById('timer').style.color = 'red';
        }
        if (remainingTime > 0 && remainingTime <= 10 && remainingTime !== lastWarningSecond) {
            lastWarningSecond = remainingTime;
            playWarningSound();
        }
        if (remainingTime <= 0) {
            endGame();
        }
    }, 250);
}

function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secondsLeft = seconds % 60;
    return `${minutes}:${secondsLeft < 10 ? '0' : ''}${secondsLeft}`;
}

function endGame(playSound = true, saveResult = true) {
    if (!roundActive) return;
    roundActive = false;
    clearInterval(timerInterval);
    timerInterval = undefined;
    hideConfirmationModal();
    if (playSound) {
        playEndSound();
    }
    completeActiveRecapWord(saveResult ? 'Čas vypršal' : 'Koniec hry');
    if (saveResult) {
        gameResults.unshift({
            id: `${Date.now()}-${Math.random()}`, guesser: currentGuesser || '—', category: currentCategory,
            duration: selectedDuration, total: totalGuesses, correct: correctGuesses,
            incorrect: incorrectGuesses, skipped: skippedGuesses, date: new Date().toISOString()
        });
        gameResults = gameResults.slice(0, resultsLimit);
        saveResults();
    }
    document.getElementById('game-round').style.display = 'none';
    document.body.classList.remove('game-active');
    showEndScreen(saveResult);
}

function populateHistoryFilters() {
    const configs = [
        ['filter-guesser', 'guesser', 'Všetci'], ['filter-category', 'category', 'Všetky'],
        ['filter-duration', 'duration', 'Všetky']
    ];
    configs.forEach(([id, key, firstLabel]) => {
        const select = document.getElementById(id), prior = select.value;
        const values = [...new Set(gameResults.map(result => result[key]).filter(value => value !== undefined && value !== null))];
        values.sort((a, b) => typeof a === 'number' ? a - b : String(a).localeCompare(String(b), 'sk'));
        select.innerHTML = `<option value="">${firstLabel}</option>`;
        values.forEach(value => {
            const option = document.createElement('option'); option.value = String(value);
            option.textContent = key === 'duration' ? formatDuration(value) : String(value);
            select.appendChild(option);
        });
        select.value = prior;
    });
}

function formatDuration(seconds) { return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`; }

function filteredResults() {
    const filters = { guesser: document.getElementById('filter-guesser').value,
        category: document.getElementById('filter-category').value,
        duration: document.getElementById('filter-duration').value };
    return gameResults.filter(result => Object.entries(filters).every(([key, value]) => !value || String(result[key]) === value))
        .sort((a, b) => {
            const av = a[sortColumn], bv = b[sortColumn];
            const order = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av || '').localeCompare(String(bv || ''), 'sk');
            return order * sortDirection;
        });
}

function renderHistory() {
    populateHistoryFilters();
    const results = filteredResults(), pageCount = Math.max(1, Math.ceil(results.length / resultsPerPage));
    currentPage = Math.min(currentPage, pageCount);
    const tbody = document.getElementById('history-rows'); tbody.innerHTML = '';
    const pageResults = results.slice((currentPage - 1) * resultsPerPage, currentPage * resultsPerPage);
    pageResults.forEach(result => {
        const row = document.createElement('tr');
        const values = [result.date ? new Date(result.date).toLocaleString('sk-SK') : '—',
            result.guesser || '—', result.category || '—', formatDuration(result.duration || 0),
            result.correct ?? 0, result.incorrect ?? 0, result.skipped ?? 0, result.total ?? 0];
        values.forEach(value => { const cell = document.createElement('td'); cell.textContent = String(value); row.appendChild(cell); });
        tbody.appendChild(row);
    });
    for (let rowIndex = pageResults.length; rowIndex < resultsPerPage; rowIndex++) {
        const row = document.createElement('tr'); row.className = 'history-placeholder';
        const cell = document.createElement('td'); cell.colSpan = 8; cell.textContent = '\u00a0';
        row.appendChild(cell); tbody.appendChild(row);
    }
    document.getElementById('history-empty').hidden = results.length > 0;
    const pages = document.getElementById('history-page-numbers'); pages.innerHTML = '';
    const windowStart = Math.max(1, Math.min(currentPage - 2, pageCount - 4));
    const windowEnd = Math.min(pageCount, windowStart + 4);
    if (windowStart > 1) pages.appendChild(Object.assign(document.createElement('span'), { textContent: '…', className: 'px-1' }));
    for (let page = windowStart; page <= windowEnd; page++) {
        const button = document.createElement('button'); button.className = `btn btn-sm ${page === currentPage ? 'btn-primary' : 'btn-outline-light'}`;
        button.textContent = String(page); button.addEventListener('click', () => { currentPage = page; renderHistory(); }); pages.appendChild(button);
    }
    if (windowEnd < pageCount) pages.appendChild(Object.assign(document.createElement('span'), { textContent: '…', className: 'px-1' }));
    document.querySelectorAll('[data-page]').forEach(button => {
        const action = button.getAttribute('data-page');
        button.disabled = action === 'first' || action === 'previous' ? currentPage === 1 : currentPage === pageCount;
    });
}

document.getElementById('history-modal').addEventListener('show.bs.modal', () => { currentPage = 1; renderHistory(); });
['filter-guesser', 'filter-category', 'filter-duration'].forEach(id => document.getElementById(id).addEventListener('change', () => { currentPage = 1; renderHistory(); }));
document.querySelectorAll('[data-sort]').forEach(button => button.addEventListener('click', () => {
    const field = button.getAttribute('data-sort');
    if (sortColumn === field) sortDirection *= -1; else { sortColumn = field; sortDirection = field === 'date' ? -1 : 1; }
    renderHistory();
}));
document.querySelectorAll('[data-page]').forEach(button => button.addEventListener('click', () => {
    const pages = Math.max(1, Math.ceil(filteredResults().length / resultsPerPage));
    const action = button.getAttribute('data-page');
    if (action === 'first') currentPage = 1;
    if (action === 'previous') currentPage = Math.max(1, currentPage - 1);
    if (action === 'next') currentPage = Math.min(pages, currentPage + 1);
    if (action === 'last') currentPage = pages;
    renderHistory();
}));
document.getElementById('clear-history').addEventListener('click', () => {
    if (!gameResults.length) return;
    if (!window.confirm('Vymazať všetky uložené výsledky?')) return;
    gameResults = []; currentPage = 1; saveResults(); renderHistory();
});

function showEndScreen(saved = true) {
    updateSessionCounter();
    const percentage = count => totalGuesses ? Math.round((count / totalGuesses) * 100) : 0;
    document.getElementById('results').innerHTML = `
        <div class="result-total">Spolu: ${totalGuesses}</div>
        <div class="result-correct">Správne: ${correctGuesses} (${percentage(correctGuesses)} %)</div>
        <div class="result-incorrect">Nesprávne: ${incorrectGuesses} (${percentage(incorrectGuesses)} %)</div>
        <div class="result-skipped">Preskočené: ${skippedGuesses} (${percentage(skippedGuesses)} %)</div>
    `;
    const rankingContainer = document.getElementById('result-rankings');
    rankingContainer.innerHTML = '';
    if (saved && gameResults.length) {
        const result = gameResults[0];
        const scopes = [
            { guesser: 'Všetci', category: result.category,
                matches: item => item.category === result.category && item.duration === result.duration },
            { guesser: result.guesser, category: result.category,
                matches: item => item.category === result.category && item.duration === result.duration && item.guesser === result.guesser },
            { guesser: 'Všetci', category: 'Všetky kategórie', matches: item => item.duration === result.duration },
            { guesser: result.guesser, category: 'Všetky kategórie',
                matches: item => item.duration === result.duration && item.guesser === result.guesser }
        ];
        const title = document.createElement('h2'); title.className = 'h4'; title.textContent = 'Poradie v uložených výsledkoch';
        rankingContainer.appendChild(title);
        const table = document.createElement('table'); table.className = 'table table-dark table-striped table-sm align-middle';
        const head = document.createElement('thead'), headerRow = document.createElement('tr');
        ['Hádajúci', 'Kategória', 'Čas', 'Poradie', 'Celkový počet hier'].forEach(label => {
            const cell = document.createElement('th'); cell.scope = 'col'; cell.textContent = label; headerRow.appendChild(cell);
        });
        head.appendChild(headerRow); table.appendChild(head);
        const body = document.createElement('tbody');
        scopes.forEach(scope => {
            const group = gameResults.filter(scope.matches);
            const rank = 1 + group.filter(item => item.correct > result.correct).length;
            const row = document.createElement('tr');
            [scope.guesser, scope.category, formatDuration(result.duration), `${rank}.`, group.length].forEach(value => {
                const cell = document.createElement('td'); cell.textContent = String(value); row.appendChild(cell);
            });
            body.appendChild(row);
        });
        table.appendChild(body); rankingContainer.appendChild(table);
    }
    const recapRows = document.getElementById('round-recap-rows');
    recapRows.innerHTML = '';
    roundRecap.forEach(item => {
        const row = document.createElement('tr');
        if (item.outcome === 'Správne') row.className = 'recap-correct';
        if (item.outcome === 'Nesprávne') row.className = 'recap-incorrect';
        [item.word, item.outcome, `${item.seconds.toFixed(1)} s`].forEach(value => {
            const cell = document.createElement('td'); cell.textContent = String(value);
            row.appendChild(cell);
        });
        recapRows.appendChild(row);
    });
    document.getElementById('end-screen').style.display = 'block';
    requestAnimationFrame(updateScrollHint);
}

// Event listeners for game buttons
function canRecordGuess() {
    if (!roundActive) return false;
    if (Date.now() >= roundEndsAt) {
        endGame();
        return false;
    }
    return true;
}

function updateTimerSelection() {
    document.querySelectorAll('.duration-button').forEach(button => {
        button.classList.toggle('selected', durationSelectionType === 'preset' && Number(button.getAttribute('data-time')) === selectedDuration);
    });
    document.getElementById('start-selected-game').disabled = selectedDuration <= 0;
}

document.querySelectorAll('.duration-button').forEach(button => {
    button.addEventListener('click', () => {
        selectedDuration = Number(button.getAttribute('data-time'));
        durationSelectionType = 'preset';
        updateTimerSelection();
    });
});

function selectCustomTimer() {
    selectedDuration = customMinutes * 60 + customSeconds;
    durationSelectionType = 'custom';
    updateTimerSelection();
}

document.querySelectorAll('.minute-option').forEach(button => button.addEventListener('click', () => {
    customMinutes = Number(button.getAttribute('data-value'));
    document.getElementById('minutes-picker').textContent = String(customMinutes);
    selectCustomTimer();
}));
document.querySelectorAll('.second-option').forEach(button => button.addEventListener('click', () => {
    customSeconds = Number(button.getAttribute('data-value'));
    document.getElementById('seconds-picker').textContent = String(customSeconds).padStart(2, '0');
    selectCustomTimer();
}));
document.getElementById('start-selected-game').addEventListener('click', () => {
    if (selectedDuration > 0) startGame(selectedDuration);
});

document.getElementById('incorrect-button').addEventListener('click', () => {
    if (!canRecordGuess()) return;
    completeActiveRecapWord('Nesprávne');
    totalGuesses++;
    incorrectGuesses++;
    showAnswerFeedback('incorrect');
    playIncorrectSound();
    displayNextWord();
});

document.getElementById('correct-button').addEventListener('click', () => {
    if (!canRecordGuess()) return;
    completeActiveRecapWord('Správne');
    totalGuesses++;
    correctGuesses++;
    showAnswerFeedback('correct');
    playCorrectSound();
    displayNextWord();
});

document.getElementById('skip-button').addEventListener('click', () => {
    if (!canRecordGuess()) return;
    completeActiveRecapWord('Preskočené');
    totalGuesses++;
    skippedGuesses++;
    showAnswerFeedback('skipped');
    playSkipSound();
    displayNextWord();
});

// New event listener for the OK button
document.getElementById('ok-button').addEventListener('click', () => {
    document.getElementById('end-screen').style.display = 'none';
    document.getElementById('category-selection').style.display = 'block';
    document.getElementById('guesser-selection').style.display = 'none';
    document.getElementById('guesser-name').value = '';
    window.scrollTo(0, 0);
    requestAnimationFrame(updateScrollHint);
});

document.getElementById('replay-button').addEventListener('click', () => {
    document.getElementById('end-screen').style.display = 'none';
    loadWords(currentCategory);
    if (!words.length) {
        document.getElementById('category-selection').style.display = 'block';
        document.getElementById('session-message').textContent =
            `V kategórii ${currentCategory} ste už videli všetky slová. Povoľte opakovanie alebo vyberte inú kategóriu.`;
        window.scrollTo(0, 0);
        requestAnimationFrame(updateScrollHint);
        return;
    }
    startGame(selectedDuration);
});

function showConfirmationModal() {
    if (!canRecordGuess()) return;
    const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('confirmation-modal'));
    modal.show();
}

// Bootstrap ignores hide() during its opening transition. Close again once shown.
document.getElementById('confirmation-modal').addEventListener('shown.bs.modal', () => {
    if (!roundActive) hideConfirmationModal();
});

// Function to hide the confirmation modal using Bootstrap modal methods
function hideConfirmationModal() {
    const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('confirmation-modal'));
    modal.hide();
}

// Event listener for the Cancel Round button
document.getElementById('cancel-button').addEventListener('click', showConfirmationModal);

// Event listener for the Yes button in the modal
document.getElementById('confirm-yes').addEventListener('click', () => {
    hideConfirmationModal();
    endGame(false, false);
});

// Event listener for the No button in the modal
document.getElementById('confirm-no').addEventListener('click', hideConfirmationModal);


function toggleFullscreen() {
    let elem = document.documentElement;

    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        // Enter fullscreen
        if (elem.requestFullscreen) {
            elem.requestFullscreen()
                .then(tryLockLandscape)
                .catch(error => console.warn('Fullscreen is unavailable:', error));
        } else if (elem.webkitRequestFullscreen) { // iOS Safari
            elem.webkitRequestFullscreen();
        } else if (elem.msRequestFullscreen) { // Edge
            elem.msRequestFullscreen();
        }
    } else {
        // Exit fullscreen
        if (screen.orientation && screen.orientation.unlock) {
            screen.orientation.unlock();
        }
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) { // iOS Safari
            document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) { // Edge
            document.msExitFullscreen();
        }
    }
}

function unlockAudio() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) {
        return;
    }

    if (!audioContext) {
        audioContext = new AudioContext();
    }

    audioContext.resume().catch(() => {
        // Sound is optional; some browsers may keep audio muted.
    });
}

function playWarningSound() {
    playTone(880, 0, 0.11, 0.17);
}

function playEndSound() {
    playTone(523.25, 0, 0.14, 0.24);
    playTone(659.25, 0.15, 0.14, 0.27);
    playTone(783.99, 0.3, 0.14, 0.3);
    playTone(1046.5, 0.45, 0.3, 0.34);
}

function playCorrectSound() {
    playTone(659.25, 0, 0.09, 0.2);
    playTone(880, 0.1, 0.15, 0.26);
}

function playIncorrectSound() {
    playTone(220, 0, 0.18, 0.23, 'sawtooth');
}

function playSkipSound() {
    playTone(440, 0, 0.1, 0.15, 'triangle');
}

function playTone(frequency, delay, duration, level, type = 'sine') {
    if (!soundEnabled || !audioContext || audioContext.state !== 'running') {
        return;
    }

    const startsAt = audioContext.currentTime + delay;
    const oscillator = audioContext.createOscillator();
    const volume = audioContext.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    volume.gain.setValueAtTime(0.0001, startsAt);
    volume.gain.exponentialRampToValueAtTime(level, startsAt + 0.015);
    volume.gain.exponentialRampToValueAtTime(0.0001, startsAt + duration);
    oscillator.connect(volume);
    volume.connect(audioContext.destination);
    oscillator.start(startsAt);
    oscillator.stop(startsAt + duration + 0.02);
}

function tryLockLandscape() {
    if (document.fullscreenElement && screen.orientation && screen.orientation.lock) {
        screen.orientation.lock('landscape').catch(() => {
            // Orientation locking is optional and is not supported by every browser.
        });
    }
}

// Add event listener to the button
const fullscreenButton = document.getElementById('fullscreen-btn');
if (document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen) {
    fullscreenButton.addEventListener('click', toggleFullscreen);
} else {
    fullscreenButton.style.display = 'none';
}

const scrollHint = document.getElementById('scroll-hint');

function updateScrollHint() {
    const page = document.documentElement;
    const hasMoreBelow = window.scrollY + window.innerHeight < page.scrollHeight - 12;
    scrollHint.style.display = !document.body.classList.contains('game-active') && hasMoreBelow
        ? 'block'
        : 'none';
}

scrollHint.addEventListener('click', () => {
    window.scrollBy({ top: window.innerHeight * 0.7, behavior: 'smooth' });
});

window.addEventListener('scroll', updateScrollHint, { passive: true });
window.addEventListener('resize', updateScrollHint);
