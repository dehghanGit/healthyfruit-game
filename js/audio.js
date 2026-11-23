// سیستم صوتی سنتزشده با Web Audio API (بدون وابستگی به فایل‌های خارجی)
// Audio Synthesizer for Health Battle Game

class SoundManager {
    constructor() {
        this.ctx = null;
        this.enabled = true;
        this.masterGain = null;
        this.initialized = false;
        
        // Load preference
        try {
            const saved = localStorage.getItem('health_battle_sound');
            if (saved !== null) {
                this.enabled = saved === 'true';
            }
        } catch (e) {}
    }

    init() {
        if (this.initialized) return;
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = this.enabled ? 0.8 : 0;
            this.masterGain.connect(this.ctx.destination);
            this.initialized = true;
        } catch (e) {
            console.warn('Web Audio API not supported', e);
        }
    }

    ensureContext() {
        if (!this.initialized) this.init();
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    toggleSound() {
        this.enabled = !this.enabled;
        if (this.masterGain && this.ctx) {
            this.masterGain.gain.setValueAtTime(this.enabled ? 0.8 : 0, this.ctx.currentTime);
        }
        try {
            localStorage.setItem('health_battle_sound', String(this.enabled));
        } catch (e) {}
        return this.enabled;
    }

    // صدای تاب خوردن تیغه در هوا (Swoosh)
    playSwoosh() {
        if (!this.enabled) return;
        this.ensureContext();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const bufferSize = this.ctx.sampleRate * 0.15;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(400, now);
        filter.frequency.exponentialRampToValueAtTime(1600, now + 0.05);
        filter.frequency.exponentialRampToValueAtTime(300, now + 0.15);
        filter.Q.value = 3.0;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.01, now);
        gain.gain.linearRampToValueAtTime(0.35, now + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        noise.start(now);
    }

    // صدای قاچ کردن آبدار میوه/غذای سالم (Juicy Cut)
    playCutHealthy() {
        if (!this.enabled) return;
        this.ensureContext();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;

        // مولفه اسلایس تیز (فرکانس بالا)
        const osc = this.ctx.createOscillator();
        const oscGain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(650 + Math.random() * 200, now);
        osc.frequency.exponentialRampToValueAtTime(140, now + 0.14);

        oscGain.gain.setValueAtTime(0.4, now);
        oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

        osc.connect(oscGain);
        oscGain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.15);

        // مولفه پاشش مایع آبدار (Squelch/Juice Pop)
        const bufferSize = this.ctx.sampleRate * 0.1;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.sin((i / bufferSize) * Math.PI);
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const popFilter = this.ctx.createBiquadFilter();
        popFilter.type = 'lowpass';
        popFilter.frequency.setValueAtTime(1800, now);
        popFilter.frequency.linearRampToValueAtTime(300, now + 0.1);

        const popGain = this.ctx.createGain();
        popGain.gain.setValueAtTime(0.35, now);
        popGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

        noise.connect(popFilter);
        popFilter.connect(popGain);
        popGain.connect(this.masterGain);
        noise.start(now);
    }

    // صدای مهیب سکته قلبی و ضربه غذاهای ناسالم (Heart Stroke)
    playHeartStroke() {
        if (!this.enabled) return;
        this.ensureContext();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;

        // ضربان تپش قلب وحشتناک (Thump 1)
        this.createHeartBeatThump(now, 0.9);
        // ضربان دوم تپش قلب (Thump 2)
        this.createHeartBeatThump(now + 0.18, 0.7);

        // آژیر اخطار تیز و دیسکوردانت (Buzzer)
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const alarmGain = this.ctx.createGain();

        osc1.type = 'sawtooth';
        osc2.type = 'square';
        osc1.frequency.setValueAtTime(220, now);
        osc2.frequency.setValueAtTime(233, now); // فاصله نیم‌پرده دیسکورد ناهنجار

        alarmGain.gain.setValueAtTime(0.5, now);
        alarmGain.gain.exponentialRampToValueAtTime(0.005, now + 0.45);

        osc1.connect(alarmGain);
        osc2.connect(alarmGain);
        alarmGain.connect(this.masterGain);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.45);
        osc2.stop(now + 0.45);
    }

    createHeartBeatThump(startTime, intensity = 1.0) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(95, startTime);
        osc.frequency.exponentialRampToValueAtTime(38, startTime + 0.18);

        gain.gain.setValueAtTime(0.6 * intensity, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.18);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(startTime);
        osc.stop(startTime + 0.2);
    }

    // صدای کمبوی برش چند غذا در یک حرکت
    playCombo(count) {
        if (!this.enabled) return;
        this.ensureContext();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50]; // گام ماژور
        const numNotes = Math.min(notes.length, Math.max(2, count));

        for (let i = 0; i < numNotes; i++) {
            const noteTime = now + i * 0.06;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(notes[i], noteTime);

            gain.gain.setValueAtTime(0.25, noteTime);
            gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.22);

            osc.connect(gain);
            gain.connect(this.masterGain);

            osc.start(noteTime);
            osc.stop(noteTime + 0.25);
        }
    }

    // صدای شکسته شدن قلب (Heart Shatter)
    playHeartShatter() {
        if (!this.enabled) return;
        this.ensureContext();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        // نویز شیشه‌ای خرد شونده
        const bufferSize = this.ctx.sampleRate * 0.25;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.2));
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(2200, now);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        noise.start(now);
    }

    // صدای پایان بازی (Game Over)
    playGameOver() {
        if (!this.enabled) return;
        this.ensureContext();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const notes = [311.13, 293.66, 277.18, 261.63, 196.00];

        notes.forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sawtooth';
            const noteTime = now + idx * 0.18;
            osc.frequency.setValueAtTime(freq, noteTime);

            gain.gain.setValueAtTime(0.25, noteTime);
            gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.35);

            osc.connect(gain);
            gain.connect(this.masterGain);

            osc.start(noteTime);
            osc.stop(noteTime + 0.4);
        });
    }

    // صدای کلیک یا لمس دکمه‌ها
    playClick() {
        if (!this.enabled) return;
        this.ensureContext();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(480, now);
        osc.frequency.exponentialRampToValueAtTime(240, now + 0.05);

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 0.06);
    }
}

export const sounds = new SoundManager();
