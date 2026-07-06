/* ============================================
   个人博客 - Application Logic
   Data persisted in SQLite via REST API
   ============================================ */

// ============================================
// Auth State (session-based)
// ============================================
function getAuthToken() {
    return sessionStorage.getItem('blog_auth_token');
}

function setAuthToken(token) {
    sessionStorage.setItem('blog_auth_token', token);
}

function clearAuthToken() {
    sessionStorage.removeItem('blog_auth_token');
}

function isLoggedIn() {
    return !!getAuthToken();
}

// Queue a callback to run after successful login (or a {resolve, reject} for API retries)
let pendingAuthCallback = null;
let pendingAuthReject = null;

function requireLogin(callback) {
    if (isLoggedIn()) {
        callback();
    } else {
        pendingAuthCallback = callback;
        pendingAuthReject = null; // No reject for direct callbacks
        openModal('login-modal-overlay');
    }
}

function clearPendingAuth() {
    if (pendingAuthReject) {
        pendingAuthReject(new Error('取消登录'));
    }
    pendingAuthCallback = null;
    pendingAuthReject = null;
}

// ============================================
// User Identity (only for like tracking)
// ============================================
function getUserToken() {
    let token = localStorage.getItem('blog_user_token');
    if (!token) {
        token = 'u_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
        localStorage.setItem('blog_user_token', token);
    }
    return token;
}

// ============================================
// API Client
// ============================================
const API = {
    _base: '/api',

    async _request(method, path, body = null, auth = false) {
        const opts = {
            method,
            headers: { 'Content-Type': 'application/json' }
        };
        if (auth) {
            const token = getAuthToken();
            if (token) {
                opts.headers['Authorization'] = 'Bearer ' + token;
            }
        }
        if (body) opts.body = JSON.stringify(body);

        const res = await fetch(this._base + path, opts);
        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: '请求失败' }));
            // If auth is required but missing/expired, wait for login then retry
            if (res.status === 401 && err.requireAuth) {
                clearAuthToken();
                updateLoginUI();
                return new Promise((resolve, reject) => {
                    pendingAuthReject = reject;
                    pendingAuthCallback = async () => {
                        pendingAuthReject = null;
                        try {
                            const result = await this._request(method, path, body, auth);
                            resolve(result);
                        } catch (retryErr) {
                            reject(retryErr);
                        }
                    };
                    openModal('login-modal-overlay');
                });
            }
            throw new Error(err.error || `HTTP ${res.status}`);
        }
        return res.json();
    },

    _get(path) { return this._request('GET', path); },
    _post(path, body, auth = false) { return this._request('POST', path, body, auth); },
    _put(path, body, auth = false) { return this._request('PUT', path, body, auth); },
    _delete(path, body, auth = false) { return this._request('DELETE', path, body, auth); },

    // --- Auth ---
    login(username, password) { return this._post('/auth/login', { username, password }); },

    // --- Profile ---
    getProfile() { return this._get('/profile'); },

    saveProfile(profile) { return this._put('/profile', profile, true); },

    // --- Articles ---
    getArticles(params = {}) {
        const qs = new URLSearchParams();
        if (params.category) qs.set('category', params.category);
        if (params.subcategory) qs.set('subcategory', params.subcategory);
        if (params.search) qs.set('search', params.search);
        if (params.sort) qs.set('sort', params.sort);
        const q = qs.toString();
        return this._get('/articles' + (q ? '?' + q : ''));
    },

    getArticle(id) { return this._get('/articles/' + id); },

    saveArticle(article) {
        if (article.id) {
            return this._put('/articles/' + article.id, article, true);
        } else {
            return this._post('/articles', article, true);
        }
    },

    deleteArticle(id) { return this._delete('/articles/' + id, null, true); },

    togglePin(id) { return this._post('/articles/' + id + '/toggle-pin', null, true); },

    getCategories() { return this._get('/categories'); },

    // --- Likes ---
    getLikes(articleId) {
        return this._get('/articles/' + articleId + '/likes?userToken=' + encodeURIComponent(getUserToken()));
    },

    toggleLike(articleId) {
        // We need to know current state — fetch first then toggle
        return this.getLikes(articleId).then(state => {
            if (state.isLiked) {
                return this._delete('/articles/' + articleId + '/like', { userToken: getUserToken() });
            } else {
                return this._post('/articles/' + articleId + '/like', { userToken: getUserToken() });
            }
        });
    },

    // --- Comments ---
    getComments(articleId) { return this._get('/articles/' + articleId + '/comments'); },

    addComment(articleId, author, content) {
        return this._post('/articles/' + articleId + '/comments', { author, content });
    },

    deleteComment(commentId) {
        return this._delete('/comments/' + commentId);
    },

    // --- Demo Data ---
    initDemoData() { return this._post('/demo/init'); }
};

// ============================================
// Date & Weather
// ============================================
function updateDateTime() {
    const now = new Date();
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const w = weekdays[now.getDay()];
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');

    const dateEl = document.getElementById('header-date');
    if (dateEl) {
        dateEl.innerHTML = `<i class="fa-regular fa-calendar"></i> ${y}年${m}月${d}日 星期${w} <span style="margin-left:4px;color:var(--primary);font-weight:600">${hh}:${mm}</span>`;
    }
}

// ── Weather: Open-Meteo (free) + IP fallback → Beijing default ──
const WEATHER_CACHE_KEY = 'blog_weather_cache';
const WEATHER_REFRESH_MS = 30 * 60 * 1000; // 30 minutes cache
const BEIJING = { lat: 39.9042, lon: 116.4074, name: '北京' };

function getCachedWeather() {
    try {
        const cached = JSON.parse(localStorage.getItem(WEATHER_CACHE_KEY));
        if (cached && cached.ts && (Date.now() - cached.ts < WEATHER_REFRESH_MS)) {
            return cached.data;
        }
    } catch (e) { /* ignore */ }
    return null;
}

function setCachedWeather(data) {
    try {
        localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
    } catch (e) { /* ignore */ }
}

function renderWeather(data) {
    const el = document.getElementById('header-weather');
    if (!el) return;
    const icon = data.icon || 'fa-cloud-sun';
    const location = data.location || '';
    const text = (data.text || '--') + (location ? ' ' + location : '');
    const detail = (data.detail || data.text || '--') + (location ? ' · ' + location : '');
    el.innerHTML = `<i class="fa-solid ${icon}"></i> <span class="weather-text">${escapeHtml(text)}</span>`;
    el.title = detail + ' — 点击刷新（更新于 ' + new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) + '）';
}

// WMO weather codes → icon + Chinese text
const WEATHER_MAP = {
    0:  { icon: 'fa-sun', text: '晴朗' },
    1:  { icon: 'fa-sun', text: '大部晴朗' },
    2:  { icon: 'fa-cloud-sun', text: '多云' },
    3:  { icon: 'fa-cloud', text: '阴天' },
    45: { icon: 'fa-smog', text: '雾' },
    48: { icon: 'fa-smog', text: '冻雾' },
    51: { icon: 'fa-cloud-rain', text: '毛毛雨' },
    53: { icon: 'fa-cloud-rain', text: '毛毛雨' },
    55: { icon: 'fa-cloud-rain', text: '毛毛雨' },
    56: { icon: 'fa-cloud-rain', text: '冻毛毛雨' },
    57: { icon: 'fa-cloud-rain', text: '冻毛毛雨' },
    61: { icon: 'fa-cloud-showers-heavy', text: '小雨' },
    63: { icon: 'fa-cloud-showers-heavy', text: '中雨' },
    65: { icon: 'fa-cloud-showers-water', text: '大雨' },
    66: { icon: 'fa-cloud-meatball', text: '冻雨' },
    67: { icon: 'fa-cloud-meatball', text: '冻雨' },
    71: { icon: 'fa-snowflake', text: '小雪' },
    73: { icon: 'fa-snowflake', text: '中雪' },
    75: { icon: 'fa-snowflake', text: '大雪' },
    77: { icon: 'fa-snowflake', text: '雪粒' },
    80: { icon: 'fa-cloud-rain', text: '阵雨' },
    81: { icon: 'fa-cloud-showers-heavy', text: '阵雨' },
    82: { icon: 'fa-cloud-showers-water', text: '大阵雨' },
    85: { icon: 'fa-snowflake', text: '阵雪' },
    86: { icon: 'fa-snowflake', text: '大阵雪' },
    95: { icon: 'fa-cloud-bolt', text: '雷暴' },
    96: { icon: 'fa-cloud-bolt', text: '雷暴+冰雹' },
    99: { icon: 'fa-cloud-bolt', text: '强雷暴+冰雹' },
};

// Wind direction code → Chinese
const WIND_DIRS = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'];

function windDirText(degrees) {
    if (degrees == null) return '';
    const idx = Math.round(degrees / 45) % 8;
    return WIND_DIRS[idx] + '风';
}

async function fetchWeather(lat, lon) {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=relativehumidity_2m&timezone=auto&forecast_hours=1`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error('天气服务不可用');
    const json = await res.json();
    const w = json.current_weather;
    const code = w.weathercode;
    const temp = Math.round(w.temperature);
    const mapping = WEATHER_MAP[code] || { icon: 'fa-cloud-sun', text: '未知' };

    const wind = windDirText(w.winddirection);
    const windInfo = w.windspeed != null ? ` ${wind} ${Math.round(w.windspeed)}km/h` : '';
    const humidity = json.hourly && json.hourly.relativehumidity_2m
        ? ` 湿度 ${json.hourly.relativehumidity_2m[0]}%`
        : '';

    return {
        icon: mapping.icon,
        text: `${mapping.text} ${temp}°C`,
        detail: `${mapping.text} ${temp}°C${windInfo}${humidity}`
    };
}

// Get location: GPS → IP → reverse geocode → Beijing default
async function getLocationInfo() {
    let lat = null, lon = null;
    let locationName = '';

    // 1. Try browser GPS
    if (navigator.geolocation) {
        try {
            const pos = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: false,
                    timeout: 5000,
                    maximumAge: 600000
                });
            });
            lat = pos.coords.latitude;
            lon = pos.coords.longitude;
        } catch (e) {
            console.warn('GPS failed:', e.message);
        }
    }

    // 2. Try IP geolocation for city name (and coords if GPS failed)
    try {
        const res = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(5000) });
        if (res.ok) {
            const data = await res.json();
            if (data.city) locationName = data.city;
            if (lat == null && data.latitude && data.longitude) {
                lat = data.latitude;
                lon = data.longitude;
            }
        }
    } catch (e) {
        console.warn('IP geolocation failed:', e.message);
    }

    // 3. If we have coords but no city name, reverse geocode via Nominatim (free, no key)
    if (lat != null && !locationName) {
        try {
            const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&accept-language=zh`;
            const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
            if (res.ok) {
                const geo = await res.json();
                if (geo.address) {
                    locationName = geo.address.city || geo.address.town || geo.address.county || geo.address.state || '';
                }
            }
        } catch (e) {
            console.warn('Reverse geocode failed:', e.message);
        }
    }

    // 4. Default to Beijing if all else fails
    if (lat == null) {
        lat = BEIJING.lat;
        lon = BEIJING.lon;
    }
    if (!locationName) {
        locationName = BEIJING.name;
    }

    return { lat, lon, locationName };
}

async function refreshWeather(force = false) {
    // Check cache first
    if (!force) {
        const cached = getCachedWeather();
        if (cached) {
            renderWeather(cached);
            return;
        }
    }

    const loc = await getLocationInfo();

    try {
        const data = await fetchWeather(loc.lat, loc.lon);
        data.location = loc.locationName;
        setCachedWeather(data);
        renderWeather(data);
    } catch (e) {
        console.error('Weather fetch failed:', e);
        // Try Beijing as ultimate fallback
        if (loc.lat !== BEIJING.lat || loc.lon !== BEIJING.lon) {
            try {
                const bjData = await fetchWeather(BEIJING.lat, BEIJING.lon);
                bjData.location = BEIJING.name;
                setCachedWeather(bjData);
                renderWeather(bjData);
                return;
            } catch (e2) {
                console.error('Beijing fallback also failed:', e2);
            }
        }
        // Stale cache as last resort
        const stale = getCachedWeather() || (() => {
            try { const raw = localStorage.getItem(WEATHER_CACHE_KEY); if (raw) return JSON.parse(raw).data; } catch (_) { return null; }
        })();
        if (stale) {
            if (!stale.location) stale.location = BEIJING.name;
            renderWeather(stale);
        } else {
            // Absolute fallback: show Beijing as location even without data
            const el = document.getElementById('header-weather');
            if (el) {
                el.innerHTML = `<i class="fa-solid fa-cloud-sun"></i> <span class="weather-text">天气获取失败 · ${BEIJING.name}</span>`;
                el.title = '点击重试';
            }
        }
    }
}

// Click to force refresh weather
document.getElementById('header-weather').addEventListener('click', () => {
    refreshWeather(true);
});

// ── Game News Tabs ──
document.querySelectorAll('.game-news-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        // Update active tab
        document.querySelectorAll('.game-news-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        // Show matching panel
        const game = tab.dataset.game;
        document.querySelectorAll('.game-news-panel').forEach(p => p.style.display = 'none');
        const panel = document.getElementById('news-' + game);
        if (panel) panel.style.display = 'flex';
    });
});

// Refresh news button (placeholder for future dynamic fetching)
document.getElementById('btn-refresh-news').addEventListener('click', () => {
    const btn = document.getElementById('btn-refresh-news');
    const icon = btn.querySelector('i');
    icon.classList.add('fa-spin');
    setTimeout(() => {
        icon.classList.remove('fa-spin');
        const footer = document.querySelector('.game-news-updated');
        if (footer) footer.textContent = '🕐 已更新于 ' + new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    }, 1500);
});

// ============================================
// Helpers
// ============================================
function formatDate(isoStr) {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    const now = new Date();
    const diff = now - d;
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (mins < 1) return '刚刚';
    if (mins < 60) return `${mins} 分钟前`;
    if (hours < 24) return `${hours} 小时前`;
    if (days < 7) return `${days} 天前`;

    return d.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
}

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function truncate(str, len = 100) {
    if (!str) return '';
    const stripped = str.replace(/<[^>]*>/g, '');
    return stripped.length > len ? stripped.slice(0, len) + '...' : stripped;
}

function parseTags(input) {
    if (!input || !input.trim()) return [];
    return input
        .split(/[,，]/)
        .map(t => t.trim())
        .filter(Boolean)
        .slice(0, 8);
}

// ============================================
// Toast Notifications
// ============================================
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const icons = { success: 'fa-circle-check', error: 'fa-circle-exclamation', warning: 'fa-triangle-exclamation', info: 'fa-circle-info' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fa-solid ${icons[type] || icons.info}"></i> ${escapeHtml(message)}`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('removing');
        toast.addEventListener('animationend', () => toast.remove());
    }, 3000);
}

// ============================================
// Modal Management
// ============================================
function openModal(overlayId) {
    document.getElementById(overlayId).classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal(overlayId) {
    document.getElementById(overlayId).classList.remove('active');
    document.body.style.overflow = '';
}

document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay') && e.target.classList.contains('active')) {
        closeModal(e.target.id);
        if (e.target.id === 'detail-modal-overlay') {
            currentDetailArticleId = null;
        }
    }
    if (e.target.closest('[data-close]')) {
        const overlayId = e.target.closest('[data-close]').dataset.close;
        closeModal(overlayId);
        if (overlayId === 'detail-modal-overlay') {
            currentDetailArticleId = null;
        }
    }
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.active').forEach(overlay => {
            closeModal(overlay.id);
            if (overlay.id === 'detail-modal-overlay') {
                currentDetailArticleId = null;
            }
        });
    }
});

// ============================================
// State
// ============================================
let currentFilter = 'all';
let currentSubcategory = 'all';
let currentSearch = '';
let currentSort = 'newest';
let pendingDeleteId = null;
let currentDetailArticleId = null;

// Cached data for efficient re-renders
let cachedArticles = [];
let cachedProfile = null;
let cachedCategories = {};

// ============================================
// Render: Profile
// ============================================
async function renderProfile() {
    try {
        cachedProfile = await API.getProfile();
    } catch (e) {
        console.error('Failed to load profile:', e);
        return;
    }
    const profile = cachedProfile;

    const avatarEl = document.getElementById('profile-avatar');
    if (profile.avatar) {
        avatarEl.innerHTML = `<img src="${escapeHtml(profile.avatar)}" alt="头像" onerror="this.parentElement.innerHTML='<i class=\\'fa-solid fa-user\\'></i>'">`;
    } else {
        avatarEl.innerHTML = '<i class="fa-solid fa-user"></i>';
    }

    document.getElementById('profile-name').textContent = profile.name || '未设置姓名';
    document.getElementById('profile-bio').textContent = profile.bio || '还没有简介，点击编辑来介绍一下自己吧。';

    const emailDisplay = document.getElementById('profile-email-display');
    if (profile.email) {
        emailDisplay.style.display = 'flex';
        document.getElementById('profile-email-text').textContent = profile.email;
    } else {
        emailDisplay.style.display = 'none';
    }

    const locDisplay = document.getElementById('profile-location-display');
    if (profile.location) {
        locDisplay.style.display = 'flex';
        document.getElementById('profile-location-text').textContent = profile.location;
    } else {
        locDisplay.style.display = 'none';
    }

    const socialEl = document.getElementById('profile-social');
    const links = [];
    if (profile.social?.github) {
        links.push(`<a href="${escapeHtml(profile.social.github)}" target="_blank" rel="noopener" title="GitHub"><i class="fa-brands fa-github"></i></a>`);
    }
    if (profile.social?.twitter) {
        links.push(`<a href="${escapeHtml(profile.social.twitter)}" target="_blank" rel="noopener" title="Twitter/X"><i class="fa-brands fa-twitter"></i></a>`);
    }
    if (profile.social?.website) {
        links.push(`<a href="${escapeHtml(profile.social.website)}" target="_blank" rel="noopener" title="个人网站"><i class="fa-solid fa-globe"></i></a>`);
    }
    socialEl.innerHTML = links.join('') || '';

    const catCounts = cachedCategories.counts || cachedCategories; // backward compat
    document.getElementById('stat-articles').textContent = cachedArticles.length;
    document.getElementById('stat-categories').textContent = Object.keys(catCounts).length;
}

// ============================================
// Render: Categories
// ============================================
async function renderCategories(skipFetch = false) {
    if (!skipFetch) {
        try {
            cachedCategories = await API.getCategories();
        } catch (e) {
            console.error('Failed to load categories:', e);
        }
    }

    const catCounts = cachedCategories.counts || cachedCategories; // { counts, tree } or old format
    const listEl = document.getElementById('category-list');

    let html = `<li class="category-item${currentFilter === 'all' ? ' active' : ''}" data-category="all">
        全部 <span class="category-count">${cachedArticles.length}</span>
    </li>`;

    for (const [cat, count] of Object.entries(catCounts).sort((a, b) => a[0].localeCompare(b[0], 'zh-CN'))) {
        html += `<li class="category-item${currentFilter === cat ? ' active' : ''}" data-category="${escapeHtml(cat)}">
            ${escapeHtml(cat)} <span class="category-count">${count}</span>
        </li>`;
    }

    listEl.innerHTML = html;

    listEl.querySelectorAll('.category-item').forEach(item => {
        item.addEventListener('click', () => {
            currentFilter = item.dataset.category;
            currentSubcategory = 'all'; // reset subcategory on category change
            renderCategories();
            renderSubcategories();
            renderArticles();
        });
    });
}

// ============================================
// Render: Sub-categories
// ============================================
function renderSubcategories() {
    const bar = document.getElementById('subcat-bar');
    const chipsEl = document.getElementById('subcat-chips');
    if (!bar || !chipsEl) return;

    const tree = cachedCategories.tree || {};
    const children = tree[currentFilter];

    if (!children || children.length === 0) {
        bar.style.display = 'none';
        return;
    }

    bar.style.display = 'flex';

    // "全部" chip + child chips
    let chipsHtml = `<span class="subcat-chip${currentSubcategory === 'all' ? ' active' : ''}" data-subcat="all">全部</span>`;
    for (const child of children) {
        chipsHtml += `<span class="subcat-chip${currentSubcategory === child ? ' active' : ''}" data-subcat="${escapeHtml(child)}">${escapeHtml(child)}</span>`;
    }
    chipsEl.innerHTML = chipsHtml;

    chipsEl.querySelectorAll('.subcat-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            currentSubcategory = chip.dataset.subcat;
            renderSubcategories();
            renderArticles();
        });
    });
}

// ============================================
// Render: Articles Grid
// ============================================
async function renderArticles() {
    try {
        const params = { sort: currentSort };
        if (currentFilter !== 'all') params.category = currentFilter;
        if (currentSubcategory !== 'all') params.subcategory = currentSubcategory;
        if (currentSearch.trim()) params.search = currentSearch.trim();
        cachedArticles = await API.getArticles(params);
    } catch (e) {
        console.error('Failed to load articles:', e);
        showToast('加载文章失败：' + e.message, 'error');
        return;
    }

    const gridEl = document.getElementById('article-grid');
    const emptyEl = document.getElementById('empty-state');

    if (cachedArticles.length === 0) {
        gridEl.innerHTML = '';
        emptyEl.style.display = 'block';
        return;
    }

    emptyEl.style.display = 'none';

    // Build cards with async like data
    const cardPromises = cachedArticles.map(async article => {
        const coverHtml = article.cover_image
            ? `<img class="article-card-cover" src="${escapeHtml(article.cover_image)}" alt="${escapeHtml(article.title)}" loading="lazy" onerror="this.style.display='none'">`
            : `<div class="article-card-cover" style="background: linear-gradient(135deg, ${randomGradient()})"></div>`;

        const tagsHtml = (article.tags && article.tags.length > 0)
            ? `<div class="article-card-tags">${article.tags.map(t => `<span class="article-card-tag">${escapeHtml(t)}</span>`).join('')}</div>`
            : '';

        const categoryHtml = article.category
            ? `<span class="article-card-category">${escapeHtml(article.category)}</span>`
            : '';

        const pinnedBadge = article.is_pinned
            ? `<span class="article-card-pinned" title="已置顶"><i class="fa-solid fa-thumbtack"></i> 置顶</span>`
            : '';

        // Fetch like state from server
        let likes = article.likes_count || 0;
        let liked = false;
        try {
            const likeState = await API.getLikes(article.id);
            likes = likeState.count;
            liked = likeState.isLiked;
        } catch (e) { /* use defaults */ }

        // Comment count — we use a fast estimate or fetch
        let commentCount = 0;
        try {
            const comments = await API.getComments(article.id);
            commentCount = comments.length;
        } catch (e) { /* use 0 */ }

        return `
        <article class="article-card" data-id="${article.id}">
            ${coverHtml}
            <div class="article-card-body">
                ${categoryHtml}${pinnedBadge}
                <h3 class="article-card-title">${escapeHtml(article.title)}</h3>
                <p class="article-card-summary">${escapeHtml(article.summary || truncate(article.content, 120))}</p>
                ${tagsHtml}
                <div class="article-card-footer">
                    <span class="card-footer-left">
                        <span><i class="fa-regular fa-clock"></i> ${formatDate(article.created_at)}</span>
                        ${article.updated_at !== article.created_at ? '<span>已编辑</span>' : ''}
                    </span>
                    <span class="card-footer-actions">
                        <button class="card-action-btn card-like-btn ${liked ? 'liked' : ''}" data-id="${article.id}" title="点赞">
                            <i class="fa-${liked ? 'solid' : 'regular'} fa-heart"></i>
                            <span>${likes}</span>
                        </button>
                        <span class="card-comment-count">
                            <i class="fa-regular fa-comment"></i> ${commentCount}
                        </span>
                    </span>
                </div>
            </div>
        </article>`;
    });

    const cards = await Promise.all(cardPromises);
    gridEl.innerHTML = cards.join('');

    // Bind click events to open detail
    gridEl.querySelectorAll('.article-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target.closest('.card-like-btn')) return;
            openArticleDetail(card.dataset.id);
        });
    });

    // Bind like button clicks
    gridEl.querySelectorAll('.card-like-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await toggleLike(btn.dataset.id);
            renderArticles();
        });
    });
}

function randomGradient() {
    const hues = [
        [79, 70, 229], [99, 102, 241], [129, 140, 248],
        [14, 165, 233], [6, 182, 212], [34, 197, 94],
        [168, 85, 247], [236, 72, 153]
    ];
    const h = hues[Math.floor(Math.random() * hues.length)];
    return `rgb(${h[0]},${h[1]},${h[2]})`;
}

// ============================================
// Article Detail Modal
// ============================================

function updateDetailPinButton(article) {
    const btn = document.getElementById('btn-detail-pin');
    const textEl = document.getElementById('btn-detail-pin-text');
    if (!btn || !textEl) return;
    if (article.is_pinned) {
        textEl.textContent = '取消置顶';
        btn.classList.add('pinned');
    } else {
        textEl.textContent = '置顶';
        btn.classList.remove('pinned');
    }
}

async function openArticleDetail(id) {
    let article;
    try {
        article = await API.getArticle(id);
    } catch (e) {
        showToast('文章不存在', 'error');
        return;
    }

    if (!article) {
        showToast('文章不存在', 'error');
        return;
    }

    currentDetailArticleId = id;

    document.getElementById('detail-title').textContent = article.title;
    document.getElementById('detail-content').innerHTML = article.content || '<p style="color:var(--text-muted)">暂无内容</p>';

    // Meta
    const metaHtml = [];
    if (article.category) {
        metaHtml.push(`<span class="meta-category">${escapeHtml(article.category)}</span>`);
    }
    metaHtml.push(`<span class="meta-date"><i class="fa-regular fa-clock"></i> 发布于 ${formatDate(article.created_at)}</span>`);
    if (article.updated_at !== article.created_at) {
        metaHtml.push(`<span class="meta-date"><i class="fa-solid fa-pen"></i> 更新于 ${formatDate(article.updated_at)}</span>`);
    }
    document.getElementById('detail-meta').innerHTML = metaHtml.join('');

    // Cover
    const coverWrapper = document.getElementById('detail-cover-wrapper');
    if (article.cover_image) {
        coverWrapper.style.display = 'block';
        document.getElementById('detail-cover').src = article.cover_image;
        document.getElementById('detail-cover').onerror = () => { coverWrapper.style.display = 'none'; };
    } else {
        coverWrapper.style.display = 'none';
    }

    // Tags
    const tagsEl = document.getElementById('detail-tags');
    if (article.tags && article.tags.length > 0) {
        tagsEl.innerHTML = article.tags.map(t => `<span class="article-tag">${escapeHtml(t)}</span>`).join('');
        tagsEl.style.display = 'flex';
    } else {
        tagsEl.innerHTML = '';
        tagsEl.style.display = 'none';
    }

    // Likes
    await renderDetailLike(id);

    // Comments
    await renderComments(id);

    // Pin button state
    updateDetailPinButton(article);

    // Bind action buttons
    document.getElementById('btn-detail-pin').onclick = () => {
        requireLogin(async () => {
            try {
                const result = await API.togglePin(article.id);
                article.is_pinned = result.isPinned ? 1 : 0;
                updateDetailPinButton(article);
                renderArticles();
                showToast(result.isPinned ? '文章已置顶' : '已取消置顶', 'success');
            } catch (e) {
                showToast('操作失败：' + e.message, 'error');
            }
        });
    };
    document.getElementById('btn-detail-edit').onclick = () => {
        requireLogin(() => {
            closeModal('detail-modal-overlay');
            openArticleEditor(article);
        });
    };
    document.getElementById('btn-detail-delete').onclick = () => {
        requireLogin(() => {
            closeModal('detail-modal-overlay');
            openDeleteConfirm(article.id, article.title);
        });
    };

    openModal('detail-modal-overlay');
}

// ============================================
// Like / Unlike
// ============================================
async function toggleLike(articleId) {
    try {
        const result = await API.toggleLike(articleId);
        const isLiked = result.isLiked;

        const detailBtn = document.getElementById('btn-detail-like');
        if (detailBtn) {
            const icon = detailBtn.querySelector('i');
            const countEl = document.getElementById('detail-like-count');
            if (icon) {
                icon.className = isLiked ? 'fa-solid fa-heart' : 'fa-regular fa-heart';
            }
            if (countEl) countEl.textContent = result.count;
            if (isLiked) {
                detailBtn.classList.add('liked');
                detailBtn.classList.remove('like-burst');
                void detailBtn.offsetWidth;
                detailBtn.classList.add('like-burst');
            } else {
                detailBtn.classList.remove('liked', 'like-burst');
            }
        }
    } catch (e) {
        console.error('Toggle like failed:', e);
        showToast('操作失败：' + e.message, 'error');
    }
}

async function renderDetailLike(articleId) {
    try {
        const state = await API.getLikes(articleId);
        const btn = document.getElementById('btn-detail-like');
        const countEl = document.getElementById('detail-like-count');

        if (btn) {
            const icon = btn.querySelector('i');
            if (icon) icon.className = state.isLiked ? 'fa-solid fa-heart' : 'fa-regular fa-heart';
            if (state.isLiked) btn.classList.add('liked'); else btn.classList.remove('liked', 'like-burst');
        }
        if (countEl) countEl.textContent = state.count;
    } catch (e) {
        console.error('Failed to load likes:', e);
    }
}

// ============================================
// Comments
// ============================================
async function renderComments(articleId) {
    let comments = [];
    try {
        comments = await API.getComments(articleId);
    } catch (e) {
        console.error('Failed to load comments:', e);
        comments = [];
    }

    const listEl = document.getElementById('comments-list');
    const countEl = document.getElementById('comments-count');
    const detailCommentCount = document.getElementById('detail-comment-count');

    if (countEl) countEl.textContent = comments.length;
    if (detailCommentCount) detailCommentCount.textContent = comments.length;

    if (!listEl) return;

    if (comments.length === 0) {
        listEl.innerHTML = `<div class="comments-empty">
            <i class="fa-regular fa-comment-dots"></i>
            <p>还没有评论，来说点什么吧</p>
        </div>`;
        return;
    }

    listEl.innerHTML = comments.map(c => `
        <div class="comment-item" data-comment-id="${c.id}">
            <div class="comment-avatar">${escapeHtml(c.author.charAt(0).toUpperCase())}</div>
            <div class="comment-body">
                <div class="comment-header">
                    <span class="comment-author">${escapeHtml(c.author)}</span>
                    <span class="comment-time">${formatDate(c.created_at)}</span>
                </div>
                <p class="comment-text">${escapeHtml(c.content)}</p>
            </div>
            <button class="comment-delete-btn" data-comment-id="${c.id}" title="删除评论">
                <i class="fa-solid fa-trash-can"></i>
            </button>
        </div>
    `).join('');

    // Bind delete buttons
    listEl.querySelectorAll('.comment-delete-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            try {
                await API.deleteComment(btn.dataset.commentId);
                await renderComments(articleId);
                renderArticles();
                showToast('评论已删除', 'success');
            } catch (e) {
                showToast('删除失败：' + e.message, 'error');
            }
        });
    });
}

// ============================================
// Delete Confirmation
// ============================================
function openDeleteConfirm(id, title) {
    pendingDeleteId = id;
    document.getElementById('confirm-message').textContent =
        `确定要删除《${title}》吗？此操作不可撤销。`;
    openModal('confirm-modal-overlay');
}

document.getElementById('btn-confirm-delete').addEventListener('click', async () => {
    if (pendingDeleteId) {
        try {
            await API.deleteArticle(pendingDeleteId);
            await renderAll();
            showToast('文章已删除', 'success');
        } catch (e) {
            showToast('删除失败：' + e.message, 'error');
        }
        pendingDeleteId = null;
        closeModal('confirm-modal-overlay');
    }
});

// ============================================
// Image Upload Manager
// ============================================
const ImageUploader = {
    // Initialize an upload zone
    init(zoneId) {
        const zone = document.getElementById(zoneId);
        if (!zone) return;

        const upload = zone.closest('.image-upload');
        if (!upload) return;

        const targetId = upload.dataset.target;
        const fileInput = document.getElementById(targetId + '-file');
        const urlInput = document.getElementById(targetId);
        const preview = document.getElementById(targetId + '-preview');
        const placeholder = zone.querySelector('.upload-placeholder');
        const progress = document.getElementById(targetId + '-progress');
        const progressBar = progress ? progress.querySelector('.upload-progress-bar') : null;

        // Click zone → open file picker
        zone.addEventListener('click', (e) => {
            if (e.target.closest('.upload-remove')) return;
            if (fileInput) fileInput.click();
        });

        // File selected
        if (fileInput) {
            fileInput.addEventListener('change', () => {
                if (fileInput.files.length > 0) {
                    this.uploadFile(fileInput.files[0], targetId, zone, preview, placeholder, progressBar, urlInput);
                }
            });
        }

        // Drag & drop
        zone.addEventListener('dragover', (e) => {
            e.preventDefault();
            zone.classList.add('drag-over');
        });
        zone.addEventListener('dragleave', () => {
            zone.classList.remove('drag-over');
        });
        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            zone.classList.remove('drag-over');
            const file = e.dataTransfer.files[0];
            if (file) this.uploadFile(file, targetId, zone, preview, placeholder, progressBar, urlInput);
        });

        // Paste image from clipboard
        zone.addEventListener('paste', (e) => {
            const items = e.clipboardData.items;
            for (const item of items) {
                if (item.type.startsWith('image/')) {
                    const file = item.getAsFile();
                    this.uploadFile(file, targetId, zone, preview, placeholder, progressBar, urlInput);
                    break;
                }
            }
        });
        // Make zone focusable for paste
        zone.tabIndex = 0;

        // URL input changes → preview the URL
        if (urlInput) {
            urlInput.addEventListener('input', () => {
                const url = urlInput.value.trim();
                if (url) {
                    this.showPreview(preview, placeholder, url);
                } else {
                    this.hidePreview(preview, placeholder);
                }
            });
        }

        // Remove button
        if (preview) {
            const removeBtn = preview.querySelector('.upload-remove');
            if (removeBtn) {
                removeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.clearImage(targetId, zone, preview, placeholder, urlInput, fileInput);
                });
            }
        }
    },

    // Upload file to server
    async uploadFile(file, targetId, zone, preview, placeholder, progressBar, urlInput) {
        // Validate type
        const allowed = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/avif', 'image/svg+xml'];
        if (!allowed.includes(file.type)) {
            showToast('仅支持 PNG / JPG / GIF / WebP / AVIF / SVG 格式', 'warning');
            return;
        }
        // Validate size
        if (file.size > 10 * 1024 * 1024) {
            showToast('图片大小不能超过 10MB', 'warning');
            return;
        }

        // Show local preview first
        const localUrl = URL.createObjectURL(file);
        this.showPreview(preview, placeholder, localUrl);

        // Start progress
        if (progressBar) {
            progressBar.style.width = '10%';
            progressBar.parentElement.style.display = 'block';
        }

        if (!isLoggedIn()) {
            // Can't upload without login — keep local preview, warn user
            showToast('请先登录后再上传图片，当前仅本地预览', 'warning');
            if (progressBar) progressBar.parentElement.style.display = 'none';
            URL.revokeObjectURL(localUrl);
            this.hidePreview(preview, placeholder);
            return;
        }

        try {
            const formData = new FormData();
            formData.append('image', file);

            const xhr = new XMLHttpRequest();
            const token = getAuthToken();

            const result = await new Promise((resolve, reject) => {
                xhr.upload.addEventListener('progress', (e) => {
                    if (e.lengthComputable && progressBar) {
                        const pct = Math.round((e.loaded / e.total) * 100);
                        progressBar.style.width = pct + '%';
                    }
                });
                xhr.addEventListener('load', () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        resolve(JSON.parse(xhr.responseText));
                    } else {
                        try {
                            const err = JSON.parse(xhr.responseText);
                            reject(new Error(err.error || '上传失败'));
                        } catch (_) {
                            reject(new Error('上传失败 HTTP ' + xhr.status));
                        }
                    }
                });
                xhr.addEventListener('error', () => reject(new Error('网络错误')));
                xhr.addEventListener('abort', () => reject(new Error('上传已取消')));
                xhr.open('POST', '/api/upload');
                xhr.setRequestHeader('Authorization', 'Bearer ' + token);
                xhr.send(formData);
            });

            // Success — update URL input
            if (urlInput) urlInput.value = result.url;
            showToast('图片上传成功', 'success');
        } catch (e) {
            showToast('上传失败：' + e.message, 'error');
            this.hidePreview(preview, placeholder);
        } finally {
            URL.revokeObjectURL(localUrl);
            if (progressBar) {
                progressBar.parentElement.style.display = 'none';
                progressBar.style.width = '0%';
            }
        }
    },

    showPreview(preview, placeholder, url) {
        if (preview) {
            const img = preview.querySelector('img');
            if (img) img.src = url;
            preview.style.display = 'block';
        }
        if (placeholder) placeholder.style.display = 'none';
    },

    hidePreview(preview, placeholder) {
        if (preview) preview.style.display = 'none';
        if (placeholder) placeholder.style.display = '';
    },

    clearImage(targetId, zone, preview, placeholder, urlInput, fileInput) {
        this.hidePreview(preview, placeholder);
        if (urlInput) urlInput.value = '';
        if (fileInput) fileInput.value = '';
    },

    // Set existing URL (when editing an article)
    setExisting(targetId, url) {
        const urlInput = document.getElementById(targetId);
        const preview = document.getElementById(targetId + '-preview');
        const zone = document.getElementById(targetId + '-zone');
        const placeholder = zone ? zone.querySelector('.upload-placeholder') : null;

        if (url) {
            if (urlInput) urlInput.value = url;
            this.showPreview(preview, placeholder, url);
        } else {
            if (urlInput) urlInput.value = '';
            this.hidePreview(preview, placeholder);
        }
    }
};

// Initialize upload zones on page load
['pf-avatar-zone', 'art-cover-zone'].forEach(id => ImageUploader.init(id));

// ============================================
// Article Editor
// ============================================
function openArticleEditor(article = null) {
    const isEdit = !!article;
    document.getElementById('article-modal-title').textContent = isEdit ? '编辑文章' : '写文章';
    document.getElementById('btn-save-article').innerHTML = isEdit
        ? '<i class="fa-solid fa-check"></i> 更新'
        : '<i class="fa-solid fa-check"></i> 发布';

    document.getElementById('art-id').value = article ? article.id : '';
    document.getElementById('art-title').value = article ? article.title : '';
    document.getElementById('art-category').value = article ? (article.category || '') : '';
    document.getElementById('art-tags').value = article ? (article.tags || []).join(', ') : '';
    document.getElementById('art-summary').value = article ? (article.summary || '') : '';
    const coverUrl = article ? (article.cover_image || '') : '';
    document.getElementById('art-cover').value = coverUrl;
    ImageUploader.setExisting('art-cover', coverUrl);
    document.getElementById('art-pinned').checked = article ? !!article.is_pinned : false;
    document.getElementById('art-content').value = article ? (article.content || '') : '';

    // Subcategory
    const subcat = article ? (article.subcategory || '') : '';
    document.getElementById('art-subcategory').value = subcat;
    updateSubcategorySelect();
    updateCategoryDatalist();
    openModal('article-modal-overlay');
}

// Update subcategory input/datalist based on selected category
function updateSubcategorySelect() {
    const cat = document.getElementById('art-category').value.trim();
    const group = document.getElementById('art-subcategory-group');
    const input = document.getElementById('art-subcategory');
    const datalist = document.getElementById('subcategory-datalist');
    const tree = cachedCategories.tree || {};
    const children = tree[cat];

    if (cat) {
        // Always show subcategory field when a category is entered
        group.style.display = '';
        // Populate datalist with existing children (if any) for autocomplete
        datalist.innerHTML = (children || [])
            .map(c => `<option value="${escapeHtml(c)}">`)
            .join('');
    } else {
        group.style.display = 'none';
        input.value = '';
    }
}

// Listen for category changes in the editor
document.getElementById('art-category').addEventListener('input', updateSubcategorySelect);

function updateCategoryDatalist() {
    const datalist = document.getElementById('category-datalist');
    const catCounts = cachedCategories.counts || cachedCategories;
    datalist.innerHTML = Object.keys(catCounts)
        .sort()
        .map(c => `<option value="${escapeHtml(c)}">`)
        .join('');
}

// Save article
document.getElementById('btn-save-article').addEventListener('click', async () => {
    const id = document.getElementById('art-id').value;
    const title = document.getElementById('art-title').value.trim();
    const content = document.getElementById('art-content').value.trim();

    if (!title) {
        showToast('请输入文章标题', 'warning');
        document.getElementById('art-title').focus();
        return;
    }
    if (!content) {
        showToast('请输入文章内容', 'warning');
        document.getElementById('art-content').focus();
        return;
    }

    const article = {
        id: id || undefined,
        title,
        content,
        category: document.getElementById('art-category').value.trim(),
        subcategory: document.getElementById('art-subcategory').value,
        tags: parseTags(document.getElementById('art-tags').value),
        summary: document.getElementById('art-summary').value.trim(),
        coverImage: document.getElementById('art-cover').value.trim(),
        isPinned: document.getElementById('art-pinned').checked,
    };

    try {
        await API.saveArticle(article);
        closeModal('article-modal-overlay');
        await renderAll();
        showToast(id ? '文章已更新' : '文章已发布', 'success');
    } catch (e) {
        showToast('保存失败：' + e.message, 'error');
    }
});

// ============================================
// Profile Editor (readonly=false for edit, true for view-only)
// ============================================
function openProfileEditor(readonly = false) {
    const profile = cachedProfile || {};
    const form = document.getElementById('profile-form');

    // Fill fields
    document.getElementById('pf-name').value = profile.name || '';
    document.getElementById('pf-bio').value = profile.bio || '';
    document.getElementById('pf-email').value = profile.email || '';
    document.getElementById('pf-location').value = profile.location || '';
    const avatarUrl = profile.avatar || '';
    document.getElementById('pf-avatar').value = avatarUrl;
    ImageUploader.setExisting('pf-avatar', avatarUrl);
    document.getElementById('pf-github').value = (profile.social && profile.social.github) || '';
    document.getElementById('pf-twitter').value = (profile.social && profile.social.twitter) || '';
    document.getElementById('pf-website').value = (profile.social && profile.social.website) || '';

    // Toggle readonly / editable UI
    if (readonly) {
        form.classList.add('readonly');
        document.getElementById('pf-avatar-group').style.display = 'none';
        document.getElementById('btn-save-profile').style.display = 'none';
        document.getElementById('btn-login-edit').style.display = '';
    } else {
        form.classList.remove('readonly');
        document.getElementById('pf-avatar-group').style.display = '';
        document.getElementById('btn-save-profile').style.display = '';
        document.getElementById('btn-login-edit').style.display = 'none';
    }

    openModal('profile-modal-overlay');
}

// Save profile
document.getElementById('btn-save-profile').addEventListener('click', async () => {
    const profile = {
        name: document.getElementById('pf-name').value.trim(),
        bio: document.getElementById('pf-bio').value.trim(),
        email: document.getElementById('pf-email').value.trim(),
        location: document.getElementById('pf-location').value.trim(),
        avatar: document.getElementById('pf-avatar').value.trim(),
        social: {
            github: document.getElementById('pf-github').value.trim(),
            twitter: document.getElementById('pf-twitter').value.trim(),
            website: document.getElementById('pf-website').value.trim(),
        }
    };

    try {
        await API.saveProfile(profile);
        closeModal('profile-modal-overlay');
        await renderProfile();
        await renderCategories();
        showToast('个人资料已保存', 'success');
    } catch (e) {
        showToast('保存失败：' + e.message, 'error');
    }
});

// ============================================
// Editor Toolbar
// ============================================
document.getElementById('editor-toolbar').addEventListener('click', (e) => {
    const btn = e.target.closest('.editor-btn');
    if (!btn) return;

    const tag = btn.dataset.tag;
    const textarea = document.getElementById('art-content');
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = textarea.value.substring(start, end);
    let replacement = '';

    switch (tag) {
        case 'h3':
            replacement = `<h3>${selected || '小标题'}</h3>`;
            break;
        case 'strong':
            replacement = `<strong>${selected || '加粗文字'}</strong>`;
            break;
        case 'em':
            replacement = `<em>${selected || '斜体文字'}</em>`;
            break;
        case 'u':
            replacement = `<u>${selected || '下划线文字'}</u>`;
            break;
        case 'blockquote':
            replacement = `\n<blockquote>${selected || '引用内容'}</blockquote>\n`;
            break;
        case 'code':
            replacement = selected.includes('\n')
                ? `\n<pre><code>${selected || '代码块'}</code></pre>\n`
                : `<code>${selected || '代码'}</code>`;
            break;
        case 'a':
            replacement = `<a href="https://">${selected || '链接文字'}</a>`;
            break;
        case 'hr':
            replacement = '\n<hr>\n';
            break;
    }

    textarea.value = textarea.value.substring(0, start) + replacement + textarea.value.substring(end);
    textarea.focus();
    const newPos = start + replacement.length;
    textarea.setSelectionRange(newPos, newPos);
});

// ============================================
// Event Bindings
// ============================================

// New article buttons
document.getElementById('btn-new-post-header').addEventListener('click', () => requireLogin(() => openArticleEditor()));
document.getElementById('btn-empty-write').addEventListener('click', () => requireLogin(() => openArticleEditor()));

// Edit profile buttons — logged in: directly edit; not logged in: readonly view
function handleProfileEditClick() {
    if (isLoggedIn()) {
        openProfileEditor(false);
    } else {
        openProfileEditor(true);
    }
}
document.getElementById('btn-edit-profile').addEventListener('click', handleProfileEditClick);
document.getElementById('profile-avatar').addEventListener('click', handleProfileEditClick);

// "登录并编辑" button inside the readonly profile modal → login first
document.getElementById('btn-login-edit').addEventListener('click', () => {
    closeModal('profile-modal-overlay');
    // Small delay so the modal closes before the login modal opens
    setTimeout(() => requireLogin(() => openProfileEditor(false)), 150);
});

// Search input (debounced)
let searchTimer;
document.getElementById('search-input').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
        currentSearch = e.target.value;
        renderArticles();
    }, 300);
});

// Sort select
document.getElementById('sort-select').addEventListener('change', (e) => {
    currentSort = e.target.value;
    renderArticles();
});

// Detail modal like button
document.getElementById('btn-detail-like').addEventListener('click', async () => {
    if (currentDetailArticleId) {
        await toggleLike(currentDetailArticleId);
        renderArticles();
    }
});

// Scroll to comments button
document.getElementById('btn-scroll-comments').addEventListener('click', () => {
    const commentsSection = document.getElementById('comments-section');
    if (commentsSection) {
        commentsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
});

// Submit comment
document.getElementById('btn-submit-comment').addEventListener('click', async () => {
    if (!currentDetailArticleId) return;

    const authorInput = document.getElementById('comment-author');
    const contentInput = document.getElementById('comment-content');
    const author = authorInput.value.trim();
    const content = contentInput.value.trim();

    if (!content) {
        showToast('请输入评论内容', 'warning');
        contentInput.focus();
        return;
    }

    try {
        await API.addComment(currentDetailArticleId, author, content);
        authorInput.value = '';
        contentInput.value = '';
        await renderComments(currentDetailArticleId);
        renderArticles();
        showToast('评论已发表', 'success');
    } catch (e) {
        showToast('发表失败：' + e.message, 'error');
    }
});

// Ctrl+Enter to submit comment
document.getElementById('comment-content').addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('btn-submit-comment').click();
    }
});

// Home link resets filters
document.getElementById('home-link').addEventListener('click', (e) => {
    e.preventDefault();
    currentFilter = 'all';
    currentSubcategory = 'all';
    currentSearch = '';
    document.getElementById('search-input').value = '';
    document.getElementById('sort-select').value = 'newest';
    renderCategories();
    renderSubcategories();
    renderArticles();
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

// ============================================
// Login / Logout
// ============================================
document.getElementById('btn-login').addEventListener('click', async () => {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value.trim();
    const errorEl = document.getElementById('login-error');

    if (!username || !password) {
        errorEl.textContent = '请输入账号和密码';
        errorEl.style.display = 'block';
        return;
    }

    try {
        const result = await API.login(username, password);
        setAuthToken(result.token);
        errorEl.style.display = 'none';
        document.getElementById('login-username').value = '';
        document.getElementById('login-password').value = '';
        closeModal('login-modal-overlay');
        updateLoginUI();
        showToast('登录成功，欢迎回来！', 'success');

        // Execute pending action if any
        if (pendingAuthCallback) {
            const cb = pendingAuthCallback;
            pendingAuthCallback = null;
            pendingAuthReject = null;
            // Small delay to let modal close animation finish
            setTimeout(cb, 200);
        }
    } catch (e) {
        errorEl.textContent = e.message;
        errorEl.style.display = 'block';
    }
});

// Enter key to submit login
document.getElementById('login-password').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('btn-login').click();
    }
});

document.getElementById('login-username').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('btn-login').click();
    }
});

// Clear pending callback when login modal is closed without login
document.querySelector('#login-modal-overlay [data-close]').addEventListener('click', () => {
    clearPendingAuth();
});
document.getElementById('login-modal-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) {
        clearPendingAuth();
    }
});

function updateLoginUI() {
    const loggedIn = isLoggedIn();
    document.getElementById('login-indicator').style.display = loggedIn ? 'inline-flex' : 'none';
    document.getElementById('btn-logout').style.display = loggedIn ? 'inline-flex' : 'none';
}

// Logout button
document.getElementById('btn-logout').addEventListener('click', () => {
    clearAuthToken();
    clearPendingAuth();
    updateLoginUI();
    showToast('已退出登录', 'info');
});

// ============================================
// Render All
// ============================================
// ============================================
// Sidebar Toggle (off-canvas on narrow screens)
// ============================================
(function initSidebar() {
    const toggleBtn = document.getElementById('sidebar-toggle');
    const closeBtn = document.getElementById('sidebar-close');
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebar-overlay');

    if (!toggleBtn || !sidebar || !overlay) return;

    function openSidebar() {
        sidebar.classList.add('open');
        overlay.classList.add('visible');
        document.body.style.overflow = 'hidden';
        toggleBtn.setAttribute('aria-expanded', 'true');
    }

    function closeSidebar() {
        sidebar.classList.remove('open');
        overlay.classList.remove('visible');
        document.body.style.overflow = '';
        toggleBtn.setAttribute('aria-expanded', 'false');
    }

    function isOpen() {
        return sidebar.classList.contains('open');
    }

    toggleBtn.addEventListener('click', () => {
        if (isOpen()) {
            closeSidebar();
        } else {
            openSidebar();
        }
    });

    // Close button inside sidebar
    if (closeBtn) {
        closeBtn.addEventListener('click', closeSidebar);
    }

    // Click overlay to close
    overlay.addEventListener('click', closeSidebar);

    // Escape key to close
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isOpen()) {
            closeSidebar();
            toggleBtn.focus();
        }
    });

    // Close sidebar when a category or nav link is clicked
    sidebar.addEventListener('click', (e) => {
        const link = e.target.closest('a, .category-item, .subcat-chip');
        if (link) {
            // Small delay to let the navigation happen first
            setTimeout(closeSidebar, 150);
        }
    });

    // Auto-close sidebar when resizing above the off-canvas breakpoint
    window.addEventListener('resize', () => {
        if (window.innerWidth > 1000 && isOpen()) {
            closeSidebar();
        }
    });
})();

async function renderAll() {
    // Load articles first so counts are available
    try {
        const params = { sort: currentSort };
        if (currentFilter !== 'all') params.category = currentFilter;
        if (currentSubcategory !== 'all') params.subcategory = currentSubcategory;
        cachedArticles = await API.getArticles(params);
    } catch (e) {
        console.error('Failed to load articles:', e);
        cachedArticles = [];
    }
    // Load categories before renderProfile so stat-categories is correct
    try {
        cachedCategories = await API.getCategories();
    } catch (e) {
        console.error('Failed to load categories:', e);
    }
    await renderProfile();
    await renderCategories(true);  // skipFetch: already loaded above
    await renderSubcategories();
    await renderArticles();
    updateCategoryDatalist();
}

// ============================================
// Demo Data (load on first visit)
// ============================================
async function maybeLoadDemoData() {
    try {
        const result = await API.initDemoData();
        if (result.seeded) {
            console.log('Demo data seeded:', result.count, 'articles');
        }
    } catch (e) {
        console.error('Failed to seed demo data:', e);
    }
}

// ============================================
// Boot
// ============================================
(async function boot() {
    console.log('🚀 Booting blog with user token:', getUserToken());

    // Update login UI state
    updateLoginUI();

    // Start live clock
    updateDateTime();
    setInterval(updateDateTime, 30000);

    // Fetch weather (cached for 30 min)
    refreshWeather();

    // Try to load demo data if DB is empty
    await maybeLoadDemoData();

    // Initial render
    await renderAll();
})();
