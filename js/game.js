// موتور اصلی بازی «نبرد سلامت»
// Main Game Engine: Physics, Slicing, Halving Mechanics, Wave Spawning, and Combos

import { FOOD_DATABASE, toPersianDigits } from './food-data.js';
import { ParticleSystem } from './particles.js';
import { sounds } from './audio.js';

export class GameEngine {
    constructor(canvas, uiHooks) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.ui = uiHooks; // اتصالات رابط کاربری (بروزرسانی قلب‌ها، امتیاز و ...)

        this.particles = new ParticleSystem();

        // وضعیت بازی
        this.state = 'START'; // 'START' | 'PLAYING' | 'PAUSED' | 'GAMEOVER'
        this.baseYears = 10;
        this.score = this.baseYears;
        this.healthyCuts = 0;
        this.bonusYears = 0;
        this.lossHistory = [];
        this.riskCounts = new Map();
        this.highScore = 0;
        this.hearts = 5;
        this.maxHearts = 5;

        // لیست غذاها و قطعات
        this.foods = [];
        this.halves = [];

        // مدیریت تصاویر پیش‌بارگذاری شده
        this.images = new Map();
        this.imagesLoaded = false;

        // مسیر برش تیغه (Blade Trail)
        this.bladeTrail = [];
        this.isPointerDown = false;
        this.lastPointer = null;
        this.lastSwooshTime = 0;
        this.lastBladeSparkTime = 0;

        // سیستم موج‌دهی و زمان‌بندی
        this.lastTime = 0;
        this.spawnTimer = 0;
        this.spawnInterval = 2.4; // ثانیه
        this.difficultyTimer = 0;
        this.nextSpecialWaveAt = 10;
        this.pendingSpawns = [];
        this.screenShake = 0;

        // سیستم کومبو (برش همزمان چند غذا در یک ضربه)
        this.activeCombo = 0;
        this.lastComboCutTime = null;

        // ابعاد فیزیک صفحه
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.dpr = Math.min(window.devicePixelRatio || 1, 1.5);

        // بارگذاری رکورد قبلی
        try {
            this.highScore = Math.max(0, Number(localStorage.getItem('health_battle_lifespan_record_v2')) || 0);
        } catch (e) {}

        this.initCanvas();
        this.loadAssets();
        this.bindEvents();
    }

    initCanvas() {
        const oldWidth = this.width;
        const oldHeight = this.height;
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        // Bound raster work on high-density screens; refresh when resizing.
        this.dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        this.backgroundCanvas = null;
        this.canvas.width = this.width * this.dpr;
        this.canvas.height = this.height * this.dpr;
        this.ctx.resetTransform?.();
        this.ctx.scale(this.dpr, this.dpr);
        if (oldWidth && oldHeight && (oldWidth !== this.width || oldHeight !== this.height)) {
            const sx = this.width / oldWidth;
            const sy = this.height / oldHeight;
            for (const item of [...this.foods, ...this.halves]) {
                item.x *= sx;
                item.y *= sy;
                item.vx *= sx;
                item.vy *= sy;
                item.gravity *= sy;
                const scale = Math.min(1, sx, sy);
                if (item.width) {
                    item.width *= scale;
                    item.height *= scale;
                    item.radius *= scale;
                } else {
                    item.w *= scale;
                    item.h *= scale;
                }
            }
            this.bladeTrail = [];
            this.lastPointer = null;
            this.isPointerDown = false;
            this.resetCombo();
            this.particles.clear();
        }
    }

    async loadAssets() {
        const allItems = [...FOOD_DATABASE.healthy, ...FOOD_DATABASE.unhealthy];
        const promises = allItems.map(item => {
            return new Promise((resolve) => {
                const img = new Image();
                img.src = item.image;
                img.onload = () => {
                    this.images.set(item.id, img);
                    resolve();
                };
                img.onerror = () => {
                    console.warn(`Could not load image: ${item.image}`);
                    resolve();
                };
            });
        });

        await Promise.all(promises);
        this.imagesLoaded = true;

        // اضافه کردن میوه شروع در صفحه آغاز (هندوانه برای قاچ کردن و شروع بازی)
        this.createStartMenuWatermelon();
    }

    createStartMenuWatermelon() {
        if (this.state !== 'START') return;
        this.foods = [];
        this.halves = [];

        const watermelonData = FOOD_DATABASE.healthy.find(f => f.id === 'watermelon');
        if (!watermelonData) return;

        const actionsBottom = document.querySelector?.('.start-actions')?.getBoundingClientRect().bottom || 0;
        const startY = Math.min(this.height - 100, Math.max(this.height * 0.65, actionsBottom + 85));

        // قرار دادن یک هندوانه چرخان در مرکز صفحه شروع
        this.foods.push({
            data: watermelonData,
            x: this.width / 2,
            y: startY,
            vx: 0,
            vy: 0,
            gravity: 0,
            radius: 54,
            ...this.getFoodDimensions(watermelonData.id, 108),
            angle: 0,
            angularVelocity: 0.015,
            isStartTrigger: true, // با بریدن این هندوانه بازی شروع می‌شود!
            isCut: false
        });
    }

    bindEvents() {
        let activeTouchId = null;
        document.addEventListener('visibilitychange', () => {
            activeTouchId = null;
            this.resetCombo();
            this.isPointerDown = false;
            this.lastPointer = null;
            this.bladeTrail = [];
            this.lastTime = 0;
            if (document.hidden) {
                this.pauseGame();
            } else {
                // Browsers can discard canvas backing stores while suspended.
                this.initCanvas();
            }
        });
        this.canvas.addEventListener('contextrestored', () => this.initCanvas());

        window.addEventListener('resize', () => {
            this.initCanvas();
            if (this.state === 'START') {
                this.createStartMenuWatermelon();
            }
        });

        // پشتیبانی کامل از ماوس و صفحات لمسی (Touch)
        const onPointerDown = (e) => {
            sounds.ensureContext();
            this.resetCombo();
            this.isPointerDown = true;
            const pos = this.getCanvasPos(e);
            this.bladeTrail = [{ x: pos.x, y: pos.y, time: performance.now() }];
            this.lastPointer = pos;
        };

        const onPointerMove = (e) => {
            if (!this.isPointerDown) return;
            const pos = this.getCanvasPos(e);
            const now = performance.now();

            if (this.lastPointer) {
                const dx = pos.x - this.lastPointer.x;
                const dy = pos.y - this.lastPointer.y;
                const dist = Math.hypot(dx, dy);

                // پخش صدای تاب شمشیر هنگام کشیدن سریع
                if (dist > 30 && now - this.lastSwooshTime > 180) {
                    sounds.playSwoosh();
                    this.lastSwooshTime = now;
                }

                // ایجاد جرقه‌های درخشان تیغه
                if (dist > 8 && now - this.lastBladeSparkTime >= 32) {
                    this.lastBladeSparkTime = now;
                    this.particles.createBladeSparks(pos.x, pos.y, dx, dy, 2);
                }

                // بررسی برخورد تیغه با غذاها در حین حرکت
                this.checkSliceCollision(this.lastPointer, pos);
            }

            this.bladeTrail.push({ x: pos.x, y: pos.y, time: now });
            if (this.bladeTrail.length > 24) this.bladeTrail.shift();
            this.lastPointer = pos;
        };

        const onPointerUp = () => {
            activeTouchId = null;
            this.resetCombo();
            this.isPointerDown = false;
            this.lastPointer = null;
        };

        // ماوس
        this.canvas.addEventListener('mousedown', e => { if (activeTouchId === null) onPointerDown(e); });
        window.addEventListener('mousemove', e => { if (activeTouchId === null) onPointerMove(e); });
        window.addEventListener('mouseup', () => { if (activeTouchId === null) onPointerUp(); });
        window.addEventListener('blur', () => {
            onPointerUp();
            this.bladeTrail = [];
        });

        // لمسی (Mobile/Tablet)
        this.canvas.addEventListener('touchstart', (e) => {
            if (activeTouchId === null && e.touches.length > 0) {
                const touch = e.touches[0];
                activeTouchId = touch.identifier;
                onPointerDown(touch);
            }
        }, { passive: false });

        window.addEventListener('touchmove', (e) => {
            const touch = Array.from(e.touches).find(touch => touch.identifier === activeTouchId);
            if (touch) onPointerMove(touch);
        }, { passive: false });

        const onTouchEnd = e => {
            if (!Array.from(e.touches).some(touch => touch.identifier === activeTouchId)) onPointerUp();
        };
        window.addEventListener('touchend', onTouchEnd);
        window.addEventListener('touchcancel', onTouchEnd);
    }

    getCanvasPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }

    // بررسی برخورد تیغه شمشیر با غذاها (Intersection of Line Segment with Circle)
    checkSliceCollision(p0, p1) {
        if (this.state !== 'START' && this.state !== 'PLAYING') return;
        const segDist = Math.hypot(p1.x - p0.x, p1.y - p0.y);
        if (segDist < 3) return;

        // محاسبه جهت و زاویه برش تیغه
        const sliceAngle = Math.atan2(p1.y - p0.y, p1.x - p0.x);
        const swipeVector = { x: (p1.x - p0.x) / segDist, y: (p1.y - p0.y) / segDist };

        for (let i = this.foods.length - 1; i >= 0; i--) {
            const food = this.foods[i];
            if (food.isCut) continue;

            // فاصله نقطه مرکز دایره غذا تا پاره‌خط تیغه
            const dist = this.pointToSegmentDistance(food.x, food.y, p0.x, p0.y, p1.x, p1.y);

            if (dist <= food.radius) {
                // برش موفقیت‌آمیز!
                this.sliceFood(food, i, sliceAngle, swipeVector);
                if (this.state === 'GAMEOVER') break;
            }
        }
    }

    pointToSegmentDistance(px, py, x0, y0, x1, y1) {
        const dx = x1 - x0;
        const dy = y1 - y0;
        const lenSq = dx * dx + dy * dy;
        if (lenSq === 0) return Math.hypot(px - x0, py - y0);

        let t = ((px - x0) * dx + (py - y0) * dy) / lenSq;
        t = Math.max(0, Math.min(1, t));

        const projX = x0 + t * dx;
        const projY = y0 + t * dy;
        return Math.hypot(px - projX, py - projY);
    }

    // دو نیم کردن غذا (Halving Mechanic) و اعمال افکت‌ها
    sliceFood(food, index, sliceAngle, swipeVector) {
        food.isCut = true;

        // اگر میوه شروع بازی باشد، بازی را آغاز کن!
        if (food.isStartTrigger) {
            this.splitIntoHalves(food, sliceAngle, swipeVector);
            this.foods.splice(index, 1);
            this.particles.createJuiceSplash(food.x, food.y, food.data.splashColors, sliceAngle, 45);
            sounds.playCutHealthy();
            this.particles.addFloatingText(food.x, food.y - 20, 'شروع نبرد سلامت!', '#4caf50', 32, true);

            setTimeout(() => {
                if (this.ui && typeof this.ui.checkCanStart === 'function' && !this.ui.checkCanStart()) {
                    this.ui.requestRegistration(
                        () => this.startGame(),
                        () => this.createStartMenuWatermelon()
                    );
                } else {
                    this.startGame();
                }
            }, 350);
            return;
        }

        // بررسی نوع غذا: سالم یا ناسالم
        if (food.data.type === 'healthy') {
            this.handleHealthyCut(food, sliceAngle, swipeVector);
        } else {
            this.handleUnhealthyCut(food, sliceAngle, swipeVector);
        }

        // دو نیم کردن فیزیکی غذا
        this.splitIntoHalves(food, sliceAngle, swipeVector);
        this.foods.splice(index, 1);
    }

    resetCombo() {
        this.activeCombo = 0;
        this.lastComboCutTime = null;
    }

    // برش غذای سالم: امتیاز، آبمیوه، کومبو
    handleHealthyCut(food, sliceAngle, swipeVector) {
        if (this.state !== 'PLAYING') return;
        sounds.playCutHealthy();
        this.particles.createJuiceSplash(food.x, food.y, food.data.splashColors, sliceAngle, 16);
        this.healthyCuts++;
        const now = performance.now();
        if (!this.isPointerDown || (this.lastComboCutTime !== null && now - this.lastComboCutTime >= 400)) {
            this.resetCombo();
        }
        if (this.isPointerDown) {
            this.activeCombo++;
            this.lastComboCutTime = now;
        }
        this.score += 1;

        // One continuous swipe: 3 cuts award +1, the fourth +2, fifth +3, etc.
        const bonus = Math.max(0, this.activeCombo - 2);
        if (bonus) {
            this.score += bonus;
            this.bonusYears += bonus;
            sounds.playCombo(this.activeCombo);
            this.particles.addFloatingText(this.width / 2, this.height * 0.4,
                `کمبوی یک حرکت! +${toPersianDigits(bonus)} سال`, '#ffca28', 28, true);
        }
        this.particles.addFloatingText(food.x, food.y, '+۱ سال', '#81c784', 24);
        this.ui.updateScore(this.score);
        this.ui.showHealthTip(food.data);
        if (this.score > this.highScore) {
            this.highScore = this.score;
            try { localStorage.setItem('health_battle_lifespan_record_v2', String(this.highScore)); } catch (e) {}
            this.ui.updateHighScore(this.highScore);
        }
    }

    handleUnhealthyCut(food, sliceAngle, swipeVector) {
        if (this.state !== 'PLAYING') return;
        sounds.playHeartStroke();
        this.screenShake = 12;
        this.particles.createToxicBurst(food.x, food.y, food.data.splashColors, 12);
        const risks = food.data.risksFa;
        const seen = this.riskCounts.get(food.data.id) || 0;
        const risk = risks[seen % risks.length];
        this.riskCounts.set(food.data.id, seen + 1);
        this.lossHistory.push({ food: food.data.nameFa, ...risk });
        this.score -= 2;
        this.hearts = Math.max(0, this.hearts - 1);
        this.resetCombo();
        this.ui.updateScore(this.score);
        this.ui.updateHearts(this.hearts);
        this.particles.addFloatingText(food.x, food.y - 30,
            `−۲ سال • ${risk.title}`, '#ff1744', 26, true);
        this.ui.showHazardWarning(food.data, risk);
        if (this.hearts <= 0) this.triggerGameOver();
    }

    // تقسیم دقیق تصویر غذا به دو نیمه متقارن با فیزیک و چرخش مستقل
    splitIntoHalves(food, sliceAngle, swipeVector) {
        const img = this.images.get(food.data.id);
        if (!img) return;

        // بردار عمود بر خط برش جهت پرتاب به طرفین (Repulsion Normal)
        const nx = -Math.sin(sliceAngle);
        const ny = Math.cos(sliceAngle);
        const pushSpeed = 3.5 + Math.random() * 2.0;

        // نیمه اول (Half 0)
        this.halves.push({
            img,
            data: food.data,
            x: food.x,
            y: food.y,
            w: food.width,
            h: food.height,
            index: 0,
            angle: food.angle,
            sliceAngle: sliceAngle,
            initialAngle: food.angle,
            vx: food.vx + nx * pushSpeed + swipeVector.x * 0.8,
            vy: food.vy + ny * pushSpeed - (1.5 + Math.random()),
            angularVelocity: food.angularVelocity - (0.05 + Math.random() * 0.08),
            gravity: 0.32,
            cutColor: food.data.color
        });

        // نیمه دوم (Half 1)
        this.halves.push({
            img,
            data: food.data,
            x: food.x,
            y: food.y,
            w: food.width,
            h: food.height,
            index: 1,
            angle: food.angle,
            sliceAngle: sliceAngle,
            initialAngle: food.angle,
            vx: food.vx - nx * pushSpeed + swipeVector.x * 0.8,
            vy: food.vy - ny * pushSpeed - (1.5 + Math.random()),
            angularVelocity: food.angularVelocity + (0.05 + Math.random() * 0.08),
            gravity: 0.32,
            cutColor: food.data.color
        });
    }

    // پرتاب غذا در مسیرهای قوسی منحنی (از قوس عریض تا قوس باریک)
    // "throw foods in curve path, from wide to narrow curve"
    spawnWave() {
        if (this.state !== 'PLAYING') return;

        // انتخاب تعداد غذا در این موج (بین ۱ تا ۴ عدد با توجه به امتیاز)
        const difficulty = Math.min(2, Math.floor((this.difficultyTimer + 1e-9) / 45));
        const count = 1 + Math.floor(Math.random() * (2 + difficulty));

        // انتخاب نوع پرتاب:
        // ۱. قوس عریض (Wide Curve): سرعت افقی زیاد، قوس منحنی بزرگ که از یک طرف صفحه به طرف دیگر کشیده می‌شود
        // ۲. قوس باریک (Narrow Curve): پرتاب عمودی‌تر با انحنای متمرکز و شیب تند
        // ۳. پرتاب متقاطع (Cross Curve): از دو طرف صفحه به سمت مرکز
        const curveTypes = ['wide', 'narrow', 'cross'];
        const curveType = curveTypes[Math.floor(Math.random() * curveTypes.length)];

        for (let i = 0; i < count; i++) {
            this.pendingSpawns.push({ at: this.difficultyTimer + i * 0.22, curveType, index: i, count });
        }
    }

    spawnSpecialWave(kind) {
        if (this.state !== 'PLAYING') return;
        const level = Math.min(2, Math.floor((this.difficultyTimer + 1e-9) / 45));
        const goodCount = (kind === 'master' ? 3 : 2) + level;
        const badCount = kind === 'mixed' ? (level === 2 ? 2 : 1) : 0;
        // Put hazards at the edges of a simultaneous fan, leaving a clear
        // healthy group to swipe through for a combo.
        const types = Array(goodCount).fill('healthy');
        if (badCount >= 1) types.unshift('unhealthy');
        if (badCount >= 2) types.push('unhealthy');
        this.pendingSpawns = [];
        types.forEach((type, index) => this.spawnSingleFood('narrow', index, types.length, type));
        this.particles.addFloatingText(this.width / 2, this.height * 0.3,
            kind === 'master' ? 'موج استاد!' : 'موج ترکیبی!',
            kind === 'master' ? '#81c784' : '#ffca28', 28, true);
    }

    getFoodDimensions(id, size) {
        const img = this.images.get(id);
        const ratio = img && img.naturalWidth && img.naturalHeight
            ? img.naturalWidth / img.naturalHeight : 1;
        return { width: size * Math.min(1, ratio), height: size * Math.min(1, 1 / ratio) };
    }

    spawnSingleFood(curveType, waveIndex = 0, totalInWave = 1, forcedType = null) {
        // A gentle ramp keeps healthy foods in the majority throughout a run.
        const unhealthyChance = 0.36 + Math.min(0.04, this.healthyCuts * 0.0008);
        const isUnhealthy = forcedType ? forcedType === 'unhealthy' : Math.random() < unhealthyChance;
        const catalog = isUnhealthy ? FOOD_DATABASE.unhealthy : FOOD_DATABASE.healthy;
        const data = { ...catalog[Math.floor(Math.random() * catalog.length)], type: isUnhealthy ? 'unhealthy' : 'healthy' };

        // Fixed launch lanes and a fitted ballistic arc keep the entire food on screen.
        const baseSize = Math.min(110, forcedType ? this.width / (totalInWave + 1) * 0.8 : 110,
            Math.max(48, Math.min(this.width * 0.22, this.height * 0.18)));
        const size = baseSize * (0.9 + Math.random() * 0.1);
        const radius = size / 2;
        const margin = radius + 12;
        const fanSpacing = Math.min(baseSize + 18, (this.width - baseSize - 24) / Math.max(1, totalInWave - 1));
        const fanHalfWidth = fanSpacing * (totalInWave - 1) / 2;
        const left = forcedType ? this.width / 2 - fanHalfWidth : Math.max(margin, this.width * 0.22);
        const right = forcedType ? this.width / 2 + fanHalfWidth : Math.min(this.width - margin, this.width * 0.78);
        const fromLeft = waveIndex % 2 === 0;
        let startX, landingX;
        if (curveType === 'narrow') {
            const lane = totalInWave > 1 ? waveIndex / (totalInWave - 1) : 0.5;
            startX = left + (right - left) * lane;
            landingX = startX;
        } else {
            startX = fromLeft ? left : right;
            landingX = fromLeft ? right : left;
            if (curveType === 'wide') landingX = this.width / 2;
        }
        const startY = this.height + radius + 12;
        const apexY = Math.min(this.height - size,
            Math.max(this.height * 0.34, Math.min(172, this.height * 0.4) + radius));
        // Restore the original, easier flight speed. Difficulty now grows
        // through wave size and rhythm instead of faster flight.
        const apexFrames = 66;
        const gravity = 2 * (startY - apexY) / (apexFrames * apexFrames);
        const vy = -gravity * (apexFrames - 0.5);
        const vx = (landingX - startX) / (2 * apexFrames);

        this.foods.push({
            data,
            x: startX,
            y: startY,
            vx,
            vy,
            gravity,
            radius: size / 2,
            ...this.getFoodDimensions(data.id, size),
            angle: Math.random() * Math.PI * 2,
            angularVelocity: (Math.random() - 0.5) * 0.08,
            isCut: false
        });
    }

    returnToStart() {
        this.state = 'START';
        this.pendingSpawns = [];
        this.resetCombo();
        this.particles.clear();
        this.bladeTrail = [];
        this.lastPointer = null;
        this.isPointerDown = false;
        this.screenShake = 0;
        this.createStartMenuWatermelon();
    }

    startGame() {
        this.recordAtStart = this.highScore;
        this.state = 'PLAYING';
        this.baseYears = 10;
        this.score = this.baseYears;
        this.healthyCuts = 0;
        this.bonusYears = 0;
        this.lossHistory = [];
        this.riskCounts = new Map();
        this.hearts = this.maxHearts;
        this.foods = [];
        this.halves = [];
        this.particles.clear();
        this.spawnTimer = 0;
        this.difficultyTimer = 0;
        this.nextSpecialWaveAt = 10;
        this.pendingSpawns = [];
        this.resetCombo();
        this.bladeTrail = [];
        this.screenShake = 0;

        this.ui.updateScore(this.score);
        this.ui.updateHearts(this.hearts);
        this.ui.onGameStart();
    }

    pauseGame() {
        if (this.state === 'PLAYING') {
            this.state = 'PAUSED';
            this.resetCombo();
            this.isPointerDown = false;
            this.lastPointer = null;
            this.bladeTrail = [];
            this.ui.onGamePause();
        }
    }

    resumeGame() {
        if (this.state === 'PAUSED') {
            this.state = 'PLAYING';
            this.lastTime = performance.now();
            this.ui.onGameResume();
        }
    }

    triggerGameOver() {
        if (this.state === 'GAMEOVER') return;
        this.state = 'GAMEOVER';
        this.pendingSpawns = [];
        this.resetCombo();
        this.screenShake = 0;
        this.isPointerDown = false;
        this.lastPointer = null;
        this.bladeTrail = [];
        if (this.score > this.highScore) {
            this.highScore = this.score;
            try { localStorage.setItem('health_battle_lifespan_record_v2', String(this.highScore)); } catch (e) {}
            this.ui.updateHighScore(this.highScore);
        }
        sounds.playGameOver();
        sounds.playHeartShatter();
        this.ui.onGameOver({
            score: this.score,
            highScore: this.highScore,
            isNewRecord: this.highScore > this.recordAtStart,
            healthyCuts: this.healthyCuts,
            bonusYears: this.bonusYears,
            lossHistory: this.lossHistory.slice(),
            baseYears: this.baseYears
        });
    }

    // حلقه بروزرسانی فیزیک و انیمیشن
    update(deltaTime) {
        if (this.state === 'GAMEOVER' || this.state === 'PAUSED') return;
        const frameStep = deltaTime * 60;
        // مدیریت لرزش صفحه هنگام سکته قلبی
        if (this.screenShake > 0) {
            this.screenShake--;
        }

        // بروزرسانی ذرات، لکه‌ها و متن‌ها
        this.particles.update();

        // پاکسازی مسیر قدیمی رد شمشیر
        const now = performance.now();
        if (this.lastComboCutTime !== null && now - this.lastComboCutTime >= 400) this.resetCombo();
        this.bladeTrail = this.bladeTrail.filter(p => now - p.time < 170);

        // بروزرسانی غذاهای در حال پرواز
        for (let i = this.foods.length - 1; i >= 0; i--) {
            const f = this.foods[i];

            f.x += f.vx * frameStep;
            f.y += f.vy * frameStep + 0.5 * f.gravity * frameStep * (frameStep - 1);
            f.vy += f.gravity * frameStep;
            f.angle += f.angularVelocity * frameStep;

            // اگر غذا سقوط کرد و از پایین صفحه خارج شد
            if (f.y > this.height + f.height + 50 && f.vy > 0) {

                this.foods.splice(i, 1);
            }
        }

        // بروزرسانی نیمه‌های قاچ‌شده غذا
        for (let i = this.halves.length - 1; i >= 0; i--) {
            const h = this.halves[i];
            h.x += h.vx * frameStep;
            h.y += h.vy * frameStep + 0.5 * h.gravity * frameStep * (frameStep - 1);
            h.vy += h.gravity * frameStep;
            h.angle += h.angularVelocity * frameStep;

            // خروج از صفحه
            if (h.y > this.height + h.h + 80) {
                this.halves.splice(i, 1);
            }
        }

        // اسپاون کردن امواج جدید غذا
        if (this.state === 'PLAYING') {
            this.difficultyTimer += deltaTime;
            this.spawnTimer += deltaTime;
            const currentInterval = Math.max(1.8, this.spawnInterval - this.difficultyTimer * 0.004);
            if (this.difficultyTimer + 1e-9 >= this.nextSpecialWaveAt) {
                const kind = Math.round(this.nextSpecialWaveAt / 10) % 2 === 0 ? 'mixed' : 'master';
                this.nextSpecialWaveAt += 10;
                this.spawnSpecialWave(kind);
                this.spawnTimer = 0;
            // Leave space before a special wave so regular food does not pile
            // into its deliberate layout. Pauses freeze this game-time clock.
            } else if (this.nextSpecialWaveAt - this.difficultyTimer > 3 && this.spawnTimer >= currentInterval) {
                this.spawnTimer = 0;
                this.spawnWave();
            }
            const ready = this.pendingSpawns.filter(spawn => spawn.at <= this.difficultyTimer + 1e-9);
            this.pendingSpawns = this.pendingSpawns.filter(spawn => spawn.at > this.difficultyTimer + 1e-9);
            ready.forEach(spawn => this.spawnSingleFood(spawn.curveType, spawn.index, spawn.count));
        }
    }

    // رندر کلی بازی
    render() {
        // Erase the entire surface before shaking or drawing cached layers.
        // A discarded/transparent background must never leave old fruit behind.
        this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        this.ctx.globalAlpha = 1;
        this.ctx.globalCompositeOperation = 'source-over';
        this.ctx.clearRect(0, 0, this.width, this.height);
        this.ctx.fillStyle = '#0c0704';
        this.ctx.fillRect(0, 0, this.width, this.height);
        this.ctx.save();

        // اعمال لرزش صفحه
        if (this.screenShake > 0) {
            const shakeMagnitude = (this.screenShake / 22) * 12;
            const sx = (Math.random() - 0.5) * shakeMagnitude;
            const sy = (Math.random() - 0.5) * shakeMagnitude;
            this.ctx.translate(sx, sy);
        }

        // ۱. پاکسازی صفحه با جلوه چوب سنتی دوجوی نینجا
        this.drawBackground();

        // ۲. رسم لکه‌های آبمیوه روی دیوار دوجو
        this.particles.drawDecals(this.ctx);

        // ۳. رسم نیمه‌های قاچ‌شده غذا (Halves)
        this.drawHalves();

        // ۴. رسم غذاهای کامل پروازی
        this.drawFoods();

        // ۵. رسم مسیر درخشان تیغه شمشیر (Blade Trail)
        this.drawBladeTrail();

        // ۶. رسم پارتیکل‌های معلق، جرقه‌ها، دود و متن‌های شناور
        this.particles.drawForeground(this.ctx);

        this.ctx.restore();
    }

    // پس‌زمینه با بافت تخته دوجو و نورپردازی ملایم
    drawBackground() {
        if (!this.backgroundCanvas) {
            const background = document.createElement('canvas');
            background.width = this.canvas.width;
            background.height = this.canvas.height;
            const ctx = background.getContext('2d');
            background.addEventListener('contextrestored', () => {
                if (this.backgroundCanvas === background) this.backgroundCanvas = null;
            });
            ctx.scale(this.dpr, this.dpr);
            this.paintBackground(ctx);
            this.backgroundCanvas = background;
        }
        this.ctx.drawImage(this.backgroundCanvas, 0, 0, this.width, this.height);
    }

    paintBackground(ctx) {
        // گرادیان گرم چوبی و نور مرکزی
        const grad = ctx.createRadialGradient(
            this.width / 2, this.height * 0.45, 80,
            this.width / 2, this.height * 0.5, Math.max(this.width, this.height) * 0.8
        );
        grad.addColorStop(0, '#2d1b10');
        grad.addColorStop(0.5, '#1e110a');
        grad.addColorStop(1, '#0c0704');

        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, this.width, this.height);

        // رسم خطوط ظریف الوارهای چوب
        ctx.save();
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.22)';
        ctx.lineWidth = 2;
        const plankHeight = 75;
        for (let y = plankHeight; y < this.height; y += plankHeight) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(this.width, y);
            ctx.stroke();
        }

        // سایه تاریک ملایم حاشیه صفحه (Vignette)
        const vignette = ctx.createRadialGradient(
            this.width / 2, this.height / 2, this.height * 0.4,
            this.width / 2, this.height / 2, Math.hypot(this.width, this.height) / 2
        );
        vignette.addColorStop(0, 'rgba(0,0,0,0)');
        vignette.addColorStop(1, 'rgba(0,0,0,0.65)');
        ctx.fillStyle = vignette;
        ctx.fillRect(0, 0, this.width, this.height);
        ctx.restore();
    }

    drawFoods() {
        for (const food of this.foods) {
            if (food.isCut) continue;
            const img = this.images.get(food.data.id);
            if (!img) continue;

            this.ctx.save();
            this.ctx.translate(food.x, food.y);
            this.ctx.rotate(food.angle);

            // هاله ملایم نور بر اساس سلامت یا زیان‌بار بودن
            if (food.data.type === 'unhealthy') {
                this.ctx.shadowColor = 'rgba(255, 23, 68, 0.6)';
                this.ctx.shadowBlur = 0;
            } else {
                this.ctx.shadowColor = 'rgba(255, 255, 255, 0.25)';
                this.ctx.shadowBlur = 0;
            }

            this.ctx.drawImage(img, -food.width / 2, -food.height / 2, food.width, food.height);

            // در حالت شروع، زیر هندوانه برچسب قاچ کردن بنویسیم
            if (food.isStartTrigger) {
                this.ctx.restore();
                this.ctx.save();
                this.ctx.font = "bold 20px 'Vazirmatn', Tahoma, sans-serif";
                this.ctx.fillStyle = "#ffffff";
                this.ctx.textAlign = "center";
                this.ctx.shadowColor = "#4caf50";
                this.ctx.shadowBlur = 0;
                this.ctx.fillText("برای شروع، هندوانه را قاچ کن! 🍉", food.x, food.y + food.height * 0.75);
                this.ctx.restore();
                continue;
            }

            this.ctx.restore();
        }
    }

    // رندر دقیق دو نیمه قاچ شده غذا با استفاده از Clipping در زاویه برش
    drawHalves() {
        for (const half of this.halves) {
            this.ctx.save();
            this.ctx.translate(half.x, half.y);
            this.ctx.rotate(half.angle);

            // زاویه برش در مختصات محلی این نیمه
            const localCutAngle = half.sliceAngle - half.initialAngle;
            this.ctx.rotate(localCutAngle);

            // ایجاد محدوده برش مستطیلی نیمی از غذا (Clip Path)
            this.ctx.beginPath();
            const clipRadius = Math.max(half.w, half.h) * 1.5;
            if (half.index === 0) {
                // نیمه بالایی خط برش
                this.ctx.rect(-clipRadius, -clipRadius, clipRadius * 2, clipRadius);
            } else {
                // نیمه پایینی خط برش
                this.ctx.rect(-clipRadius, 0, clipRadius * 2, clipRadius);
            }
            this.ctx.clip();

            // چرخش معکوس جهت ترسیم صحیح تصویر
            this.ctx.rotate(-localCutAngle);
            this.ctx.drawImage(half.img, -half.w / 2, -half.h / 2, half.w, half.h);

            // رسم لایه درخشان سطح مقطع برش‌خورده
            this.ctx.rotate(localCutAngle);
            this.ctx.beginPath();
            this.ctx.moveTo(-half.w * 0.42, 0);
            this.ctx.lineTo(half.w * 0.42, 0);
            this.ctx.strokeStyle = half.cutColor || 'rgba(255,255,255,0.85)';
            this.ctx.lineWidth = 3.5;
            this.ctx.stroke();

            this.ctx.restore();
        }
    }

    // رد درخشان و روان تیغه شمشیر نینجا (Smooth Glowing Blade Trail)
    drawBladeTrail() {
        if (this.bladeTrail.length < 2) return;

        this.ctx.save();
        const now = performance.now();

        // ۱. هسته نورانی بیرونی تیغه
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';

        for (let i = 1; i < this.bladeTrail.length; i++) {
            const p0 = this.bladeTrail[i - 1];
            const p1 = this.bladeTrail[i];
            const progress = i / this.bladeTrail.length;
            const age = (now - p1.time) / 170;
            const alpha = Math.max(0, 1 - age);

            this.ctx.beginPath();
            this.ctx.moveTo(p0.x, p0.y);
            this.ctx.lineTo(p1.x, p1.y);

            // هاله درخشان رنگی نئونی
            this.ctx.strokeStyle = `rgba(0, 229, 255, ${alpha * 0.75})`;
            this.ctx.lineWidth = 10 * progress;
            this.ctx.shadowColor = '#00e5ff';
            this.ctx.shadowBlur = 0;
            this.ctx.stroke();

            // هسته سفید لیزری درون تیغه
            this.ctx.beginPath();
            this.ctx.moveTo(p0.x, p0.y);
            this.ctx.lineTo(p1.x, p1.y);
            this.ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.95})`;
            this.ctx.lineWidth = 4 * progress;
            this.ctx.shadowBlur = 0;
            this.ctx.stroke();
        }

        this.ctx.restore();
    }

    // حلقه انیمیشن اصلی با requestAnimationFrame
    loop(timestamp) {
        if (!this.lastTime) this.lastTime = timestamp;
        const deltaTime = Math.min((timestamp - this.lastTime) / 1000, 0.1);
        this.lastTime = timestamp;

        if (this.state === 'START' || this.state === 'PLAYING') {
            this.update(deltaTime);
        }
        this.render();

        requestAnimationFrame((t) => this.loop(t));
    }

    startLoop() {
        this.lastTime = performance.now();
        requestAnimationFrame((t) => this.loop(t));
    }
}
