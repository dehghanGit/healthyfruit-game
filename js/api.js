// ارتباط با سرور و APIهای بازی «نبرد سلامت»
// Backend API Client for Leaderboard, Registration, Profiles & Scores

export const api = {
    currentUser: null,

    // دریافت اطلاعات کاربر فعلی از کوکی
    async fetchCurrentUser() {
        if (typeof fetch === 'undefined') return null;
        try {
            const res = await fetch('/api/me', { credentials: 'include' });
            if (!res.ok) return null;
            const data = await res.json();
            if (data.success && data.player) {
                this.currentUser = data.player;
                return this.currentUser;
            }
        } catch (e) {
            console.warn('API fetchCurrentUser error:', e);
        }
        return null;
    },

    // ثبت‌نام یا شروع ناشناس
    async registerPlayer({ name, category, school, grade_class, is_anonymous = false }) {
        if (typeof fetch === 'undefined') return null;
        try {
            const res = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ name, category, school, grade_class, is_anonymous })
            });
            const data = await res.json();
            if (data.success && data.player) {
                this.currentUser = data.player;
                return { success: true, player: data.player };
            }
            return { success: false, error: data.error || 'خطا در ثبت اطلاعات' };
        } catch (e) {
            console.error('API registerPlayer error:', e);
            return { success: false, error: 'خطا در برقراری ارتباط با سرور' };
        }
    },

    // ثبت امتیاز پایان بازی
    async submitScore({ score, healthy_cuts, bonus_years }) {
        if (typeof fetch === 'undefined') return null;
        try {
            const res = await fetch('/api/score', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ score, healthy_cuts, bonus_years })
            });
            const data = await res.json();
            if (data.success) {
                if (this.currentUser) {
                    this.currentUser.best_score = data.best_score;
                    this.currentUser.rank_category = data.rank_category;
                    this.currentUser.rank_overall = data.rank_overall;
                }
                return data;
            }
        } catch (e) {
            console.warn('API submitScore error:', e);
        }
        return null;
    },

    // دریافت داده‌های لیدربرد بر اساس مقطع
    async fetchLeaderboard() {
        if (typeof fetch === 'undefined') return null;
        try {
            const res = await fetch('/api/leaderboard', {
                credentials: 'include'
            });
            if (!res.ok) return null;
            return await res.json();
        } catch (e) {
            console.warn('API fetchLeaderboard error:', e);
            return null;
        }
    }
};
