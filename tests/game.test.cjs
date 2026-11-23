const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../js/game-app.js'), 'utf8')
    .replace(/\}\)\(\);\s*$/, 'globalThis.classes = {GameEngine, FOOD_DATABASE, sounds};})();');
const storage = new Map();
let now = 0;
const env = {
    document: { addEventListener() {} },
    window: { innerWidth: 1280, innerHeight: 720, devicePixelRatio: 2 },
    localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) },
    performance: { now: () => now }, setTimeout, clearTimeout, console
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
game.isPointerDown = true;
assert.equal(game.score, 10);
cutGood(); cutGood();
assert.equal(game.score, 12, 'first two cuts earn only base points');
now += 100; cutGood();
assert.equal(game.score, 14, 'third cut adds one bonus year');
now += 100; cutGood();
assert.equal(game.score, 17, 'fourth cut adds two more bonus years');
now += 100; cutGood();
assert.equal(game.score, 21, 'fifth cut adds three more bonus years');
assert.equal(game.bonusYears, 6);
game.pauseGame();
cutGood(); cutBad();
assert.equal(game.score, 21, 'paused cuts cannot change years');
assert.equal(game.activeCombo, 0, 'pausing breaks the swipe chain');
game.resumeGame();
cutBad();
assert.equal(game.score, 19);
assert.equal(game.hearts, 4);
assert.equal(game.activeCombo, 0);
assert.match(warnings[0], /دیابت/);
game.isPointerDown = true;
for (let i = 0; i < 5; i++) { now += 100; cutGood(); }
assert.equal(game.score, 30, 'new swipe chain earns its own bonuses');
for (let i = 0; i < 4; i++) cutBad();
assert.equal(game.state, 'GAMEOVER');
assert.equal(result.score, 22);
assert.equal(result.lossHistory.length, 5);
assert.equal(result.healthyCuts, 10);
assert.equal(result.bonusYears, 12);
assert.equal(result.isNewRecord, true, 'a run that beats the previous record earns the badge');
assert.equal(result.score, result.baseYears + result.healthyCuts + result.bonusYears - 10);
assert.notEqual(warnings[0], warnings[1], 'repeated foods cycle through reasons');
cutBad(); cutGood();
assert.equal(game.score, 22, 'game-over cuts cannot alter the final result');
game.startGame();
assert.equal(game.score, 10);
assert.equal(game.hearts, 5);
assert.equal(game.activeCombo, 0);
assert.equal(game.healthyCuts, 0);
assert.equal(game.bonusYears, 0);
assert.equal(game.lossHistory.length, 0);
assert.equal(game.riskCounts.size, 0);
assert.equal(game.highScore, 30);

// Strict timing uses a monotonic clock and is checked at the cut itself, so a
// delayed animation frame cannot keep an expired chain alive.
game.isPointerDown = true;
cutGood();
now += 399; cutGood();
now += 399; cutGood();
assert.equal(game.activeCombo, 3);
assert.equal(game.bonusYears, 1, '399ms gaps qualify even when the whole swipe exceeds 400ms');
now += 400; cutGood();
assert.equal(game.activeCombo, 1, 'exactly 400ms breaks the chain');
assert.equal(game.bonusYears, 1);
now += 401; cutGood();
assert.equal(game.activeCombo, 1, 'more than 400ms also breaks the chain');
cutGood(); cutGood();
assert.equal(game.bonusYears, 2, 'multiple fruit hit in one frame qualify');
now += 400;
game.update(0);
assert.equal(game.activeCombo, 0, 'expired chains reset even without another cut');
game.isPointerDown = false;
cutGood(); cutGood(); cutGood();
assert.equal(game.activeCombo, 0, 'cuts outside a held gesture cannot earn combos');
assert.equal(game.bonusYears, 2);
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
// Simulate original-speed flights across scores, screen sizes and refresh rates.
const originalSpawnWave = game.spawnWave;
game.spawnWave = () => {};
for (const [width, height] of [[320, 568], [360, 800], [390, 844], [430, 932], [740, 360], [1920, 1080]]) {
    env.window.innerWidth = width;
    env.window.innerHeight = height;
    game.initCanvas();
    for (const hz of [30, 60, 120]) {
        for (const curve of ['wide', 'narrow', 'cross']) {
            for (const lane of [0, 1, 4]) {
                for (const cuts of [0, 75, 250]) {
                    game.startGame();
                    game.healthyCuts = cuts;
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
                    assert.ok(visibleFrames / hz > 1, 'original flight speed leaves over a second to slice');
                    assert.ok(Math.abs(peak - Math.max(height * 0.34, Math.min(172, height * 0.4) + f.radius)) < 1,
                        'safe apex stays consistent at every score and refresh rate');
                }
            }
        }
    }
}
game.spawnWave = originalSpawnWave;
console.log('Passed: same-swipe combo rewards, strict 400ms boundary, idle expiry, penalties, final accounting, pause and restart.');
console.log('Passed: restored original flight speed, reaction time, safe bounds and 30/60/120Hz motion.');

// Special waves use active play time, have guaranteed compositions, and replace
// each other at shared deadlines instead of dumping two waves onto the player.
const waveGame = new TestGame({ getContext: () => ctx }, ui);
const launched = [], specials = [];
waveGame.spawnSingleFood = function(curve, index, count, type) {
    launched.push({ at: this.difficultyTimer, curve, index, count, type });
};
waveGame.spawnSpecialWave = function(kind) {
    GameEngine.prototype.spawnSpecialWave.call(this, kind);
    specials.push({ at: this.difficultyTimer, kind, foods: this.pendingSpawns.map(spawn => ({
        at: spawn.at, curve: spawn.curveType, type: spawn.forcedType
    })) });
};
const simulate = seconds => {
    for (let frame = 0; frame < Math.round(seconds * 60); frame++) waveGame.update(1 / 60);
};
waveGame.startGame();
simulate(9.9);
assert.equal(specials.length, 0);
const pausedAt = waveGame.difficultyTimer;
waveGame.pauseGame();
simulate(60);
assert.equal(waveGame.difficultyTimer, pausedAt);
assert.equal(specials.length, 0, 'background/pause time cannot trigger waves');
waveGame.resumeGame();
simulate(0.1);
assert.equal(specials.length, 1);
simulate(90.9);
assert.equal(specials.length, 10, 'exactly one special every ten active seconds');
for (let index = 0; index < specials.length; index++) {
    const wave = specials[index];
    const expectedTime = (index + 1) * 10;
    assert.ok(Math.abs(wave.at - expectedTime) < 1 / 60);
    assert.equal(wave.kind, index % 2 === 0 ? 'master' : 'mixed');
    const level = Math.min(2, Math.floor(expectedTime / 45));
    const goodCount = wave.foods.filter(food => food.type === 'healthy').length;
    const badCount = wave.foods.filter(food => food.type === 'unhealthy').length;
    assert.equal(goodCount, (wave.kind === 'master' ? 3 : 2) + level);
    assert.equal(badCount, wave.kind === 'master' ? 0 : level === 2 ? 2 : 1);
    wave.foods.forEach((food, foodIndex) => {
        assert.ok(['wide', 'narrow', 'cross'].includes(food.curve));
        assert.ok(Math.abs(food.at - wave.at - foodIndex * 0.16) < 1e-8,
            'special foods are normal throws scheduled 160ms apart');
    });
    const actual = launched.filter(food => food.type && food.at >= wave.at - 1e-8 && food.at < wave.at + 1);
    assert.equal(actual.length, wave.foods.length, 'every queued special food actually launches');
    assert.equal(actual.filter(food => food.type === 'healthy').length, goodCount);
    assert.equal(actual.filter(food => food.type === 'unhealthy').length, badCount);
    assert.ok(actual.at(-1).at - actual[0].at < 1, 'the whole burst launches in under a second');
    for (let i = 1; i < actual.length; i++) {
        assert.ok(actual[i].at > actual[i - 1].at, 'the wave is staggered rather than simultaneous');
        assert.ok(actual[i].at - actual[i - 1].at < 0.2, 'throws remain close in time');
    }
    assert.ok(!launched.some(food => !food.type && food.at > expectedTime - 2.2 && food.at <= expectedTime),
        'a quiet lead-in prevents regular waves piling into the special');
}
waveGame.pendingSpawns.push({ at: 101, curveType: 'wide', index: 0, count: 1 });
waveGame.startGame();
assert.equal(waveGame.pendingSpawns.length, 0);
assert.equal(waveGame.difficultyTimer, 0);
assert.equal(waveGame.nextSpecialWaveAt, 10);
waveGame.spawnWave();
assert.ok(waveGame.pendingSpawns.length >= 1);
const queued = waveGame.pendingSpawns.length;
waveGame.pauseGame();
waveGame.update(1);
assert.equal(waveGame.pendingSpawns.length, queued, 'pause freezes queued launches');
waveGame.returnToStart();
assert.equal(waveGame.pendingSpawns.length, 0, 'returning home cancels old-round launches');
waveGame.startGame();
waveGame.spawnWave();
waveGame.triggerGameOver();
assert.equal(waveGame.pendingSpawns.length, 0, 'game over cancels pending launches');

// Exercise every ordinary arc for special waves on phones and desktops. The
// forced composition must not shrink food or replace its normal launch lanes.
const originalMath = env.Math;
env.Math = Object.create(Math);
for (const [width, height] of [[320, 568], [390, 844], [740, 360], [1920, 1080]]) {
    env.window.innerWidth = width;
    env.window.innerHeight = height;
    game.initCanvas();
    for (const randomValue of [0.1, 0.5, 0.9]) {
        env.Math.random = () => randomValue;
        for (const kind of ['master', 'mixed']) {
            game.startGame();
            game.difficultyTimer = kind === 'master' ? 10 : 100;
            game.nextSpecialWaveAt = Infinity;
            game.spawnSpecialWave(kind);
            assert.equal(game.foods.length, 0, 'special waves use the normal game-time launch queue');
            const count = game.pendingSpawns.length;
            const curve = game.pendingSpawns[0].curveType;
            for (let frame = 0; frame < 60; frame++) game.update(1 / 60);
            const foods = game.foods.slice();
            assert.equal(foods.length, count);
            const goodCount = foods.filter(food => food.data.type === 'healthy').length;
            assert.equal(goodCount, kind === 'master' ? 3 : 4);
            assert.equal(foods.filter(food => food.data.type === 'unhealthy').length, kind === 'master' ? 0 : 2);
            assert.ok(Math.max(...foods.map(food => food.y)) - Math.min(...foods.map(food => food.y)) > 20,
                'close launches produce natural flight positions rather than a row');
            if (curve !== 'narrow') assert.ok(foods.every(food => Math.abs(food.vx) > 0),
                'wide and cross throws keep their ordinary horizontal motion');
            for (let frame = 0; frame < 132; frame++) {
                game.update(1 / 60);
                for (const food of foods) {
                    assert.ok(food.x - food.radius >= 0 && food.x + food.radius <= width,
                        'normal-arc special throws stay inside screen edges');
                }
            }
        }
        for (const curve of ['wide', 'narrow', 'cross']) {
            game.startGame();
            game.spawnSingleFood(curve, 1, 6);
            const normal = game.foods[0];
            game.spawnSingleFood(curve, 1, 6, 'healthy');
            const special = game.foods[1];
            for (const key of ['width', 'height', 'radius', 'x', 'y', 'vx', 'vy', 'gravity']) {
                assert.equal(special[key], normal[key], 'special food keeps ordinary size and flight geometry');
            }
        }
    }
}
if (originalMath === undefined) delete env.Math; else env.Math = originalMath;
console.log('Passed: 10s master / 20s mixed waves, guaranteed foods, capped growth, pause/restart timing and ordinary 160ms burst throws.');

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
    getBoundingClientRect: () => ({ left: 0, top: 0 }),
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

sounds.ensureContext = () => {};
lifecycle.startGame();
const mouse = { clientX: 10, clientY: 10 };
const gestureCut = () => lifecycle.handleHealthyCut(good, 0, { x: 1, y: 0 });
canvasEvents.get('mousedown')(mouse);
gestureCut(); gestureCut(); gestureCut();
assert.equal(lifecycle.bonusYears, 1);
windowEvents.get('mouseup')();
assert.equal(lifecycle.activeCombo, 0, 'mouse release breaks the chain immediately');
canvasEvents.get('mousedown')(mouse);
gestureCut(); gestureCut();
assert.equal(lifecycle.bonusYears, 1, 'a new mouse swipe cannot continue the previous combo');
windowEvents.get('mouseup')();

const firstFinger = { identifier: 1, clientX: 10, clientY: 10 };
const secondFinger = { identifier: 2, clientX: 100, clientY: 100 };
canvasEvents.get('touchstart')({ touches: [firstFinger] });
gestureCut(); gestureCut();
canvasEvents.get('touchstart')({ touches: [firstFinger, secondFinger] });
assert.equal(lifecycle.activeCombo, 2, 'a second finger does not restart the active swipe');
windowEvents.get('touchmove')({ touches: [secondFinger] });
assert.equal(lifecycle.lastPointer.x, 10, 'another finger cannot extend the swipe trail');
windowEvents.get('touchend')({ touches: [firstFinger] });
assert.equal(lifecycle.activeCombo, 2, 'lifting another finger leaves the active swipe intact');
gestureCut();
assert.equal(lifecycle.bonusYears, 2, 'the same tracked touch can complete a combo');
windowEvents.get('touchend')({ touches: [] });
assert.equal(lifecycle.activeCombo, 0);
canvasEvents.get('touchstart')({ touches: [secondFinger] });
gestureCut(); gestureCut();
assert.equal(lifecycle.bonusYears, 2, 'a new touch cannot carry over the previous combo');
windowEvents.get('touchcancel')({ touches: [] });
assert.equal(lifecycle.activeCombo, 0, 'touch cancellation breaks the chain');
assert.equal(lifecycle.isPointerDown, false);
console.log('Passed: separate mouse/touch swipes cannot combine; multi-touch stays on the original finger and cancellation resets combos.');
