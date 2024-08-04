let categories = [];
let allWords = {};
let words = [];
let currentCategory = '';
let currentWordIndex = 0;
let timerInterval;
let remainingTime = 0;
let correctGuesses = 0;
let totalGuesses = 0;

// Load words from JSON and infer categories from the keys
fetch('data/words.json')
    .then(response => response.json())
    .then(data => {
        categories = Object.keys(data); // Infer categories from keys
        allWords = data; // Save all words data
        console.log(words);
        displayCategories();
    });

function displayCategories() {
    const categoriesDiv = document.getElementById('categories');
    categoriesDiv.innerHTML = '';
    categories.forEach(category => {
        const button = document.createElement('button');
        button.textContent = category;
        button.onclick = () => selectCategory(category);
        categoriesDiv.appendChild(button);
    });
}

function selectCategory(category) {
    currentCategory = category;
    loadWords(category);
    document.getElementById('category-selection').style.display = 'none';
    document.getElementById('round-duration').style.display = 'block';
}

function loadWords(category) {
    // No need to fetch again, words are already loaded
    // Just assign the words for the selected category
    words = allWords[category];
}

function startGame(duration) {
    remainingTime = duration;
    correctGuesses = 0;
    totalGuesses = 0;
    document.getElementById('round-duration').style.display = 'none';
    document.getElementById('game-round').style.display = 'block';
    displayNextWord();
    startTimer();
}

function displayNextWord() {
    if (words.length > 0) {
        currentWordIndex = Math.floor(Math.random() * words.length);
        document.getElementById('word-display').textContent = words[currentWordIndex];
        words.splice(currentWordIndex, 1); // Remove guessed word
    } else {
        endGame();
    }
}

function startTimer() {
    document.getElementById('timer').textContent = formatTime(remainingTime);
    document.getElementById('timer').style.borderColor = 'white';
    document.getElementById('timer').style.color = 'white';
    timerInterval = setInterval(() => {
        remainingTime--;
        document.getElementById('timer').textContent = formatTime(remainingTime);
        if (remainingTime <= 10) {
            document.getElementById('timer').style.borderColor = 'red';
            document.getElementById('timer').style.color = 'red';
        }
        if (remainingTime <= 0) {
            endGame();
        }
    }, 1000);
}

function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secondsLeft = seconds % 60;
    return `${minutes}:${secondsLeft < 10 ? '0' : ''}${secondsLeft}`;
}

function endGame() {
    clearInterval(timerInterval);
    document.getElementById('game-round').style.display = 'none';
    showEndScreen();
}

function showEndScreen() {
    document.getElementById('results').textContent = `Správne: ${correctGuesses} z ${totalGuesses}`;
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
    displayNextWord();
});

document.getElementById('correct-button').addEventListener('click', () => {
    totalGuesses++;
    correctGuesses++;
    displayNextWord();
});

document.getElementById('skip-button').addEventListener('click', () => {
    displayNextWord();
});

// New event listener for the OK button
document.getElementById('ok-button').addEventListener('click', () => {
    document.getElementById('end-screen').style.display = 'none';
    document.getElementById('category-selection').style.display = 'block';
});

// Function to show the confirmation modal
function showConfirmationModal() {
    document.getElementById('confirmation-modal').style.display = 'flex';
}

// Function to hide the confirmation modal
function hideConfirmationModal() {
    document.getElementById('confirmation-modal').style.display = 'none';
}

// Event listener for the Cancel Round button
document.getElementById('cancel-button').addEventListener('click', showConfirmationModal);

// Event listener for the Yes button in the modal
document.getElementById('confirm-yes').addEventListener('click', () => {
    hideConfirmationModal();
    endGame();
});

// Event listener for the No button in the modal
document.getElementById('confirm-no').addEventListener('click', hideConfirmationModal);


function toggleFullscreen() {
    if (!document.fullscreenElement) {
        // Request fullscreen mode
        document.documentElement.requestFullscreen()
            .catch(err => console.error(`Error attempting to enable full-screen mode: ${err.message}`));
    } else {
        // Exit fullscreen mode
        if (document.exitFullscreen) {
            document.exitFullscreen()
                .catch(err => console.error(`Error attempting to exit full-screen mode: ${err.message}`));
        }
    }
}

// Add event listener to the button
document.getElementById('fullscreen-btn').addEventListener('click', toggleFullscreen);