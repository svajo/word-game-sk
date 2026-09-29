// Run with: node tests/game.test.js (no dependencies required).
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'script.js'), 'utf8');
const readJson = name => JSON.parse(fs.readFileSync(path.join(root, 'data', name), 'utf8'));

async function createGame(failures = {}) {
    const elements = new Map();
    const makeElement = () => {
        const classes = new Set();
        const listeners = {};
        return {
            children: [], style: { setProperty() {} }, textContent: '', hidden: false,
            classList: {
                add: name => classes.add(name), remove: name => classes.delete(name),
                contains: name => classes.has(name),
                toggle: (name, enabled) => enabled ? classes.add(name) : classes.delete(name)
            },
            setAttribute() {}, appendChild(child) { this.children.push(child); },
            addEventListener(name, fn) { listeners[name] = fn; },
            fire(name) { if (listeners[name]) listeners[name](); }
        };
    };
    const element = id => {
        if (!elements.has(id)) elements.set(id, makeElement());
        return elements.get(id);
    };
    let now = 1000;
    let tick;
    const modal = {
        visible: false, opening: false,
        show() { this.visible = true; this.opening = true; },
        hide() { if (!this.opening) this.visible = false; }
    };
    const context = vm.createContext({
        console: { warn() {}, error() {} },
        Date: { now: () => now },
        Math: Object.assign(Object.create(Math), { random: () => 0 }),
        fetch: async url => {
            const failure = failures[url];
            if (failure === 'network') throw new Error('Network error');
            return {
                ok: failure !== 'http', status: failure === 'http' ? 404 : 200,
                json: async () => {
                    if (failure === 'json') throw new SyntaxError('Invalid JSON');
                    return readJson(path.basename(url));
                }
            };
        },
        document: {
            getElementById: element, createElement: makeElement, querySelectorAll: () => [],
            body: makeElement(), documentElement: makeElement()
        },
        window: { addEventListener() {}, scrollTo() {}, innerHeight: 375, scrollY: 0 },
        screen: {}, bootstrap: { Modal: { getOrCreateInstance: () => modal } },
        requestAnimationFrame: fn => fn(),
        setInterval: fn => { tick = fn; return 1; }, clearInterval: () => { tick = null; }
    });
    vm.runInContext(source, context);
    await new Promise(resolve => setImmediate(resolve));
    return {
        element, modal, eval: code => vm.runInContext(code, context),
        advance: ms => { now += ms; }, tick: () => tick && tick(),
        start: (deck = ['Franz Kafka', 'pes', 'mačka']) => {
            vm.runInContext(`words = ${JSON.stringify(deck)}; startGame(30);`, context);
        }
    };
}

(async () => {
    const descriptions = readJson('word_descriptions.json');
    const words = new Set(Object.values(readJson('words.json')).filter(Array.isArray).flat());
    for (const [word, entry] of Object.entries(descriptions)) {
        assert(words.has(word), `Description has no matching word: ${word}`);
        assert(typeof entry.description === 'string' && entry.description.trim());
        assert(entry.description.length <= 160, `Description too long: ${word}`);
        assert(new URL(entry.source).protocol === 'https:');
    }

    const game = await createGame();
    assert(game.element('categories').children.length > 0);
    game.start();
    assert.strictEqual(game.element('word-description').textContent, descriptions['Franz Kafka'].description);
    assert.strictEqual(game.element('word-description').hidden, false);
    game.element('correct-button').fire('click');
    assert.strictEqual(game.eval('correctGuesses'), 1);
    assert.strictEqual(game.element('word-description').textContent, '');
    assert.strictEqual(game.element('word-description').hidden, true);
    game.element('incorrect-button').fire('click');
    game.element('skip-button').fire('click');
    assert.strictEqual(game.eval('totalGuesses'), 3);
    assert.strictEqual(game.eval('incorrectGuesses'), 1);
    assert.strictEqual(game.eval('skippedGuesses'), 1);
    assert.strictEqual(game.eval('roundActive'), false);
    game.element('correct-button').fire('click');
    assert.strictEqual(game.eval('totalGuesses'), 3);

    for (const button of ['correct-button', 'incorrect-button', 'skip-button']) {
        const expired = await createGame();
        expired.start();
        expired.advance(30000); // Deadline reached, but the timer callback has not run.
        expired.element(button).fire('click');
        assert.strictEqual(expired.eval('totalGuesses'), 0, `${button} accepted a late answer`);
        assert.strictEqual(expired.eval('roundActive'), false);
    }

    for (const duringTransition of [false, true]) {
        const ending = await createGame();
        ending.start();
        ending.element('cancel-button').fire('click');
        if (!duringTransition) ending.modal.opening = false;
        ending.advance(30000);
        ending.tick();
        ending.modal.opening = false;
        ending.element('confirmation-modal').fire('shown.bs.modal');
        assert.strictEqual(ending.modal.visible, false, 'Dialog covered the results');
        assert.strictEqual(ending.element('end-screen').style.display, 'block');
        ending.element('confirm-yes').fire('click');
        assert.strictEqual(ending.eval('totalGuesses'), 0);
    }

    const cancelled = await createGame();
    cancelled.start();
    cancelled.element('confirm-yes').fire('click');
    assert.strictEqual(cancelled.eval('roundActive'), false);
    cancelled.start(['Franz Kafka']);
    assert.strictEqual(cancelled.eval('totalGuesses'), 0);
    assert.strictEqual(cancelled.element('word-description').hidden, false);

    for (const failure of ['http', 'network', 'json']) {
        const optional = await createGame({
            'data/words_metadata.json': failure,
            'data/word_descriptions.json': failure
        });
        assert(optional.element('categories').children.length > 0);
        optional.start();
        assert.strictEqual(optional.element('word-display').textContent, 'Franz Kafka');
        assert.strictEqual(optional.element('word-description').hidden, true);
    }
    const missingWords = await createGame({ 'data/words.json': 'http' });
    assert(missingWords.element('categories').textContent.includes('nepodarilo'));
    console.log(`Passed: ${Object.keys(descriptions).length} descriptions, scoring, deadlines, modal transitions, restart, optional loading failures.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
