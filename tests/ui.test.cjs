const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
class Element {
    constructor() {
        this.handlers = {};
        this.children = [];
        this.open = false;
        this.classes = new Set();
        this.classList = {
            add: (...names) => names.forEach(n => this.classes.add(n)),
            remove: (...names) => names.forEach(n => this.classes.delete(n)),
            toggle: (name, value) => value ? this.classes.add(name) : this.classes.delete(name)
        };
    }
    addEventListener(name, fn) { (this.handlers[name] ||= []).push(fn); }
    fire(name) { for (const fn of this.handlers[name] || []) fn({ clientX: 1, clientY: 1 }); }
    setAttribute() {}
    appendChild(child) { this.children.push(child); }
    append(...children) { this.children.push(...children); }
    replaceChildren() { this.children = []; }
    querySelectorAll() { return []; }
    getBoundingClientRect() { return { top: 0, left: 0, width: 100, height: 100 }; }
    showModal() { this.open = true; }
    close() { this.open = false; this.fire('close'); }
    getContext() { return { resetTransform() {}, scale() {} }; }
}
const elements = new Map([...html.matchAll(/id="([^"]+)"/g)].map(m => [m[1], new Element()]));
let ready;
const document = {
    getElementById(id) { assert.ok(elements.has(id), `missing #${id}`); return elements.get(id); },
    createElement: () => new Element(),
    addEventListener(name, callback) { if (name === 'DOMContentLoaded') ready = callback; }
};
const source = fs.readFileSync(path.join(root, 'js/game-app.js'), 'utf8')
    .replace(/\}\)\(\);\s*$/, 'globalThis.classes = {GameEngine, FOOD_DATABASE, sounds};})();')
    .replace('const game = new GameEngine(canvas, uiHooks);', 'const game = globalThis.game = new GameEngine(canvas, uiHooks);');
let now = 0, timerId = 0;
const timers = new Map();
function advanceTime(ms) {
    now += ms;
    for (const [id, timer] of timers) {
        if (timer.at <= now) { timers.delete(id); timer.callback(); }
    }
}
const env = { document, window: { innerWidth: 1280, innerHeight: 720 },
    localStorage: { getItem: () => null, setItem() {} }, performance: { now: () => 0 },
    setTimeout: (callback, delay) => { const id = ++timerId; timers.set(id, { callback, at: now + delay }); return id; },
    clearTimeout: id => timers.delete(id), console };
vm.runInNewContext(source, env);
for (const name of ['loadAssets', 'bindEvents', 'startLoop']) env.classes.GameEngine.prototype[name] = () => {};
env.classes.sounds.enabled = false;
ready();
const el = id => elements.get(id);
env.game.startGame();
assert.equal(el('scoreVal').textContent, '۱۰');
assert.equal(el('startHighScoreVal').textContent, '۰');
assert.equal(elements.has('streakPanel'), false);
el('btnPause').fire('click');
assert.equal(env.game.state, 'PAUSED');
assert.equal(el('pauseDialog').open, true);
el('pauseDialog').close();
assert.equal(env.game.state, 'PLAYING', 'Escape/close resumes the game');
el('btnPause').fire('click');
el('btnResume').fire('click');
assert.equal(env.game.state, 'PLAYING');
assert.equal(el('pauseDialog').open, false);
el('btnPause').fire('click');
el('btnRestartFromPause').fire('click');
assert.equal(env.game.score, 10);
assert.equal(env.game.state, 'PLAYING');
const data = env.classes.FOOD_DATABASE.unhealthy.find(f => f.id === 'soda');
for (let i = 0; i < 5; i++) env.game.handleUnhealthyCut({ data, x: 1, y: 1 }, 0, {});
assert.equal(env.game.state, 'GAMEOVER');
assert.equal(el('toastHazard').textContent, 'افزایش وزن');
assert.match(el('toastTitle').textContent, /قند زیاد/);
assert.equal(el('toastDesc').textContent, data.nameFa);
assert.equal(el('deathDialog').open, false);
assert.equal(el('gameOverDialog').open, false);
const frozenFood = { x: 100, y: 300, vx: 5, vy: -10, gravity: 0.3, angle: 0, angularVelocity: 0.1 };
env.game.foods.push(frozenFood);
env.game.update(1 / 60);
assert.equal(frozenFood.x, 100);
assert.equal(frozenFood.y, 300);
advanceTime(1999);
assert.equal(el('deathDialog').open, false, 'wait the full two seconds');
advanceTime(1);
assert.equal(el('deathDialog').open, true);
assert.equal(el('gameOverDialog').open, false);
assert.equal(el('deathReasons').children.length, 5);
el('btnContinueResults').fire('click');
assert.equal(el('deathDialog').open, false);
assert.equal(el('gameOverDialog').open, true);
assert.equal(el('finalScoreVal').textContent, '۰');
assert.equal(el('lostYears').textContent, '−۱۰');
assert.equal(el('newRecordBadge').hidden, true);
assert.equal(el('deathReasons').children.length, 5);
el('btnRestartGameOver').fire('click');
assert.equal(env.game.state, 'START');
assert.equal(el('startScreen').classes.has('hidden'), false);
assert.equal(el('hudBar').classes.has('hidden'), true);
assert.equal(env.game.foods.length, 1);
assert.equal(env.game.foods[0].data.id, 'watermelon');
assert.equal(elements.has('btnLeaderboardGameOver'), false);
assert.equal(el('gameOverDialog').open, false);
env.game.startGame();
assert.equal(env.game.state, 'PLAYING');
assert.equal(env.game.score, 10);
console.log('Passed: settings, warning heading, instant freeze, exact 2-second delay, five causes, continue to lifespan, return home and start a fresh game.');
