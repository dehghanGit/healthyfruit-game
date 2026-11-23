// مدیریت رابط کاربری و رویدادهای بازی «نبرد سلامت»
// UI Controller, Dialogs, Hearts Animation, Sound, Leaderboard & Registration

import { GameEngine } from './game.js';
import { sounds } from './audio.js';
import { FOOD_DATABASE, toPersianDigits } from './food-data.js';
import { api } from './api.js';

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));

document.addEventListener('DOMContentLoaded', () => {
    // المان‌های DOM
    const canvas = document.getElementById('gameCanvas');
    const scoreVal = document.getElementById('scoreVal');
    const highScoreVal = document.getElementById('highScoreVal');
    const heartsContainer = document.getElementById('heartsContainer');
    const startScreen = document.getElementById('startScreen');
    const hudBar = document.getElementById('hudBar');
    const healthToast = document.getElementById('healthToast');
    const toastTitle = document.getElementById('toastTitle');
    const toastDesc = document.getElementById('toastDesc');
    const screenFlash = document.getElementById('screenFlash');

    // دیالوگ‌های مدال
    const pauseDialog = document.getElementById('pauseDialog');
    const gameOverDialog = document.getElementById('gameOverDialog');
    const deathDialog = document.getElementById('deathDialog');
    let gameOverDelay = null;
    const guideDialog = document.getElementById('guideDialog');
    const registerDialog = document.getElementById('registerDialog');
    const leaderboardDialog = document.getElementById('leaderboardDialog');

    // دکمه‌های اصلی و نوار شروع
    const btnPause = document.getElementById('btnPause');
    const btnResume = document.getElementById('btnResume');
    const btnRestartFromPause = document.getElementById('btnRestartFromPause');
    const btnRestartGameOver = document.getElementById('btnRestartGameOver');
    const btnSound = document.getElementById('btnSound');
    const btnGuide = document.getElementById('btnGuide');
    const btnCloseGuide = document.getElementById('btnCloseGuide');
    const btnFullscreen = document.getElementById('btnFullscreen');
    const btnStartGameDirect = document.getElementById('btnStartGameDirect');
    const btnLeaderboardStart = document.getElementById('btnLeaderboardStart');
    const btnCloseLeaderboard = document.getElementById('btnCloseLeaderboard');

    // المان‌های پروفایل در صفحه شروع
    const playerProfileCard = document.getElementById('playerProfileCard');
    const playerDisplayName = document.getElementById('playerDisplayName');
    const playerMeta = document.getElementById('playerMeta');
    const btnEditProfile = document.getElementById('btnEditProfile');

    // المان‌های فرم ثبت‌نام
    const regFullName = document.getElementById('regFullName');
    const regCategory = document.getElementById('regCategory');
    const regSchool = document.getElementById('regSchool');
    const regClass = document.getElementById('regClass');
    const groupSchool = document.getElementById('groupSchool');
    const groupClass = document.getElementById('groupClass');
    const registerError = document.getElementById('registerError');
    const btnSubmitRegister = document.getElementById('btnSubmitRegister');
    const btnStartAnonymous = document.getElementById('btnStartAnonymous');
    const stageButtons = typeof document.querySelectorAll === 'function' ? document.querySelectorAll('.stage-btn') : [];

    // المان‌های لیدربرد
    const userRankBanner = document.getElementById('userRankBanner');
    const leaderboardList = document.getElementById('leaderboardList');
    const leaderboardLoading = document.getElementById('leaderboardLoading');
    const leaderboardEmpty = document.getElementById('leaderboardEmpty');
    const stickyUserRank = document.getElementById('stickyUserRank');
    const leaderboardTabs = typeof document.querySelectorAll === 'function' ? document.querySelectorAll('.leaderboard-tabs .tab-btn') : [];

    // المان‌های صفحه Game Over
    const finalScoreVal = document.getElementById('finalScoreVal');
    const finalHighScoreVal = document.getElementById('finalHighScoreVal');
    const gameOverTip = document.getElementById('gameOverTip');
    const gameOverRankBox = document.getElementById('gameOverRankBox');
    const gameOverRankDesc = document.getElementById('gameOverRankDesc');
    const anonUpgradeBox = document.getElementById('anonUpgradeBox');
    const btnAnonUpgrade = document.getElementById('btnAnonUpgrade');

    let onRegisterSuccessCallback = null;
    let onRegisterCancelCallback = null;

    // دسته‌بندی فعلی نمایش لیدربرد
    let activeLeaderboardCategory = 'elementary';

    // تولید ۵ قلب در نوار وضعیت
    function renderHearts(totalHearts = 5, activeHearts = 5) {
        heartsContainer.innerHTML = '';
        for (let i = 0; i < totalHearts; i++) {
            const heartDiv = document.createElement('div');
            heartDiv.className = 'heart-icon' + (i < activeHearts ? ' active' : ' broken');
            heartDiv.setAttribute('data-index', i);
            heartDiv.setAttribute('aria-label', `قلب شماره ${toPersianDigits(i + 1)}`);

            heartDiv.innerHTML = `
                <svg viewBox="0 0 32 32" class="heart-svg" aria-hidden="true">
                    <path class="heart-base" d="M16,28.5 C16,28.5 3,20.5 3,11.5 C3,7.5 6,4.5 10,4.5 C12.5,4.5 14.8,5.8 16,8 C17.2,5.8 19.5,4.5 22,4.5 C26,4.5 29,7.5 29,11.5 C29,20.5 16,28.5 16,28.5 Z" />
                    <path class="heart-crack" d="M16,6 L14,12 L18,17 L13,22 L16,27" />
                </svg>
            `;
            heartsContainer.appendChild(heartDiv);
        }
    }

    // بروزرسانی انیمیشن قلب‌ها هنگام سکته قلبی
    function updateHeartsDisplay(currentHearts) {
        const heartElements = heartsContainer.querySelectorAll('.heart-icon');
        heartElements.forEach((el, idx) => {
            if (idx >= currentHearts && el.classList.contains('active')) {
                el.classList.remove('active');
                el.classList.add('broken', 'stroke-anim');
            } else if (idx < currentHearts) {
                el.classList.add('active');
                el.classList.remove('broken', 'stroke-anim');
            }
        });
    }

    // افکت فلاش قرمز هنگام سکته قلبی
    function triggerHeartStrokeVignette() {
        screenFlash.classList.remove('active');
        void screenFlash.offsetWidth; // Force Reflow
        screenFlash.classList.add('active');
    }

    // نمایش پاپ‌آپ آموزشی کوتاه (Toast)
    let toastTimeout = null;
    function showToast(title, desc, isWarning = false, hazard = '') {
        if (!healthToast) return;
        const hazardTitle = document.getElementById('toastHazard');
        if (hazardTitle) {
            hazardTitle.textContent = hazard;
            hazardTitle.hidden = !hazard;
        }
        if (toastTitle) toastTitle.textContent = title;
        if (toastDesc) toastDesc.textContent = desc;

        healthToast.classList.toggle('warning-toast', isWarning);
        healthToast.classList.add('visible');

        clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => {
            healthToast.classList.remove('visible');
        }, 5000);
    }

    // بروزرسانی نشان پروفایل کاربر در صفحه شروع
    function updateProfileBadge(user) {
        if (!playerProfileCard) return;
        if (user) {
            playerProfileCard.hidden = false;
            playerDisplayName.textContent = user.name || 'بازیکن سلامت';
            let metaParts = [];
            if (user.category_fa) metaParts.push(user.category_fa);
            if (user.school) metaParts.push(user.school);
            if (user.grade_class) metaParts.push(`کلاس ${user.grade_class}`);
            playerMeta.textContent = metaParts.length > 0 ? metaParts.join(' · ') : (user.is_anonymous ? 'حالت ناشناس' : '');
            if (user.category && user.category !== 'anonymous') {
                activeLeaderboardCategory = user.category;
            }
        } else {
            playerProfileCard.hidden = true;
        }
    }

    // باز کردن مودال ثبت مشخصات
    function openRegisterModal(onSuccess = null, onCancel = null) {
        onRegisterSuccessCallback = onSuccess;
        onRegisterCancelCallback = onCancel;

        if (registerError) {
            registerError.hidden = true;
            registerError.textContent = '';
        }

        // اگر کاربر قبلی وجود دارد، فیلدها را پر کنیم
        const user = api.currentUser;
        if (user && !user.is_anonymous) {
            regFullName.value = user.name || '';
            regSchool.value = user.school || '';
            regClass.value = user.grade_class || '';
            selectCategory(user.category || 'elementary');
        } else {
            selectCategory('elementary');
        }

        registerDialog.showModal();
    }

    // انتخاب دوره تحصیلی و تنظیم فیلدهای شرطی مدرسه و کلاس
    function selectCategory(categoryKey) {
        if (regCategory) regCategory.value = categoryKey;

        stageButtons.forEach(btn => {
            if (btn.getAttribute('data-cat') === categoryKey) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // قوانین فیلدها طبق درخواست کاربر:
        // نام مدرسه: اگر ابتدایی یا متوسطه (۱ و ۲) بود
        // کلاس: فقط برای ابتدایی
        // سایر: بدون مدرسه و کلاس
        if (categoryKey === 'elementary') {
            if (groupSchool) groupSchool.hidden = false;
            if (groupClass) groupClass.hidden = false;
        } else if (categoryKey === 'middle' || categoryKey === 'high') {
            if (groupSchool) groupSchool.hidden = false;
            if (groupClass) groupClass.hidden = true;
        } else {
            // سایر
            if (groupSchool) groupSchool.hidden = true;
            if (groupClass) groupClass.hidden = true;
        }
    }

    // رویداد دکمه‌های مقطع تحصیلی در فرم
    stageButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            sounds.playClick();
            const cat = btn.getAttribute('data-cat');
            selectCategory(cat);
        });
    });

    // ثبت فرم مشخصات
    async function submitRegistrationForm() {
        sounds.playClick();
        const name = (regFullName.value || '').trim();
        const category = regCategory.value || 'elementary';
        const school = (regSchool ? regSchool.value : '').trim();
        const gradeClass = (regClass ? regClass.value : '').trim();

        if (!name) {
            if (registerError) {
                registerError.textContent = 'لطفاً نام و نام خانوادگی خود را وارد کنید.';
                registerError.hidden = false;
            }
            regFullName.focus();
            return;
        }

        if ((category === 'elementary' || category === 'middle' || category === 'high') && !school) {
            if (registerError) {
                registerError.textContent = 'لطفاً نام مدرسه را وارد کنید.';
                registerError.hidden = false;
            }
            if (regSchool) regSchool.focus();
            return;
        }

        if (category === 'elementary' && !gradeClass) {
            if (registerError) {
                registerError.textContent = 'لطفاً کلاس / پایه تحصیلی خود را وارد کنید.';
                registerError.hidden = false;
            }
            if (regClass) regClass.focus();
            return;
        }

        btnSubmitRegister.disabled = true;
        btnSubmitRegister.textContent = 'در حال ثبت...';

        const result = await api.registerPlayer({
            name,
            category,
            school,
            grade_class: gradeClass,
            is_anonymous: false
        });

        btnSubmitRegister.disabled = false;
        btnSubmitRegister.textContent = 'ثبت و شروع';

        if (result && result.success) {
            updateProfileBadge(result.player);
            registerDialog.close();
            if (typeof onRegisterSuccessCallback === 'function') {
                const cb = onRegisterSuccessCallback;
                onRegisterSuccessCallback = null;
                cb();
            }
        } else {
            if (registerError) {
                registerError.textContent = (result && result.error) || 'خطایی در ثبت اطلاعات رخ داد.';
                registerError.hidden = false;
            }
        }
    }

    // شروع ناشناس
    async function submitAnonymous() {
        sounds.playClick();
        btnStartAnonymous.disabled = true;
        const result = await api.registerPlayer({
            name: 'بازیکن ناشناس',
            is_anonymous: true
        });
        btnStartAnonymous.disabled = false;

        if (result && result.success) {
            updateProfileBadge(result.player);
            registerDialog.close();
            if (typeof onRegisterSuccessCallback === 'function') {
                const cb = onRegisterSuccessCallback;
                onRegisterSuccessCallback = null;
                cb();
            }
        }
    }

    if (btnSubmitRegister) btnSubmitRegister.addEventListener('click', submitRegistrationForm);
    if (btnStartAnonymous) btnStartAnonymous.addEventListener('click', submitAnonymous);

    if (btnEditProfile) {
        btnEditProfile.addEventListener('click', () => {
            sounds.playClick();
            openRegisterModal();
        });
    }

    if (registerDialog) {
        registerDialog.addEventListener('cancel', () => {
            if (typeof onRegisterCancelCallback === 'function') {
                const cb = onRegisterCancelCallback;
                onRegisterCancelCallback = null;
                cb();
            }
        });
    }

    // بارگذاری و نمایش لیدربرد
    async function loadLeaderboard(category = 'elementary') {
        activeLeaderboardCategory = category;

        // بروزرسانی کلاس فعال تب‌ها
        leaderboardTabs.forEach(tab => {
            const cat = tab.getAttribute('data-cat');
            tab.classList.toggle('active', cat === category);
        });

        if (leaderboardLoading) leaderboardLoading.hidden = false;
        if (leaderboardList) leaderboardList.innerHTML = '';
        if (leaderboardEmpty) leaderboardEmpty.hidden = true;
        if (stickyUserRank) stickyUserRank.hidden = true;

        const data = await api.fetchLeaderboard(category);

        if (leaderboardLoading) leaderboardLoading.hidden = true;

        if (!data || !data.success) {
            if (leaderboardEmpty) {
                leaderboardEmpty.textContent = 'خطا در برقراری ارتباط با سرور رتبه‌بندی.';
                leaderboardEmpty.hidden = false;
            }
            return;
        }

        // ۱. رندر بنر وضعیت کاربر فعلی
        renderUserRankBanner(data.user_rank, data.category_fa);

        // ۲. رندر لیست ۱۰ نفر برتر
        if (!data.top_players || data.top_players.length === 0) {
            if (leaderboardEmpty) {
                leaderboardEmpty.textContent = `هنوز رکوردی در رده «${data.category_fa}» ثبت نشده است. اولین قهرمان باشید!`;
                leaderboardEmpty.hidden = false;
            }
        } else {
            data.top_players.forEach((item) => {
                const row = document.createElement('div');
                row.className = 'leaderboard-item' + (item.is_current_user ? ' is-me' : '');

                let badgeClass = 'rank-badge';
                let rankDisplay = toPersianDigits(item.rank);
                if (item.rank === 1) {
                    badgeClass += ' rank-1';
                    rankDisplay = '🥇 ۱';
                } else if (item.rank === 2) {
                    badgeClass += ' rank-2';
                    rankDisplay = '🥈 ۲';
                } else if (item.rank === 3) {
                    badgeClass += ' rank-3';
                    rankDisplay = '🥉 ۳';
                }

                let subInfo = item.category_fa;
                if (item.school) {
                    subInfo += ` · ${item.school}`;
                    if (item.grade_class) subInfo += ` (${item.grade_class})`;
                }

                row.innerHTML = `
                    <div class="${badgeClass}">${rankDisplay}</div>
                    <div class="player-main-info">
                        <div class="player-rank-name">
                            <span>${escapeHtml(item.name)}</span>
                            ${item.is_current_user ? '<span class="you-tag">شما</span>' : ''}
                        </div>
                        <div class="player-school-sub">${escapeHtml(subInfo)}</div>
                    </div>
                    <div class="player-score-badge">
                        <span class="score-years">${toPersianDigits(item.best_score)}</span>
                        <span class="score-label-small">سال زندگی</span>
                    </div>
                `;
                leaderboardList.appendChild(row);
            });
        }

        // ۳. اگر کاربر خارج از ۱۰ نفر بود، در نوار پایین نشان بده
        if (data.user_rank && !data.user_rank.is_anonymous && data.user_rank.rank && !data.user_rank.in_top_10) {
            if (stickyUserRank) {
                stickyUserRank.hidden = false;
                stickyUserRank.innerHTML = `
                    🎯 <strong>جایگاه شما:</strong> رتبه <strong>${toPersianDigits(data.user_rank.rank)}</strong> از بین ${toPersianDigits(data.user_rank.total_in_pool)} مبارز (با رکورد ${toPersianDigits(data.user_rank.best_score)} سال)
                `;
            }
        }
    }

    // رندر کارت اطلاعات رتبه خود کاربر
    function renderUserRankBanner(userRank, categoryFa) {
        if (!userRankBanner) return;

        if (!userRank) {
            userRankBanner.className = 'user-rank-banner';
            userRankBanner.innerHTML = `
                <div class="user-rank-info">
                    <span class="user-rank-title">مبارز گرامی</span>
                    <strong class="user-rank-name">هنوز مشخصات خود را ثبت نکرده‌اید</strong>
                    <span class="user-rank-school">برای ثبت رکورد در جدول رتبه‌بندی مشخصات خود را وارد کنید</span>
                </div>
                <button type="button" class="btn-primary" id="btnBannerRegister" style="padding: 8px 16px; font-size: 13px;">ثبت‌نام</button>
            `;
            const btnReg = document.getElementById('btnBannerRegister');
            if (btnReg) {
                btnReg.addEventListener('click', () => {
                    leaderboardDialog.close();
                    openRegisterModal();
                });
            }
            return;
        }

        if (userRank.is_anonymous) {
            userRankBanner.className = 'user-rank-banner';
            userRankBanner.innerHTML = `
                <div class="user-rank-info">
                    <span class="user-rank-title">وضعیت کاربر</span>
                    <strong class="user-rank-name">کاربر ناشناس</strong>
                    <span class="user-rank-school">برای محاسبه و نمایش رتبه در جدول، نام و مقطع خود را انتخاب کنید</span>
                </div>
                <button type="button" class="btn-upgrade-action" id="btnBannerUpgrade" style="font-size: 13px;">ثبت مشخصات</button>
            `;
            const btnUpg = document.getElementById('btnBannerUpgrade');
            if (btnUpg) {
                btnUpg.addEventListener('click', () => {
                    leaderboardDialog.close();
                    openRegisterModal();
                });
            }
            return;
        }

        userRankBanner.className = 'user-rank-banner highlight-rank';
        const rankText = userRank.rank ? toPersianDigits(userRank.rank) : '-';
        let schoolDesc = userRank.category_fa;
        if (userRank.school) schoolDesc += ` · ${userRank.school}`;
        if (userRank.grade_class) schoolDesc += ` · کلاس ${userRank.grade_class}`;

        userRankBanner.innerHTML = `
            <div class="user-rank-info">
                <span class="user-rank-title">جایگاه شما در ${escapeHtml(categoryFa)}</span>
                <strong class="user-rank-name">${escapeHtml(userRank.name)}</strong>
                <span class="user-rank-school">${escapeHtml(schoolDesc)}</span>
            </div>
            <div class="user-rank-stat">
                <span class="user-rank-number">${rankText}</span>
                <span class="user-rank-stat-label">رتبه من</span>
            </div>
        `;
    }

    // کلیک روی تب‌های لیدربرد
    leaderboardTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            sounds.playClick();
            const cat = tab.getAttribute('data-cat');
            loadLeaderboard(cat);
        });
    });

    function showLeaderboardModal() {
        sounds.playClick();
        let targetCat = 'elementary';
        if (api.currentUser && api.currentUser.category && api.currentUser.category !== 'anonymous') {
            targetCat = api.currentUser.category;
        }
        loadLeaderboard(targetCat);
        leaderboardDialog.showModal();
    }

    if (btnLeaderboardStart) btnLeaderboardStart.addEventListener('click', showLeaderboardModal);
    if (btnCloseLeaderboard) {
        btnCloseLeaderboard.addEventListener('click', () => {
            leaderboardDialog.close();
        });
    }

    // پیشنهاد ارتقای حساب کاربری ناشناس در صفحه Game Over
    if (btnAnonUpgrade) {
        btnAnonUpgrade.addEventListener('click', () => {
            sounds.playClick();
            openRegisterModal(() => {
                if (anonUpgradeBox) anonUpgradeBox.hidden = true;
                if (gameOverRankBox && gameOverRankDesc) {
                    gameOverRankDesc.textContent = 'مشخصات شما با موفقیت ثبت و رتبه شما محاسبه شد!';
                }
            });
        });
    }

    // تعریف اتصالات موتور بازی به رابط کاربری
    const uiHooks = {
        updateScore: (score) => {
            scoreVal.textContent = toPersianDigits(score);
        },
        updateHighScore: (highScore) => {
            highScoreVal.textContent = toPersianDigits(highScore);
            document.getElementById('startHighScoreVal').textContent = toPersianDigits(highScore);
        },
        updateHearts: (hearts) => {
            updateHeartsDisplay(hearts);
            triggerHeartStrokeVignette();
        },
        checkCanStart: () => {
            // آیا بازیکن کوکی فعال دارد یا قبلاً فرم را پر کرده؟
            return Boolean(api.currentUser);
        },
        requestRegistration: (onSuccess, onCancel) => {
            openRegisterModal(onSuccess, onCancel);
        },
        onGameStart: () => {
            clearTimeout(gameOverDelay);
            if (deathDialog.open) deathDialog.close();
            startScreen.classList.add('hidden');
            hudBar.classList.remove('hidden');
            renderHearts(5, 5);
            clearTimeout(toastTimeout);
            healthToast.classList.remove('visible', 'warning-toast');
            showToast('🌱 زندگی تازه: ۱۰ سال', 'هر غذای سالم +۱ سال؛ زنجیره سالم بساز و بیشتر زندگی کن!');
        },
        onGamePause: () => {
            pauseDialog.showModal();
        },
        onGameResume: () => {
            if (pauseDialog.open) pauseDialog.close();
        },
        onGameOver: ({ score, highScore, healthyCuts, bonusYears, lossHistory, baseYears, isNewRecord }) => {
            finalScoreVal.textContent = toPersianDigits(score);
            finalHighScoreVal.textContent = `${toPersianDigits(highScore)} سال`;
            document.getElementById('lifeSummary').textContent = healthyCuts > 0
                ? `با ${toPersianDigits(healthyCuts)} انتخاب سالم، به زندگی‌ات فرصت بیشتری دادی.`
                : 'این بار کوتاه بود؛ زندگی بعدی را با یک انتخاب سالم شروع کن.';
            document.getElementById('earnedYears').textContent = `+${toPersianDigits(healthyCuts)}`;
            document.getElementById('bonusYears').textContent = `+${toPersianDigits(bonusYears)}`;
            document.getElementById('lostYears').textContent = `−${toPersianDigits(lossHistory.length * 2)}`;
            document.getElementById('gameOverTitle').textContent = 'انتخاب‌های من، زندگی من!';
            document.getElementById('newRecordBadge').hidden = !isNewRecord;
            const reasons = document.getElementById('deathReasons');
            reasons.replaceChildren();
            lossHistory.forEach((loss) => {
                const li = document.createElement('li');
                const title = document.createElement('strong');
                title.textContent = loss.title;
                const desc = document.createElement('p');
                desc.textContent = `${loss.food} · −۲ سال`;
                li.title = loss.description;
                li.append(title, desc);
                reasons.appendChild(li);
            });
            gameOverTip.textContent = 'هر انتخاب سالم، یک فرصت بیشتر برای زندگی.';

            // بازنشانی وضعیت نمایش رتبه در مدال
            if (gameOverRankBox) gameOverRankBox.hidden = true;
            if (anonUpgradeBox) anonUpgradeBox.hidden = true;

            // ارسال امتیاز به سرور پایتون برای ذخیره در دیتابیس و محاسبه رتبه
            if (typeof api !== 'undefined' && typeof api.submitScore === 'function') {
                api.submitScore({ score, healthy_cuts: healthyCuts, bonus_years: bonusYears }).then(result => {
                    if (result && result.success) {
                        if (gameOverRankBox && gameOverRankDesc) {
                            if (result.rank_category) {
                                gameOverRankDesc.textContent = `رتبه ${toPersianDigits(result.rank_category)} در مقطع تحصیلی (رکورد: ${toPersianDigits(result.best_score)} سال)`;
                                gameOverRankBox.hidden = false;
                            } else if (result.rank_overall) {
                                gameOverRankDesc.textContent = `رتبه ${toPersianDigits(result.rank_overall)} در کل بازیکنان (رکورد: ${toPersianDigits(result.best_score)} سال)`;
                                gameOverRankBox.hidden = false;
                            }
                        }
                        if (anonUpgradeBox && (!api.currentUser || api.currentUser.is_anonymous)) {
                            anonUpgradeBox.hidden = false;
                        }
                    }
                }).catch(() => {});
            }

            clearTimeout(gameOverDelay);
            gameOverDelay = setTimeout(() => {
                healthToast.classList.remove('visible');
                deathDialog.showModal();
            }, 2000);
        },
        showHealthTip: (food) => {
            showToast(`${food.toastLabelFa} \u2066+۱\u2069:`, food.toastDescriptionFa, false);
        },
        showHazardWarning: (food, risk) => {
            showToast(`${food.toastLabelFa} \u2066−۲\u2069:`, food.nameFa, true, risk.title.replace('خطر حمله قلبی', 'سکته قلبی'));
        }
    };

    // راه‌اندازی موتور بازی
    const game = new GameEngine(canvas, uiHooks);
    renderHearts(5, 5);
    highScoreVal.textContent = toPersianDigits(game.highScore);
    document.getElementById('startHighScoreVal').textContent = toPersianDigits(game.highScore);
    game.startLoop();

    // بررسی اولیه کوکی کاربر از سرور
    api.fetchCurrentUser().then(user => {
        if (user) {
            updateProfileBadge(user);
            if (user.best_score && user.best_score > game.highScore) {
                game.highScore = user.best_score;
                highScoreVal.textContent = toPersianDigits(game.highScore);
                document.getElementById('startHighScoreVal').textContent = toPersianDigits(game.highScore);
            }
        }
    }).catch(() => {});

    // دکمه شروع مستقیم در صفحه اول
    if (btnStartGameDirect) {
        btnStartGameDirect.addEventListener('click', () => {
            sounds.playClick();
            if (uiHooks.checkCanStart()) {
                game.startGame();
            } else {
                openRegisterModal(() => {
                    game.startGame();
                });
            }
        });
    }

    // مدیریت کنترل‌های دکمه‌ها
    btnPause.addEventListener('click', () => {
        sounds.playClick();
        game.pauseGame();
    });

    pauseDialog.addEventListener('close', () => {
        game.resumeGame();
    });

    btnResume.addEventListener('click', () => {
        sounds.playClick();
        game.resumeGame();
    });

    btnRestartFromPause.addEventListener('click', () => {
        sounds.playClick();
        pauseDialog.close();
        game.startGame();
    });

    document.getElementById('btnContinueResults').addEventListener('click', () => {
        sounds.playClick();
        deathDialog.close();
        gameOverDialog.showModal();
    });
    [deathDialog, gameOverDialog].forEach(dialog => {
        dialog.addEventListener('cancel', event => event.preventDefault());
    });

    btnRestartGameOver.addEventListener('click', () => {
        sounds.playClick();
        clearTimeout(gameOverDelay);
        clearTimeout(toastTimeout);
        gameOverDialog.close();
        healthToast.classList.remove('visible', 'warning-toast');
        hudBar.classList.add('hidden');
        startScreen.classList.remove('hidden');
        game.returnToStart();
    });

    // دکمه صدا (قطع / وصل)
    function updateSoundBtnText(enabled) {
        btnSound.innerHTML = enabled ? '🔊 صدا: روشن' : '🔇 صدا: خاموش';
        btnSound.setAttribute('aria-pressed', String(enabled));
    }
    updateSoundBtnText(sounds.enabled);

    btnSound.addEventListener('click', () => {
        const isEnabled = sounds.toggleSound();
        updateSoundBtnText(isEnabled);
        if (isEnabled) sounds.playClick();
    });

    // دکمه راهنمای بازی
    btnGuide.addEventListener('click', () => {
        sounds.playClick();
        populateGuideLists();
        guideDialog.showModal();
    });

    btnCloseGuide.addEventListener('click', () => {
        guideDialog.close();
    });

    // پر کردن فهرست غذاهای سالم و ناسالم در راهنما
    function populateGuideLists() {
        const healthyList = document.getElementById('guideHealthyList');
        const unhealthyList = document.getElementById('guideUnhealthyList');

        if (!healthyList || !unhealthyList || healthyList.children.length > 0) return;

        FOOD_DATABASE.healthy.forEach(item => {
            const card = document.createElement('div');
            card.className = 'guide-card healthy-card';
            card.innerHTML = `
                <img src="${item.image}" alt="${item.nameFa}" class="guide-item-img" loading="lazy">
                <div class="guide-item-info">
                    <strong>${item.nameFa}</strong>
                    <span class="guide-cat">${item.categoryFa}</span>
                    <p class="guide-benefit">${item.benefitFa}</p>
                </div>
            `;
            healthyList.appendChild(card);
        });

        FOOD_DATABASE.unhealthy.forEach(item => {
            const card = document.createElement('div');
            card.className = 'guide-card unhealthy-card';
            card.innerHTML = `
                <img src="${item.image}" alt="${item.nameFa}" class="guide-item-img" loading="lazy">
                <div class="guide-item-info">
                    <strong>${item.nameFa}</strong>
                    <span class="guide-cat danger-tag">${item.categoryFa}</span>
                    <p class="guide-harm">${item.harmFa}</p>
                </div>
            `;
            unhealthyList.appendChild(card);
        });
    }

    // حالت تمام‌صفحه (Fullscreen)
    btnFullscreen.addEventListener('click', () => {
        sounds.playClick();
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {});
            btnFullscreen.textContent = '🗗 خروج';
        } else {
            document.exitFullscreen().catch(() => {});
            btnFullscreen.textContent = '⛶ تمام‌صفحه';
        }
    });

    // بستن دیالوگ‌ها با کلیک روی پس‌زمینه (Light dismiss fallback)
    [pauseDialog, gameOverDialog, guideDialog, registerDialog, leaderboardDialog].forEach(dialog => {
        if (!dialog) return;
        dialog.addEventListener('click', (e) => {
            const rect = dialog.getBoundingClientRect();
            const isInDialog = (
                rect.top <= e.clientY && e.clientY <= rect.top + rect.height &&
                rect.left <= e.clientX && e.clientX <= rect.left + rect.width
            );
            if (!isInDialog) {
                if (dialog !== gameOverDialog) {
                    dialog.close();
                    if (dialog === pauseDialog) game.resumeGame();
                    if (dialog === registerDialog && typeof onRegisterCancelCallback === 'function') {
                        const cb = onRegisterCancelCallback;
                        onRegisterCancelCallback = null;
                        cb();
                    }
                }
            }
        });
    });
});
