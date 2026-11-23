// سیستم پارتیکل و افکت‌های بصری بازی «نبرد سلامت»
// Particles, Juice Splatters, Wall Decals, and Floating Text

export class ParticleSystem {
    constructor() {
        this.particles = [];
        this.decals = [];
        this.floatingTexts = [];
        this.sparks = [];
        this.smokes = [];
    }

    // ایجاد پاشش آبمیوه یا سس طبیعی (Juice Splatter)
    createJuiceSplash(x, y, colors, sliceAngle = 0, count = 16) {
        // انتخاب رنگ‌های پاشش
        const primaryColor = colors[0] || '#ff3b30';
        count = Math.max(0, Math.min(count, 16, 96 - this.particles.length));
        
        // ذرات مایع
        for (let i = 0; i < count; i++) {
            const spread = (Math.random() - 0.5) * 1.8;
            // پاشش در راستای عمود بر خط برش و با مقداری پخش زاویه‌ای
            const baseAngle = sliceAngle + (Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
            const angle = baseAngle + spread;
            const speed = 3 + Math.random() * 11;
            const size = 3 + Math.random() * 7;
            const color = colors[Math.floor(Math.random() * colors.length)];

            this.particles.push({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - (1 + Math.random() * 3), // جهش جزئی به بالا
                size,
                initialSize: size,
                color,
                alpha: 1.0,
                decay: 0.015 + Math.random() * 0.02,
                gravity: 0.28,
                drag: 0.985
            });
        }

        // ایجاد لکه آبمیوه روی پس‌زمینه چوبی (Wall Decal)
        this.createWallDecal(x, y, primaryColor);
    }

    // ایجاد افکت دود سمی و روغن سوخته برای غذاهای ناسالم
    createToxicBurst(x, y, colors, count = 12) {
        count = Math.max(0, Math.min(count, 12, 36 - this.smokes.length));
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 2 + Math.random() * 9;
            const size = 6 + Math.random() * 14;
            const color = colors[Math.floor(Math.random() * colors.length)] || '#212121';

            this.smokes.push({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 2,
                size,
                maxSize: size * (1.6 + Math.random() * 0.8),
                color,
                alpha: 0.9,
                decay: 0.02 + Math.random() * 0.025,
                rotation: Math.random() * Math.PI * 2,
                rotSpeed: (Math.random() - 0.5) * 0.1
            });
        }

        // جرقه‌های هشدار و خطر
        const sparkCount = Math.max(0, Math.min(6, 48 - this.sparks.length));
        for (let i = 0; i < sparkCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 4 + Math.random() * 8;
            this.sparks.push({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: 2 + Math.random() * 3,
                color: Math.random() < 0.5 ? '#ff1744' : '#ffea00',
                alpha: 1.0,
                decay: 0.035 + Math.random() * 0.03
            });
        }

        // لکه سیاه و سوخته روی دیوار
        this.createWallDecal(x, y, '#212121', 0.85, 38);
    }

    // لکه چسبنده روی تخته چوبی پس‌زمینه (Decal)
    createWallDecal(x, y, color, baseAlpha = 0.55, baseRadius = 32) {
        // ایجاد چندین قطره ارگانیک متصل به لکه اصلی
        const splatDrops = [];
        const numDrops = 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < numDrops; i++) {
            const dropAngle = Math.random() * Math.PI * 2;
            const dropDist = (0.4 + Math.random() * 0.8) * baseRadius;
            splatDrops.push({
                dx: Math.cos(dropAngle) * dropDist,
                dy: Math.sin(dropAngle) * dropDist,
                r: (0.2 + Math.random() * 0.4) * baseRadius
            });
        }

        this.decals.push({
            x,
            y,
            radius: baseRadius * (0.8 + Math.random() * 0.5),
            color,
            alpha: baseAlpha,
            decay: 0.0018, // حدود ۸ تا ۱۰ ثانیه روی دیوار می‌ماند
            drops: splatDrops
        });

        // محدود کردن تعداد لکه‌ها جهت بازدهی روان ۶۰ فریم بر ثانیه
        if (this.decals.length > 10) {
            this.decals.shift();
        }
    }

    // ایجاد جرقه‌های درخشان تیغه شمشیر (Blade Sparks)
    createBladeSparks(x, y, vx, vy, count = 1) {
        count = Math.max(0, Math.min(count, 1, 48 - this.sparks.length));
        for (let i = 0; i < count; i++) {
            const angle = Math.atan2(vy, vx) + (Math.random() - 0.5) * 1.2;
            const speed = 1.5 + Math.random() * 4;
            this.sparks.push({
                x: x + (Math.random() - 0.5) * 10,
                y: y + (Math.random() - 0.5) * 10,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: 1.5 + Math.random() * 2.5,
                color: '#ffffff',
                alpha: 1.0,
                decay: 0.05 + Math.random() * 0.04
            });
        }
    }

    // متن متحرک شناور (امتیاز، کومبو، اخطار سکته قلبی)
    addFloatingText(x, y, text, color = '#ffffff', fontSize = 26, isCrit = false) {
        if (this.floatingTexts.length >= 8) this.floatingTexts.shift();
        this.floatingTexts.push({
            x,
            y,
            text,
            color,
            fontSize,
            isCrit,
            vy: isCrit ? -2.8 : -2.0,
            alpha: 1.0,
            scale: 0.6,
            targetScale: isCrit ? 1.4 : 1.0,
            life: 1.0,
            decay: 0.02
        });
    }

    update() {
        // ۱. بروزرسانی ذرات مایع
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += p.gravity;
            p.vx *= p.drag;
            p.vy *= p.drag;
            p.alpha -= p.decay;
            p.size = Math.max(0.5, p.initialSize * (p.alpha));

            if (p.alpha <= 0) {
                this.particles.splice(i, 1);
            }
        }

        // ۲. بروزرسانی لکه‌های پس‌زمینه
        for (let i = this.decals.length - 1; i >= 0; i--) {
            const d = this.decals[i];
            d.alpha -= d.decay;
            if (d.alpha <= 0) {
                this.decals.splice(i, 1);
            }
        }

        // ۳. بروزرسانی جرقه‌ها
        for (let i = this.sparks.length - 1; i >= 0; i--) {
            const s = this.sparks[i];
            s.x += s.vx;
            s.y += s.vy;
            s.alpha -= s.decay;
            if (s.alpha <= 0) {
                this.sparks.splice(i, 1);
            }
        }

        // ۴. بروزرسانی دود سمی
        for (let i = this.smokes.length - 1; i >= 0; i--) {
            const sm = this.smokes[i];
            sm.x += sm.vx;
            sm.y += sm.vy;
            sm.rotation += sm.rotSpeed;
            if (sm.size < sm.maxSize) {
                sm.size += 0.4;
            }
            sm.alpha -= sm.decay;
            if (sm.alpha <= 0) {
                this.smokes.splice(i, 1);
            }
        }

        // ۵. بروزرسانی متن‌های شناور
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            const ft = this.floatingTexts[i];
            ft.y += ft.vy;
            ft.vy *= 0.94; // کم کردن سرعت صعود
            if (ft.scale < ft.targetScale) {
                ft.scale += 0.12;
            }
            ft.alpha -= ft.decay;
            if (ft.alpha <= 0) {
                this.floatingTexts.splice(i, 1);
            }
        }
    }

    // رندر لکه‌های پس‌زمینه (زیر غذاها)
    drawDecals(ctx) {
        if (this.decals.length === 0) return;
        ctx.save();
        for (const d of this.decals) {
            ctx.save();
            ctx.globalAlpha = d.alpha;
            ctx.fillStyle = d.color;

            // لکه مرکزی
            ctx.beginPath();
            ctx.arc(d.x, d.y, d.radius * 0.6, 0, Math.PI * 2);
            ctx.fill();

            // قطرات متصل ارگانیک
            for (const drop of d.drops) {
                ctx.beginPath();
                ctx.arc(d.x + drop.dx, d.y + drop.dy, drop.r, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }
        ctx.restore();
    }

    // رندر ذرات فعال، دود و متن‌ها (بالای غذاها)
    drawForeground(ctx) {
        ctx.save();

        // رسم دود سمی
        for (const sm of this.smokes) {
            ctx.globalAlpha = sm.alpha * 0.6;
            ctx.fillStyle = sm.color;
            ctx.beginPath();
            ctx.arc(sm.x, sm.y, sm.size, 0, Math.PI * 2);
            ctx.fill();
        }

        for (const s of this.sparks) {
            ctx.globalAlpha = s.alpha;
            ctx.fillStyle = s.color;
            ctx.fillRect(s.x - s.size / 2, s.y - s.size / 2, s.size, s.size);
        }

        for (const p of this.particles) {
            ctx.globalAlpha = p.alpha;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        }

        for (const ft of this.floatingTexts) {
            ctx.save();
            ctx.globalAlpha = Math.max(0, ft.alpha);
            ctx.translate(ft.x, ft.y);
            ctx.scale(ft.scale, ft.scale);

            ctx.font = `bold ${ft.fontSize}px 'Vazirmatn', Tahoma, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.direction = 'rtl';

            // حاشیه تیره جهت خوانایی بالا
            ctx.lineWidth = ft.isCrit ? 5 : 4;
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
            ctx.strokeText(ft.text, 0, 0);

            // درخشش متن
            ctx.shadowColor = ft.color;
            ctx.shadowBlur = 0;
            ctx.fillStyle = ft.color;
            ctx.fillText(ft.text, 0, 0);

            ctx.restore();
        }

        ctx.restore();
    }

    clear() {
        this.particles = [];
        this.decals = [];
        this.floatingTexts = [];
        this.sparks = [];
        this.smokes = [];
    }
}
