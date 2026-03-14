/**
 * ChodSound - Unified Bundle v3.1
 * Robust Initialization & Registration Fix
 */

console.log("ChodSound Bundle v3.1: Loading...");

// --- 1. Core Services & Initialization ---
const SUPABASE_URL = 'https://cxantzvxxrycibozahak.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4YW50enZ4eHJ5Y2lib3phaGFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxNzE3MjAsImV4cCI6MjA4Nzc0NzcyMH0._l0jmsTeRmLRnCKr2u69e1Ore4yzzcTK6vl78M41jY0';

let supabase = null;

const initSupabase = () => {
    try {
        if (window.supabase) {
            supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
            console.log("ChodSound: Supabase Ready");
            return true;
        } else {
            console.warn("ChodSound: Supabase library not found yet, retrying...");
            return false;
        }
    } catch (e) {
        console.error("ChodSound: Supabase Init Error", e);
        return false;
    }
};

// Retry initialization if not immediately available
const retryInit = setInterval(() => {
    if (initSupabase()) {
        clearInterval(retryInit);
        if (window.app) window.app.updateAuthUI();
    }
}, 500);

// Cleanup after 10 seconds if still not found
setTimeout(() => clearInterval(retryInit), 10000);

const AuthService = {
    async register(email, password, username, firstname, lastname) {
        if (!supabase) throw new Error("Connection to server not ready. Please wait a moment.");

        // 1. Sign Up in Supabase Auth
        const { data, error } = await supabase.auth.signUp({
            email, password,
            options: {
                data: {
                    username,
                    first_name: firstname,
                    last_name: lastname,
                    full_name: `${firstname} ${lastname}`.trim()
                }
            }
        });

        if (error) throw error;
        if (!data.user) throw new Error("Registration failed. No user returned.");

        // 2. Insert/Update user profile in the database
        const { error: profileError } = await supabase.from('profiles').upsert({
            id: data.user.id,
            username: username,
            full_name: `${firstname} ${lastname}`.trim(),
            avatar_url: `https://ui-avatars.com/api/?name=${username}&background=00609b&color=fff`,
            updated_at: new Date().toISOString()
        });

        if (profileError) {
            console.error("Profile creation error:", profileError);
            // We don't throw here to avoid blocking the user if Auth succeeded
        }

        return data;
    },

    async login(email, password) {
        if (!supabase) throw new Error("Connection to server not ready.");
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        return data;
    },

    async logout() {
        if (supabase) await supabase.auth.signOut();
        localStorage.removeItem('chod_user');
    }
};

// --- 2. Global Audio Player ---
class ChodPlayer {
    constructor() {
        this.audio = document.getElementById('core-audio-element');
        this.playPauseBtn = document.getElementById('btn-play-pause');
        this.progressBar = document.getElementById('player-progress');
        this.timeCurrent = document.getElementById('time-current');
        this.timeTotal = document.getElementById('time-total');
        this.isPlaying = false;
        this.init();
    }

    init() {
        if (!this.audio || !this.playPauseBtn) return;
        this.playPauseBtn.onclick = () => this.togglePlay();
        this.audio.ontimeupdate = () => this.updateUI();
        this.audio.onplay = () => this.onStateChange(true);
        this.audio.onpause = () => this.onStateChange(false);
        this.audio.onended = () => this.onStateChange(false);

        const volSlider = document.getElementById('volume-slider');
        if (volSlider) volSlider.oninput = (e) => { this.audio.volume = e.target.value; };
    }

    togglePlay() {
        if (!this.audio.src) return;
        if (this.isPlaying) this.audio.pause(); else this.audio.play();
    }

    onStateChange(playing) {
        this.isPlaying = playing;
        const icon = this.playPauseBtn.querySelector('.material-symbols-rounded');
        if (icon) icon.textContent = playing ? 'pause' : 'play_arrow';
    }

    updateUI() {
        if (!this.audio.duration) return;
        const percent = (this.audio.currentTime / this.audio.duration) * 100;
        if (this.progressBar) this.progressBar.style.width = `${percent}%`;
        if (this.timeCurrent) this.timeCurrent.textContent = this.formatTime(this.audio.currentTime);
        if (this.timeTotal) this.timeTotal.textContent = this.formatTime(this.audio.duration);
    }

    formatTime(sec) {
        if (!sec || isNaN(sec)) return "0:00";
        const m = Math.floor(sec / 60); const s = Math.floor(sec % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    }

    load(track) {
        this.audio.src = track.url;
        document.getElementById('player-title').textContent = track.title;
        document.getElementById('player-artist').textContent = track.artist || 'Unknown Artist';
        const artEl = document.getElementById('player-art');
        if (artEl) { artEl.src = track.cover; artEl.classList.remove('hidden'); }
        this.audio.play();
    }
}

// --- 3. UI & Routing Controller ---
class ChodApp {
    constructor() {
        this.contentArea = document.getElementById('app-content');
        this.player = new ChodPlayer();
        this.init();
    }

    init() {
        // Global Navigation Event Delegation
        document.body.addEventListener('click', (e) => {
            const nav = e.target.closest('.nav-link');
            if (nav && nav.dataset.route) {
                e.preventDefault();
                this.navigate(nav.dataset.route);
            }

            const playBtn = e.target.closest('[data-play]');
            if (playBtn) {
                this.player.load(JSON.parse(playBtn.dataset.play));
            }
        });

        // Browser History Support
        window.onpopstate = () => this.loadRoute(window.location.hash.replace('#', '') || 'home');

        // Initial Route
        const startRoute = window.location.hash.replace('#', '') || 'home';
        this.loadRoute(startRoute);
        this.updateAuthUI();
    }

    async navigate(route) {
        if (window.location.hash !== `#${route}`) window.location.hash = route;
        await this.loadRoute(route);
    }

    async loadRoute(route) {
        try {
            const res = await fetch(`${route}.html`);
            if (!res.ok) throw new Error(`Page not found: ${route}`);
            const html = await res.text();
            this.contentArea.innerHTML = html;

            // Page-specific initialization
            if (route === 'auth') this.initAuthView();

            window.scrollTo(0, 0);
        } catch (e) {
            console.error("Navigation error:", e);
            this.contentArea.innerHTML = `<div class="p-20 text-center text-red-500">Error loading page. <br> ${e.message}</div>`;
        }
    }

    updateAuthUI() {
        const user = JSON.parse(localStorage.getItem('chod_user'));
        const authContainer = document.getElementById('auth-container');
        const userMenu = document.getElementById('user-menu');
        if (user) {
            if (authContainer) authContainer.classList.add('hidden');
            if (userMenu) {
                userMenu.classList.remove('hidden');
                const avatar = document.getElementById('header-user-avatar');
                if (avatar) avatar.src = `https://ui-avatars.com/api/?name=${user.username || 'User'}&background=00609b&color=fff`;
            }
        } else {
            if (authContainer) authContainer.classList.remove('hidden');
            if (userMenu) userMenu.classList.add('hidden');
        }
    }

    initAuthView() {
        const msgArea = document.getElementById('auth-error-msg');
        const showMsg = (msg, type = 'error') => {
            if (!msgArea) return;
            const textEl = document.getElementById('auth-msg-text');
            if (textEl) textEl.textContent = msg;
            msgArea.className = `p-4 rounded-xl flex items-center gap-3 ${type === 'error' ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-500'}`;
            msgArea.classList.remove('hidden');
        };

        const toggleBtn = document.getElementById('toggle-btn');
        if (toggleBtn) {
            toggleBtn.onclick = () => {
                const loginForm = document.getElementById('login-form');
                const registerForm = document.getElementById('register-form');
                const title = document.getElementById('auth-title');
                if (loginForm.classList.contains('hidden')) {
                    loginForm.classList.remove('hidden'); registerForm.classList.add('hidden');
                    title.textContent = 'Sign In'; toggleBtn.textContent = 'Get Started';
                } else {
                    loginForm.classList.add('hidden'); registerForm.classList.remove('hidden');
                    title.textContent = 'Create Account'; toggleBtn.textContent = 'Back to Login';
                }
                if (msgArea) msgArea.classList.add('hidden');
            };
        }

        const loginBtn = document.getElementById('btn-login-submit');
        if (loginBtn) {
            loginBtn.onclick = async () => {
                const email = document.getElementById('email').value;
                const pass = document.getElementById('password').value;
                if (!email || !pass) return showMsg("Enter email and password");
                loginBtn.disabled = true; loginBtn.innerHTML = '<span class="animate-spin material-symbols-rounded">sync</span>';
                try {
                    const data = await AuthService.login(email, pass);
                    localStorage.setItem('chod_user', JSON.stringify({
                        id: data.user.id,
                        email: data.user.email,
                        username: data.user.user_metadata?.username
                    }));
                    this.updateAuthUI();
                    this.navigate('home');
                } catch (e) {
                    showMsg(e.message);
                    loginBtn.disabled = false;
                    loginBtn.innerHTML = 'Sign In';
                }
            };
        }

        const regBtn = document.getElementById('btn-register-submit');
        if (regBtn) {
            regBtn.onclick = async () => {
                const username = document.getElementById('username').value;
                const email = document.getElementById('reg-email').value;
                const pass = document.getElementById('reg-password').value;
                const fname = document.getElementById('firstname').value;
                const lname = document.getElementById('lastname').value;

                if (!email || !pass || !username) return showMsg("Fill in required fields");

                regBtn.disabled = true;
                regBtn.innerHTML = '<span class="animate-spin material-symbols-rounded">sync</span>';

                try {
                    await AuthService.register(email, pass, username, fname, lname);
                    showMsg("Account created! Logging you in...", "success");
                    // Auto-login or redirect
                    setTimeout(() => toggleBtn.click(), 2000);
                } catch (e) {
                    showMsg(e.message);
                } finally {
                    regBtn.disabled = false;
                    regBtn.innerHTML = 'Create Account';
                }
            };
        }
    }
}

// Global Launcher
document.addEventListener('DOMContentLoaded', () => {
    window.app = new ChodApp();
    initSupabase();
});
