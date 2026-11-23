const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../js/game-app.js'), 'utf8')
    .replace(/\}\)\(\);\s*$/, 'globalThis.classes = {GameEngine, FOOD_DATABASE, sounds};})();');
const storage = new Map();
const env = {
    document: { addEventListener() {} },
    window: { innerWidth: 1280, innerHeight: 720, devicePixelRatio: 2 },
    localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) },
    performance: { now: () => 0 }, setTimeout, clearTimeout, console
};
vm.runInNewContext(source, env);
const { GameEngine, FOOD_DATABASE, sounds } = env.classes;
sounds.enabled = false;
class TestGame extends GameEngine {
    loadAssets() {}
    bindEvents() {}
    splitIntoHalves() {}
}
let result, warnings = [];
const ui = new Proxy({
    onGameOver: value => { result = value; },
    showHazardWarning: (food, risk) => warnings.push(risk.title)
}, { get: (target, key) => target[key] || (() => {}) });
const ctx = { resetTransform() {}, scale() {} };
const game = new TestGame({ getContext: () => ctx }, ui);
const food = (data, type) => ({ data: { ...data, type }, x: 100, y: 100 });
const good = food(FOOD_DATABASE.healthy[0], 'healthy');
const soda = food(FOOD_DATABASE.unhealthy.find(f => f.id === 'soda'), 'unhealthy');
const cutGood = () => game.handleHealthyCut(good, 0, { x: 1, y: 0 });
const cutBad = () => game.handleUnhealthyCut(soda, 0, { x: 1, y: 0 });
game.startGame();
assert.equal(game.score, 10);
for (let i = 0; i < 5; i++) cutGood();
assert.equal(game.score, 18, '5 cuts: five base years plus one +3 bonus');
for (let i = 5; i < 10; i++) cutGood();
assert.equal(game.score, 28, '10 cuts: one additional +5 bonus');
for (let i = 10; i < 20; i++) cutGood();
assert.equal(game.score, 48, '20 cuts: one additional +10 bonus');
for (let i = 20; i < 25; i++) cutGood();
assert.equal(game.score, 53, 'no repeated milestone bonus at 25');
assert.equal(game.bonusYears, 18);
game.pauseGame();
cutGood(); cutBad();
assert.equal(game.score, 53, 'paused cuts cannot change years');
game.resumeGame();
cutBad();
assert.equal(game.score, 51);
assert.equal(game.hearts, 4);
assert.equal(game.activeCombo, 0);
assert.match(warnings[0], /دیابت/);
for (let i = 0; i < 5; i++) cutGood();
assert.equal(game.score, 59, 'new streak can earn its own +3 bonus');
for (let i = 0; i < 4; i++) cutBad();
assert.equal(game.state, 'GAMEOVER');
assert.equal(result.score, 51);
assert.equal(result.lossHistory.length, 5);
assert.equal(result.healthyCuts, 30);
assert.equal(result.bonusYears, 21);
assert.equal(result.isNewRecord, true, 'a run that beats the previous record earns the badge');
assert.equal(result.score, result.baseYears + result.healthyCuts + result.bonusYears - 10);
assert.notEqual(warnings[0], warnings[1], 'repeated foods cycle through reasons');
cutBad(); cutGood();
assert.equal(game.score, 51, 'game-over cuts cannot alter the final result');
game.startGame();
assert.equal(game.score, 10);
assert.equal(game.hearts, 5);
assert.equal(game.activeCombo, 0);
assert.equal(game.healthyCuts, 0);
assert.equal(game.bonusYears, 0);
assert.equal(game.lossHistory.length, 0);
assert.equal(game.riskCounts.size, 0);
assert.equal(game.highScore, 59);
for (const data of FOOD_DATABASE.healthy) assert.equal(data.points, 1);
for (const data of [...FOOD_DATABASE.healthy, ...FOOD_DATABASE.unhealthy]) {
    assert.ok(fs.existsSync(path.resolve(__dirname, '..', data.image)), `missing image: ${data.id}`);
    assert.ok(data.nameFa && data.toastLabelFa, `missing food label: ${data.id}`);
}
for (const id of ['pomegranate', 'almond', 'cheese', 'walnut', 'doogh']) {
    const data = FOOD_DATABASE.healthy.find(food => food.id === id);
    assert.ok(data?.toastDescriptionFa && data.benefitFa, `missing healthy food: ${id}`);
}
for (const id of ['lavashak', 'cheese-puffs', 'smarties', 'chocolate', 'salt', 'lollipop']) {
    assert.ok(FOOD_DATABASE.unhealthy.some(food => food.id === id), `missing unhealthy food: ${id}`);
}
assert.equal(new Set([...FOOD_DATABASE.healthy, ...FOOD_DATABASE.unhealthy].map(food => food.id)).size, 36);
game.images.set('soda', { naturalWidth: 131, naturalHeight: 244 });
const bottle = game.getFoodDimensions('soda', 100);
assert.equal(bottle.height, 100);
assert.ok(Math.abs(bottle.width / bottle.height - 131 / 244) < 0.0001, 'glass bottles keep their aspect ratio');
game.images.clear();
for (const data of FOOD_DATABASE.unhealthy) {
    assert.ok(data.risksFa.length >= 2, data.id);
    assert.ok(data.risksFa.every(r => r.title && r.description), data.id);
}
for (const id of ['chips', 'fries']) {
    assert.match(FOOD_DATABASE.unhealthy.find(f => f.id === id).risksFa[0].title, /حمله قلبی/);
}
storage.clear();
const shortRun = new TestGame({ getContext: () => ctx }, ui);
shortRun.startGame();
for (let i = 0; i < 5; i++) shortRun.handleUnhealthyCut(soda, 0, { x: 1, y: 0 });
assert.equal(shortRun.score, 0);
assert.equal(shortRun.highScore, 0, 'a run with no healthy cuts still records its lifespan');
assert.equal(shortRun.lossHistory.length, 5);
assert.equal(result.isNewRecord, false, 'an unchanged record earns no badge');
shortRun.highScore = 11;
shortRun.startGame();
shortRun.handleHealthyCut(good, 0, { x: 1, y: 0 });
for (let i = 0; i < 5; i++) shortRun.handleUnhealthyCut(soda, 0, { x: 1, y: 0 });
assert.equal(result.isNewRecord, false, 'matching the previous record is not a new record');
// Simulate the actual update loop across portrait/landscape sizes and refresh rates.
for (const [width, height] of [[320, 568], [360, 800], [390, 844], [430, 932], [740, 360], [1920, 1080]]) {
    env.window.innerWidth = width;
    env.window.innerHeight = height;
    game.initCanvas();
    for (const hz of [30, 60, 120]) {
        for (const curve of ['wide', 'narrow', 'cross']) {
            for (const lane of [0, 1, 4]) {
                game.startGame();
                game.spawnSingleFood(curve, lane, 5);
                const f = game.foods[0];
                let peak = height * 2, visibleFrames = 0;
                for (let frame = 0; frame < hz * 2; frame++) {
                    game.update(1 / hz);
                    peak = Math.min(peak, f.y);
                    if (f.y - f.radius < height && f.y + f.radius > 0) {
                        visibleFrames++;
                        assert.ok(f.x - f.radius >= 0 && f.x + f.radius <= width,
                            `${width}x${height} ${curve} ${hz}Hz: food stays inside side edges`);
                        assert.ok(f.y - f.radius >= Math.min(172, height * 0.4) - 1,
                            'food stays below the status and information area');
                    }
                }
                assert.ok(visibleFrames > hz, 'at least one second to slice visible food');
                assert.ok(Math.abs(peak - Math.max(height * 0.34, Math.min(172, height * 0.4) + f.radius)) < 1,
                    'apex remains the same across refresh rates');
            }
        }
    }
}
console.log('Passed: milestone rewards, streak reset, penalties, warning rotation, all five losses, final accounting, pause and restart.');
console.log('Passed: portrait/landscape trajectories, visible time, safe screen bounds and consistent 30/60/120Hz motion.');

// A blank cached background (for example after GPU eviction) must still erase
// old fruit and blade pixels, including the edges during screen shake.
const frameCalls = [];
const renderGame = Object.create(GameEngine.prototype);
Object.assign(renderGame, {
    width: 320, height: 568, dpr: 1.5, screenShake: 10,
    ctx: {
        setTransform(...args) { frameCalls.push(['transform', ...args]); },
        clearRect(...args) { frameCalls.push(['clear', ...args]); },
        fillRect(...args) { frameCalls.push(['fill', this.globalAlpha, this.globalCompositeOperation, ...args]); },
        save() {}, restore() {}, translate() { frameCalls.push(['shake']); }
    },
    particles: { drawDecals() {}, drawForeground() {} },
    drawBackground() {}, drawFoods() {}, drawHalves() {}, drawBladeTrail() {}
});
renderGame.render();
renderGame.render();
for (let frame = 0; frame < 2; frame++) {
    const calls = frameCalls.slice(frame * 4, frame * 4 + 4);
    assert.deepEqual(calls, [
        ['transform', 1.5, 0, 0, 1.5, 0, 0],
        ['clear', 0, 0, 320, 568],
        ['fill', 1, 'source-over', 0, 0, 320, 568],
        ['shake']
    ], 'every frame fully erases old pixels before applying screen shake');
}

// Exercise the actual lifecycle event handlers rather than calling recovery
// methods directly. Returning from a hidden tab must not resume a held swipe.
const documentEvents = new Map(), windowEvents = new Map(), canvasEvents = new Map();
env.document.addEventListener = (name, fn) => documentEvents.set(name, fn);
env.window.addEventListener = (name, fn) => windowEvents.set(name, fn);
const lifecycle = new TestGame({
    getContext: () => ctx,
    addEventListener: (name, fn) => canvasEvents.set(name, fn)
}, ui);
GameEngine.prototype.bindEvents.call(lifecycle);
lifecycle.startGame();
lifecycle.isPointerDown = true;
lifecycle.lastPointer = { x: 5, y: 5 };
lifecycle.bladeTrail = [{ x: 5, y: 5, time: 0 }];
lifecycle.lastTime = 100;
env.document.hidden = true;
documentEvents.get('visibilitychange')();
assert.equal(lifecycle.state, 'PAUSED');
assert.equal(lifecycle.isPointerDown, false);
assert.equal(lifecycle.lastPointer, null);
assert.equal(lifecycle.bladeTrail.length, 0);
assert.equal(lifecycle.lastTime, 0);
env.document.hidden = false;
lifecycle.backgroundCanvas = { discarded: true };
documentEvents.get('visibilitychange')();
assert.equal(lifecycle.backgroundCanvas, null, 'returning rebuilds the cached background');
assert.equal(lifecycle.state, 'PAUSED', 'the player chooses when to resume');
lifecycle.backgroundCanvas = { discarded: true };
canvasEvents.get('contextrestored')();
assert.equal(lifecycle.backgroundCanvas, null, 'context restoration rebuilds canvas resources');
lifecycle.isPointerDown = true;
lifecycle.bladeTrail = [{ x: 1, y: 1 }];
windowEvents.get('blur')();
assert.equal(lifecycle.isPointerDown, false);
assert.equal(lifecycle.bladeTrail.length, 0);
console.log('Passed: full-frame erasure with a blank background, hidden-tab pause, canvas recovery and lost-focus swipe reset.');
