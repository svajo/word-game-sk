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

const categoryThemes = {
    'Všetko': { color: '#5b5bd6', rgb: '91, 91, 214' },
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
fetch('data/words.json')
    .then(response => {
        if (!response.ok) {
            throw new Error(`Nepodarilo sa načítať slová (${response.status}).`);
        }
        return response.json();
    })
    .then(data => {
        categories = Object.keys(data); // Infer categories from keys
        allWords = data; // Save all words data
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
        button.style.fontSize = '5vh';

        button.onclick = () => selectCategory(category);

        buttonDiv.appendChild(button);
        categoriesDiv.appendChild(buttonDiv);
    });
}


function selectCategory(category) {
    currentCategory = category;
    applyTheme(category);
    loadWords(category);
    document.getElementById('category-selection').style.display = 'none';
    document.getElementById('round-duration').style.display = 'block';
    window.scrollTo(0, 0);
    requestAnimationFrame(updateScrollHint);
}

function loadWords(category) {
    // No need to fetch again, words are already loaded
    // Just assign the words for the selected category
    if (category == 'Všetko') {
        words = Object.entries(allWords)
            .filter(([name, categoryWords]) => name !== 'Všetko' && Array.isArray(categoryWords))
            .flatMap(([, categoryWords]) => categoryWords);
    } else {
        words = Array.isArray(allWords[category]) ? [...allWords[category]] : [];
    }
    
}

function startGame(duration) {
    remainingTime = duration;
    correctGuesses = 0;
    incorrectGuesses = 0;
    skippedGuesses = 0;
    totalGuesses = 0;
    lastWarningSecond = null;
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

function displayNextWord() {
    if (words.length > 0) {
        currentWordIndex = Math.floor(Math.random() * words.length);
        const word = String(words[currentWordIndex]);
        const wordDisplay = document.getElementById('word-display');
        wordDisplay.textContent = word;
        wordDisplay.classList.toggle('long-word', word.length > 28);
        wordDisplay.classList.toggle('very-long-word', word.length > 45);
        words.splice(currentWordIndex, 1); // Remove guessed word
        return true;
    } else {
        endGame();
        return false;
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

function endGame(playSound = true) {
    clearInterval(timerInterval);
    timerInterval = undefined;
    if (playSound) {
        playEndSound();
    }
    document.getElementById('game-round').style.display = 'none';
    document.body.classList.remove('game-active');
    showEndScreen();
}

function showEndScreen() {
    const percentage = count => totalGuesses ? Math.round((count / totalGuesses) * 100) : 0;
    document.getElementById('results').innerHTML = `
        <div class="result-total">Spolu: ${totalGuesses}</div>
        <div class="result-correct">Správne: ${correctGuesses} (${percentage(correctGuesses)} %)</div>
        <div class="result-incorrect">Nesprávne: ${incorrectGuesses} (${percentage(incorrectGuesses)} %)</div>
        <div class="result-skipped">Preskočené: ${skippedGuesses} (${percentage(skippedGuesses)} %)</div>
    `;
    document.getElementById('end-screen').style.display = 'block';
}

// Event listeners for game buttons
document.querySelectorAll('.duration-button').forEach(button => {
    button.addEventListener('click', () => {
        startGame(parseInt(button.getAttribute('data-time')));
    });
});

document.getElementById('incorrect-button').addEventListener('click', () => {
    totalGuesses++;
    incorrectGuesses++;
    playIncorrectSound();
    displayNextWord();
});

document.getElementById('correct-button').addEventListener('click', () => {
    totalGuesses++;
    correctGuesses++;
    playCorrectSound();
    displayNextWord();
});

document.getElementById('skip-button').addEventListener('click', () => {
    totalGuesses++;
    skippedGuesses++;
    playSkipSound();
    displayNextWord();
});

// New event listener for the OK button
document.getElementById('ok-button').addEventListener('click', () => {
    document.getElementById('end-screen').style.display = 'none';
    document.getElementById('category-selection').style.display = 'block';
    window.scrollTo(0, 0);
    requestAnimationFrame(updateScrollHint);
});

function showConfirmationModal() {
    const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('confirmation-modal'));
    modal.show();
}

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
    endGame(false);
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
    if (!audioContext || audioContext.state !== 'running') {
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
