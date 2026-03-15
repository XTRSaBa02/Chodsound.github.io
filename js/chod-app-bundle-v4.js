/**
 * ChodSound - Unified Bundle v4.1
 * SPA Fragment Integration & Page Initializers
 */

(function () {
    console.log("%c ChodSound v4.1: Loading... ", "background: #00609b; color: #fff; padding: 2px 5px; border-radius: 3px;");

    const SUPABASE_URL = 'https://cxantzvxxrycibozahak.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4YW50enZ4eHJ5Y2lib3phaGFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxNzE3MjAsImV4cCI6MjA4Nzc0NzcyMH0._l0jmsTeRmLRnCKr2u69e1Ore4yzzcTK6vl78M41jY0';

    let supabase = null;
    let initRetries = 0;

    const initSupabase = () => {
        if (window.supabase) {
            try {
                supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
                console.log("%c ChodSound: Supabase Connection Established ", "color: #10b981; font-weight: bold;");
                return true;
            } catch (e) {
                console.error("ChodSound: Supabase Init Failed", e);
            }
        }
        return false;
    };

    // --- AuthService Logic ---
    window.AuthService = {
        async register(email, password, username, firstname, lastname) {
            if (!supabase) throw new Error("Connection not ready. Please refresh.");
            const { data, error } = await supabase.auth.signUp({
                email, password,
                options: { data: { username, first_name: firstname, last_name: lastname } }
            });
            if (error) throw error;
            if (!data.user) throw new Error("Auth failed.");
            await supabase.from('profiles').upsert({
                id: data.user.id,
                username: username,
                first_name: firstname,
                last_name: lastname,
                updated_at: new Date().toISOString()
            });
            return data;
        },
        async login(email, password) {
            if (!supabase) throw new Error("Connection not ready.");
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
            return data;
        },
        logout() {
            if (supabase) supabase.auth.signOut();
            localStorage.removeItem('chod_user');
            window.location.reload();
        }
    };

    // --- Page Initializers ---
    const PageInitializers = {
        home: (app) => app.setupHomeUI(),
        auth: (app) => app.setupAuthUI(),
        register: (app) => app.setupAuthUI(),
        upload: (app) => app.setupUploadUI(),
        profile: (app, params) => app.setupProfileUI(params.get('id')),
        search: (app, params) => app.setupSearchUI(params.get('q')),
        croppload: (app) => app.setupCropperUI(),
        audioplay: (app) => app.setupAudioPlayUI(),
        following: (app) => app.setupFollowingUI(),
        playlist: (app, params) => app.setupPlaylistUI(params.get('id')),
        alltrack: (app) => app.setupAllTracksUI()
    };

    // --- Audio Player Controller ---
    class PlayerController {
        constructor() {
            this.audio = document.getElementById('core-audio-element');
            this.playBtn = document.getElementById('btn-play-pause');
            this.progress = document.getElementById('player-progress');
            this.currentTime = document.getElementById('time-current');
            this.totalTime = document.getElementById('time-total');
            this.isPlaying = false;
            this.isShuffle = false;
            this.isRepeat = false;
            this.queue = [];
            this.currentIndex = -1;
            this.setupListeners();
        }
        setupListeners() {
            if (!this.playBtn || !this.audio) return;
            this.playBtn.onclick = () => this.toggle();
            this.audio.ontimeupdate = () => this.syncUI();
            this.audio.onplay = () => this.updateIcon(true);
            this.audio.onpause = () => this.updateIcon(false);

            // volume
            const vol = document.getElementById('volume-slider');
            if (vol) vol.oninput = (e) => this.audio.volume = e.target.value;

            // Seek functionality
            const progressContainer = document.getElementById('player-progress-container');
            if (progressContainer) {
                progressContainer.onclick = (e) => {
                    if (!this.audio.duration) return;
                    const rect = progressContainer.getBoundingClientRect();
                    const pos = (e.clientX - rect.left) / rect.width;
                    this.audio.currentTime = pos * this.audio.duration;
                };
            }

            // Like functionality
            const likeBtn = document.getElementById('btn-like-player');
            if (likeBtn) {
                likeBtn.onclick = () => this.toggleLike();
            }

            // Playlist functionality
            const playlistBtn = document.getElementById('btn-playlist-player');
            if (playlistBtn) {
                playlistBtn.onclick = () => this.openPlaylistPicker();
            }

            // Shuffle & Repeat
            const shuffleBtn = document.getElementById('btn-shuffle');
            if (shuffleBtn) shuffleBtn.onclick = () => this.toggleShuffle();

            const repeatBtn = document.getElementById('btn-repeat');
            if (repeatBtn) repeatBtn.onclick = () => this.toggleRepeat();

            // Next & Prev
            const nextBtn = document.getElementById('btn-next');
            if (nextBtn) nextBtn.onclick = () => this.playNext();

            const prevBtn = document.getElementById('btn-prev');
            if (prevBtn) prevBtn.onclick = () => this.playPrev();

            // Handle track end
            this.audio.onended = () => {
                if (this.isRepeat === 2) {
                    this.audio.currentTime = 0;
                    this.audio.play();
                } else {
                    this.playNext(true);
                }
            };
        }
        toggle() {
            if (!this.audio.src) return;
            this.isPlaying ? this.audio.pause() : this.audio.play();
        }
        updateIcon(playing) {
            this.isPlaying = playing;
            const icon = this.playBtn.querySelector('.material-symbols-rounded');
            if (icon) icon.textContent = playing ? 'pause' : 'play_arrow';
        }
        syncUI() {
            if (!this.audio.duration) return;
            const p = (this.audio.currentTime / this.audio.duration) * 100;
            if (this.progress) this.progress.style.width = `${p}%`;
            if (this.currentTime) this.currentTime.textContent = this.fmt(this.audio.currentTime);
            if (this.totalTime) this.totalTime.textContent = this.fmt(this.audio.duration);
        }
        fmt(s) {
            if (isNaN(s)) return "0:00";
            const m = Math.floor(s / 60); const sc = Math.floor(s % 60);
            return `${m}:${sc < 10 ? '0' : ''}${sc}`;
        }
        fmtCompact(num) {
            if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
            if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
            return num.toString();
        }
        toggleShuffle() {
            this.isShuffle = !this.isShuffle;
            const btn = document.getElementById('btn-shuffle');
            if (btn) {
                btn.classList.toggle('text-primary', this.isShuffle);
                btn.classList.toggle('text-slate-400', !this.isShuffle);
            }
        }
        toggleRepeat() {
            this.isRepeat = (this.isRepeat + 1) % 3;
            const btn = document.getElementById('btn-repeat');
            const icon = btn?.querySelector('.material-symbols-rounded');
            if (btn && icon) {
                if (this.isRepeat === 0) {
                    btn.className = "text-slate-400 hover:text-primary transition-colors hidden sm:block";
                    icon.textContent = "repeat";
                } else if (this.isRepeat === 1) {
                    btn.className = "text-primary hover:text-primary transition-colors hidden sm:block";
                    icon.textContent = "repeat";
                } else {
                    btn.className = "text-primary hover:text-primary transition-colors hidden sm:block";
                    icon.textContent = "repeat_one";
                }
            }
        }
        playNext(auto = false) {
            if (this.queue.length === 0) return;
            let nextIndex;
            if (this.isShuffle) {
                nextIndex = Math.floor(Math.random() * this.queue.length);
            } else {
                nextIndex = this.currentIndex + 1;
                if (nextIndex >= this.queue.length) {
                    if (this.isRepeat === 1 || auto) nextIndex = 0;
                    else return;
                }
            }
            this.playTrack(this.queue[nextIndex], nextIndex);
        }
        playPrev() {
            if (this.queue.length === 0) return;
            let prevIndex = this.currentIndex - 1;
            if (prevIndex < 0) {
                prevIndex = this.queue.length - 1;
            }
            this.playTrack(this.queue[prevIndex], prevIndex);
        }
        async playTrack(track, index = -1) {
            if (!track || !track.url) return;
            this.currentTrack = track;
            if (index !== -1) this.currentIndex = index;

            this.audio.src = track.url;
            if (document.getElementById('player-title')) document.getElementById('player-title').textContent = track.title;
            if (document.getElementById('player-artist')) document.getElementById('player-artist').textContent = track.artist || 'Unknown';
            const art = document.getElementById('player-art');
            if (art) { art.src = track.cover; art.classList.remove('hidden'); }
            this.audio.play();
            localStorage.setItem('chod_current_track', JSON.stringify(track));
            this.checkLikeStatus();

            if (window.location.hash.includes('audioplay')) {
                // Important: Need to use setTimeout or slight delay sometimes to let UI settle,
                // but we also need to fully refresh Wavesurfer and Comments.
                if (window.app && typeof window.app.setupAudioPlayUI === 'function') {
                    // Small delay ensures DOM is ready for a new track's waveform, etc.
                    setTimeout(() => window.app.setupAudioPlayUI(), 50);
                }
            }

            // Increment plays_count in DB
            try {
                await supabase.rpc('increment_plays', { track_id: track.id });
                // Fallback if RPC doesn't exist (though RPC is safer for concurrency)
                // await supabase.from('tracks').update({ plays_count: (track.plays_count || 0) + 1 }).eq('id', track.id);
            } catch (e) {
                // If RPC fails, try simple update
                supabase.from('tracks').select('plays_count').eq('id', track.id).single().then(({ data }) => {
                    if (data) supabase.from('tracks').update({ plays_count: (data.plays_count || 0) + 1 }).eq('id', track.id);
                });
            }
        }

        async checkLikeStatus() {
            const user = JSON.parse(localStorage.getItem('chod_user'));
            const likeBtn = document.getElementById('btn-like-player');
            if (!user || !this.currentTrack || !likeBtn) return;

            const { data } = await supabase.from('likes')
                .select('*')
                .eq('profile_id', user.id)
                .eq('track_id', this.currentTrack.id)
                .single();

            const icon = likeBtn.querySelector('.material-symbols-rounded');
            if (icon) {
                icon.textContent = data ? 'favorite' : 'favorite';
                icon.classList.toggle('fill-current', !!data);
                icon.classList.toggle('text-pink-500', !!data);
            }
        }

        async toggleLike() {
            const user = JSON.parse(localStorage.getItem('chod_user'));
            if (!user) {
                alert("Please sign in to like tracks.");
                window.app.goTo('auth');
                return;
            }
            if (!this.currentTrack) return;

            const { data: existing } = await supabase.from('likes')
                .select('*')
                .eq('profile_id', user.id)
                .eq('track_id', this.currentTrack.id)
                .single();

            if (existing) {
                await supabase.from('likes').delete().eq('id', existing.id);
            } else {
                await supabase.from('likes').insert({
                    profile_id: user.id,
                    track_id: this.currentTrack.id
                });
            }
            this.checkLikeStatus();
        }

        async openPlaylistPicker() {
            const user = JSON.parse(localStorage.getItem('chod_user'));
            if (!user) { alert("Please sign in to manage playlists."); return; }
            if (!this.currentTrack) return;

            // Simple implementation: show a prompt for now, or fetch playlists
            const { data: playlists } = await supabase.from('playlists')
                .select('*')
                .eq('profile_id', user.id);

            if (!playlists || playlists.length === 0) {
                if (confirm("You don't have any playlists. Create one?")) {
                    const title = prompt("Playlist Title:");
                    if (title) {
                        const { data: newP, error } = await supabase.from('playlists').insert({
                            profile_id: user.id,
                            title: title
                        }).select().single();
                        if (newP) this.addToPlaylist(newP.id);
                    }
                }
                return;
            }

            // For now, let's just show a simple alert/confirm or a dynamically created list
            // In a real app, we'd open a modal. Let's create a small modal overlay.
            this.showPlaylistModal(playlists);
        }

        showPlaylistModal(playlists) {
            let modal = document.getElementById('playlist-picker-modal');
            if (!modal) {
                modal = document.createElement('div');
                modal.id = 'playlist-picker-modal';
                modal.className = 'fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4';
                document.body.appendChild(modal);
            }
            modal.innerHTML = `
                <div class="bg-white dark:bg-slate-900 w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
                    <div class="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                        <h3 class="font-bold text-slate-900 dark:text-white">Add to Playlist</h3>
                        <button onclick="this.closest('#playlist-picker-modal').remove()" class="text-slate-400 hover:text-slate-600"><span class="material-symbols-rounded">close</span></button>
                    </div>
                    <div class="p-4 space-y-2 max-h-64 overflow-y-auto">
                        ${playlists.map(p => `
                            <button class="w-full text-left p-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-3" onclick="window.app.player.addToPlaylist('${p.id}')">
                                <span class="material-symbols-rounded text-primary">playlist_add</span>
                                <span class="font-medium">${p.title}</span>
                            </button>
                        `).join('')}
                    </div>
                    <div class="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800">
                        <button onclick="window.app.player.createNewPlaylist()" class="w-full py-2 text-sm font-bold text-primary hover:underline">+ Create New Playlist</button>
                    </div>
                </div>
            `;
            modal.classList.remove('hidden');
        }

        async addToPlaylist(playlistId) {
            if (!this.currentTrack) return;
            const { error } = await supabase.from('playlist_tracks').insert({
                playlist_id: playlistId,
                track_id: this.currentTrack.id
            });
            if (error) {
                if (error.code === '23505') alert("Already in this playlist.");
                else alert("Failed to add to playlist.");
            } else {
                alert("Added to playlist!");
                const modal = document.getElementById('playlist-picker-modal');
                if (modal) modal.remove();
            }
        }

        async createNewPlaylist() {
            const user = JSON.parse(localStorage.getItem('chod_user'));
            const title = prompt("Playlist Title:");
            if (title && user) {
                const { data, error } = await supabase.from('playlists').insert({
                    profile_id: user.id,
                    title: title
                }).select().single();
                if (data) {
                    this.addToPlaylist(data.id);
                }
            }
        }
    }

    // --- Helpers ---
    const encodeTrack = (t) => {
        return btoa(encodeURIComponent(JSON.stringify(t)));
    };
    const decodeTrack = (str) => {
        try { return JSON.parse(decodeURIComponent(atob(str))); } catch (e) { return null; }
    };

    // --- Main Application SPA Controller ---
    class ChodApp {
        constructor() {
            this.content = document.getElementById('app-content');
            this.player = new PlayerController();
            this.init();
        }
        init() {
            document.addEventListener('click', (e) => {
                const routeEl = e.target.closest('[data-route]');
                if (routeEl) {
                    e.preventDefault();
                    this.goTo(routeEl.dataset.route);
                    return;
                }
                const playEl = e.target.closest('[data-play]');
                if (playEl) {
                    const track = decodeTrack(playEl.dataset.play);
                    if (track) {
                        // Build queue from siblings/context if needed
                        const specializedContainer = playEl.closest('#playlist-tracks-list, #profile-tracks, #search-tracks-container, #likes-container');
                        if (specializedContainer) {
                            const trackEls = Array.from(specializedContainer.querySelectorAll('[data-play]'));
                            const queue = trackEls.map(el => decodeTrack(el.dataset.play)).filter(Boolean);
                            const index = queue.findIndex(t => t.id === track.id);
                            this.player.queue = queue;
                            this.player.playTrack(track, index !== -1 ? index : 0);
                        } else {
                            // If clicked from Home or All Tracks, make the queue all recently added tracks
                            const allTracksContainer = playEl.closest('#home-recent, #home-trending, #alltracks-container');
                            if (allTracksContainer) {
                                const trackEls = Array.from(allTracksContainer.querySelectorAll('[data-play]'));
                                const guiQueue = trackEls.map(el => decodeTrack(el.dataset.play)).filter(Boolean);
                                // Fetch a larger global queue to "play all available tracks normally"
                                supabase.from('tracks').select('*').order('created_at', { ascending: false }).limit(50).then(({ data, error }) => {
                                    if (!error && data) {
                                        const dbQueue = data.map(t => ({ id: t.id, title: t.title, artist: t.artist, url: t.audio_url, cover: t.cover, genre: t.genre, profile_id: t.profile_id }));
                                        const queueMap = new Map();
                                        guiQueue.forEach(t => queueMap.set(t.id, t));
                                        dbQueue.forEach(t => { if (!queueMap.has(t.id)) queueMap.set(t.id, t); });
                                        const finalQueue = Array.from(queueMap.values());
                                        const index = finalQueue.findIndex(t => t.id === track.id);
                                        this.player.queue = finalQueue;
                                        this.player.playTrack(track, index !== -1 ? index : 0);
                                    } else {
                                        const index = guiQueue.findIndex(t => t.id === track.id);
                                        this.player.queue = guiQueue;
                                        this.player.playTrack(track, index !== -1 ? index : 0);
                                    }
                                });
                            } else {
                                this.player.queue = [track];
                                this.player.playTrack(track, 0);
                            }
                        }


                    }
                    return;
                }
                const tabEl = e.target.closest('[onclick*="switchTab"]');
                if (tabEl) {
                    const match = tabEl.getAttribute('onclick').match(/'([^']+)'/);
                    if (match) {
                        e.preventDefault();
                        this.switchTab(tabEl, match[1]);
                    }
                }
            });

            const searchForm = document.getElementById('search-form');
            const searchInput = document.getElementById('global-search-input');
            if (searchForm && searchInput) {
                searchForm.onsubmit = (e) => {
                    e.preventDefault();
                    const q = searchInput.value.trim();
                    if (q) this.goTo('search', { q });
                };
            }

            window.addEventListener('hashchange', () => {
                this.render(window.location.hash.slice(1) || 'home');
            });

            // Initial render
            this.render(window.location.hash.slice(1) || 'home');
            this.syncAuth();
        }
        async goTo(route, params = {}) {
            let hash = route;
            const query = new URLSearchParams(params).toString();
            if (query) hash += `?${query}`;
            window.location.hash = hash;
        }
        async render(routeWithParams) {
            try {
                const [route, queryString] = routeWithParams.split('?');
                const params = new URLSearchParams(queryString);


                let fileName = route.endsWith('.html') ? route : `${route}.html`;
                if (fileName.startsWith('/')) fileName = fileName.slice(1);
                console.log(`ChodSound: Fetching fragment from ${fileName}`);

                const res = await fetch(fileName);
                if (!res.ok) {
                    console.error(`ChodSound: 404 Not Found - ${fileName}`);
                    throw new Error(`NotFound: ${fileName}`);
                }

                let html = await res.text();
                let contentHTML = html.trim();

                if (html.toLowerCase().includes('<body')) {
                    const bodyMatch = html.match(/<body[^>]*>([\s\S.]*)<\/body>/i);
                    if (bodyMatch) contentHTML = bodyMatch[1].trim();
                }

                this.content.innerHTML = contentHTML;
                if (PageInitializers[route]) PageInitializers[route](this, params);
                window.scrollTo(0, 0);
            } catch (err) {
                console.error("Navigation Error:", err);
                this.content.innerHTML = `<div class="p-20 text-center">
                    <h2 class="text-2xl font-bold mb-2">Page Not Found</h2>
                    <p class="text-slate-500">The requested resource "${route}" could not be loaded.</p>
                    <button class="mt-4 px-6 py-2 bg-primary text-white rounded-full nav-link" data-route="home">Back to Home</button>
                </div>`;
            }
        }
        async syncAuth() {
            const user = JSON.parse(localStorage.getItem('chod_user'));
            const container = document.getElementById('auth-container');
            const menu = document.getElementById('user-menu');
            if (user && container && menu) {
                container.classList.add('hidden');
                menu.classList.remove('hidden');
                const avatar = document.getElementById('header-user-avatar');
                if (avatar) {
                    // Start with a fallback
                    const fallback = `https://ui-avatars.com/api/?name=${user.username || 'User'}&background=00609b&color=fff`;
                    avatar.src = user.avatar_url || fallback;

                    // Fetch fresh profile data to see if there's a new avatar
                    try {
                        const { data } = await supabase.from('profiles').select('avatar_url').eq('id', user.id).single();
                        if (data?.avatar_url) avatar.src = data.avatar_url;
                    } catch (e) { }
                }
            } else if (container && menu) {
                container.classList.remove('hidden'); menu.classList.add('hidden');
            }
        }
        switchTab(target, tabId) {
            document.querySelectorAll('.p-nav-item').forEach(el => el.classList.remove('active'));
            target.classList.add('active');
            document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
            const tab = document.getElementById(`tab-${tabId}`);
            if (tab) tab.classList.remove('hidden');
        }
        setupAuthUI() {
            const msg = (txt, type = 'error') => {
                const area = document.getElementById('auth-error-msg');
                const t = document.getElementById('auth-msg-text');
                if (area && t) {
                    t.textContent = txt;
                    area.className = `p-4 rounded-xl flex items-center gap-3 ${type === 'error' ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-500'}`;
                    area.classList.remove('hidden');
                }
            };
            const toggle = document.getElementById('toggle-btn');
            if (toggle) {
                toggle.onclick = () => {
                    const l = document.getElementById('login-form');
                    const r = document.getElementById('register-form');
                    if (l && r) {
                        l.classList.toggle('hidden'); r.classList.toggle('hidden');
                        const isReg = !r.classList.contains('hidden');
                        document.getElementById('auth-title').textContent = isReg ? 'Create Account' : 'Sign In';
                        toggle.textContent = isReg ? 'Back to Login' : 'Get Started';
                    }
                };
            }
            const btnLogin = document.getElementById('btn-login-submit');
            if (btnLogin) {
                btnLogin.onclick = async () => {
                    const e = document.getElementById('email').value;
                    const p = document.getElementById('password').value;
                    if (!e || !p) return msg("Missing fields");
                    btnLogin.disabled = true;
                    try {
                        const data = await window.AuthService.login(e, p);
                        localStorage.setItem('chod_user', JSON.stringify({ id: data.user.id, email: data.user.email, username: data.user.user_metadata?.username }));
                        this.syncAuth(); this.goTo('home');
                    } catch (err) { msg(err.message); btnLogin.disabled = false; }
                };
            }
            const btnReg = document.getElementById('btn-register-submit');
            if (btnReg) {
                btnReg.onclick = async () => {
                    const u = document.getElementById('username').value;
                    const e = document.getElementById('reg-email').value;
                    const p = document.getElementById('reg-password').value;
                    if (!u || !e || !p) return msg("Required fields missing");
                    btnReg.disabled = true;
                    try {
                        await window.AuthService.register(e, p, u, document.getElementById('firstname').value, document.getElementById('lastname').value);
                        msg("Success! Redirecting to login...", "success");
                        setTimeout(() => this.goTo('auth'), 2000);
                    } catch (err) { msg(err.message); btnReg.disabled = false; }
                };
            }
        }
        setupUploadUI() {
            const input = document.getElementById('upload-file-input');
            const nameDisplay = document.getElementById('upload-file-name');
            const form = document.getElementById('upload-form');
            const btn = document.getElementById('btn-upload-submit');
            const spinner = document.getElementById('upload-spinner');
            const btnText = document.getElementById('upload-btn-text');

            if (input && nameDisplay) {
                input.onchange = (e) => {
                    const file = e.target.files[0];
                    if (file) {
                        nameDisplay.textContent = `Selected: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`;
                        nameDisplay.classList.remove('hidden');
                    } else {
                        nameDisplay.classList.add('hidden');
                    }
                };
            }

            let cropperInstance = null;
            let croppedImageBlob = null;
            const coverInput = document.getElementById('upload-cover-input');
            const coverNameDisplay = document.getElementById('upload-cover-name');
            const cropperModal = document.getElementById('image-cropper-modal');
            const cropperPreview = document.getElementById('image-cropper-preview');
            const btnCancelCrop = document.getElementById('btn-cancel-crop');
            const btnApplyCrop = document.getElementById('btn-apply-crop');

            if (coverInput && coverNameDisplay) {
                coverInput.onchange = (e) => {
                    const file = e.target.files[0];
                    if (file) {
                        if (file.type.startsWith('image/')) {
                            const reader = new FileReader();
                            reader.onload = (ev) => {
                                if (cropperPreview) {
                                    cropperPreview.src = ev.target.result;
                                    cropperPreview.classList.remove('hidden');
                                    if (cropperModal) cropperModal.classList.remove('hidden');

                                    if (cropperInstance) cropperInstance.destroy();
                                    if (typeof Cropper !== 'undefined') {
                                        cropperInstance = new Cropper(cropperPreview, {
                                            aspectRatio: 1,
                                            viewMode: 2,
                                            dragMode: 'move',
                                            autoCropArea: 1,
                                            cropBoxResizable: true,
                                            cropBoxMovable: true
                                        });
                                    }
                                }
                            };
                            reader.readAsDataURL(file);
                        }
                    } else {
                        coverNameDisplay.classList.add('hidden');
                        croppedImageBlob = null;
                    }
                };

                if (btnCancelCrop) {
                    btnCancelCrop.onclick = () => {
                        if (cropperModal) cropperModal.classList.add('hidden');
                        if (cropperInstance) { cropperInstance.destroy(); cropperInstance = null; }
                        coverInput.value = '';
                        croppedImageBlob = null;
                        coverNameDisplay.classList.add('hidden');
                    };
                }

                if (btnApplyCrop) {
                    btnApplyCrop.onclick = () => {
                        if (cropperInstance) {
                            cropperInstance.getCroppedCanvas({
                                width: 800,
                                height: 800
                            }).toBlob((blob) => {
                                croppedImageBlob = blob;
                                coverNameDisplay.textContent = `Cover: Cropped Image Selected`;
                                coverNameDisplay.classList.remove('hidden');
                                if (cropperModal) cropperModal.classList.add('hidden');
                                cropperInstance.destroy();
                                cropperInstance = null;
                            }, 'image/jpeg', 0.9);
                        }
                    };
                }
            }

            if (form) {
                form.onsubmit = async (e) => {
                    e.preventDefault();
                    if (!supabase) return alert("Supabase not initialized.");
                    const user = JSON.parse(localStorage.getItem('chod_user'));
                    if (!user) {
                        alert("You must be logged in to upload!");
                        this.goTo('auth');
                        return;
                    }

                    const file = input?.files[0];
                    if (!file) return alert("Please select an audio file.");
                    if (!file.type.startsWith('audio/')) return alert("File must be an audio format.");
                    if (file.size > 50 * 1024 * 1024) return alert("File exceeds 50MB limit.");

                    const title = document.getElementById('title').value;
                    if (!title) return alert("Please enter a title.");

                    // Start Upload
                    btn.disabled = true;
                    spinner.classList.remove('hidden');
                    btnText.textContent = "Calculating...";

                    try {
                        // 0. Calculate Duration
                        const getDuration = (file) => {
                            return new Promise((resolve) => {
                                const audio = new Audio();
                                audio.onloadedmetadata = () => {
                                    const dur = audio.duration;
                                    URL.revokeObjectURL(audio.src);
                                    resolve(dur);
                                };
                                audio.onerror = () => resolve(0);
                                audio.src = URL.createObjectURL(file);
                            });
                        };
                        const trackDuration = await getDuration(file);
                        btnText.textContent = "Uploading...";
                        // 1. Upload to Supabase Storage (Audio)
                        const fileExt = file.name.split('.').pop();
                        const fileName = `${user.id}_${Date.now()}.${fileExt}`;
                        const filePath = `${user.id}/${fileName}`;

                        const { error: uploadError } = await supabase.storage
                            .from('audio')
                            .upload(filePath, file);

                        if (uploadError) throw uploadError;

                        const { data: { publicUrl: audioPublicUrl } } = supabase.storage
                            .from('audio')
                            .getPublicUrl(filePath);

                        // 2. Upload Cover Image (if provided)
                        let coverUrl = 'https://images.unsplash.com/photo-1614149162883-504ce4d1ed15?auto=format&fit=crop&w=200&q=80';
                        const coverFile = croppedImageBlob || coverInput?.files[0];
                        if (coverFile) {
                            if (coverFile.size > 2 * 1024 * 1024) throw new Error("Cover image exceeds 2MB limit.");
                            const coverExt = coverFile.name ? coverFile.name.split('.').pop() : 'jpg';
                            const coverName = `${user.id}_cover_${Date.now()}.${coverExt}`;
                            const coverPath = `${user.id}/${coverName}`;

                            const { error: coverUploadError } = await supabase.storage
                                .from('covers')
                                .upload(coverPath, coverFile);

                            if (coverUploadError) throw coverUploadError;

                            const { data: { publicUrl: fetchedCoverUrl } } = supabase.storage
                                .from('covers')
                                .getPublicUrl(coverPath);
                            coverUrl = fetchedCoverUrl;
                        }

                        // 3. Ensure Profile Record (Prevents FK error)
                        const { data: { user: authUser } } = await supabase.auth.getUser();
                        if (!authUser) throw new Error("Authentication session lost. Please re-login.");

                        const { data: profileCheck } = await supabase.from('profiles').select('id').eq('id', authUser.id).single();

                        if (!profileCheck) {
                            console.log("No profile found for current user, creating one...");
                            const meta = authUser.user_metadata || {};
                            // Try to insert profile. If username fails, try a random one.
                            const baseUsername = meta.username || user.username || 'user';
                            const { error: profErr } = await supabase.from('profiles').upsert({
                                id: authUser.id,
                                username: baseUsername,
                                first_name: meta.first_name || '',
                                last_name: meta.last_name || ''
                            });

                            if (profErr) {
                                console.warn("First profile upsert failed, retrying with fallback username:", profErr.message);
                                const { error: retryErr } = await supabase.from('profiles').upsert({
                                    id: authUser.id,
                                    username: baseUsername + '_' + Math.floor(Math.random() * 1000),
                                    first_name: meta.first_name || '',
                                    last_name: meta.last_name || ''
                                });
                                if (retryErr) throw new Error("Could not create user profile: " + retryErr.message);
                            }
                        }

                        // 4. Insert into Tracks Table
                        const { error: dbError } = await supabase.from('tracks').insert({
                            profile_id: authUser.id,
                            title: title,
                            genre: document.getElementById('genre').value || 'other',
                            audio_url: audioPublicUrl,
                            artist: user.username || 'Unknown',
                            cover: coverUrl,
                            duration: Math.round(trackDuration),
                            is_public: document.getElementById('visibility-toggle')?.checked ?? true
                        });

                        if (dbError) throw dbError;

                        alert("Track uploaded successfully!");
                        this.goTo('profile'); // Redirect back to library

                    } catch (err) {
                        console.error("Upload Error:", err);
                        alert("Upload failed: " + err.message);
                    } finally {
                        btn.disabled = false;
                        spinner.classList.add('hidden');
                        btnText.textContent = "Save & Publish";
                    }
                };
            }
        }

        // Helper to format duration like 40s., 1:30m., 20:59m.
        fmtDuration(s) {
            if (!s || isNaN(s)) return "0s.";
            if (s < 60) return `${Math.round(s)}s.`;
            const m = Math.floor(s / 60);
            const sc = Math.round(s % 60);
            return `${m}:${sc < 10 ? '0' : ''}${sc}m.`;
        }

        async setupHomeUI() {
            if (!supabase) return;
            const trendingContainer = document.getElementById('home-trending');
            const recentContainer = document.getElementById('home-recent');

            try {
                // Fetch Trending (By plays_count with like count join)
                const { data: trendingTracks, error: tErr } = await supabase
                    .from('tracks')
                    .select('*, likes:likes(count)')
                    .eq('is_public', true)
                    .order('plays_count', { ascending: false })
                    .limit(4);

                if (tErr) throw tErr;

                if (trendingContainer) {
                    if (!trendingTracks || trendingTracks.length === 0) {
                        trendingContainer.innerHTML = '<div class="col-span-full py-12 text-center text-slate-500">No tracks uploaded yet.</div>';
                    } else {
                        trendingContainer.innerHTML = trendingTracks.map(t => this.renderTrackCard(t)).join('');
                    }
                }

                // Fetch Recent 
                const { data: recentTracks, error: rErr } = await supabase
                    .from('tracks')
                    .select('*, likes:likes(count)')
                    .eq('is_public', true)
                    .order('created_at', { ascending: false })
                    .limit(10);

                if (rErr) throw rErr;

                if (recentContainer) {
                    if (!recentTracks || recentTracks.length === 0) {
                        recentContainer.innerHTML = '<div class="py-8 text-center text-slate-500">No recent activity.</div>';
                    } else {
                        recentContainer.innerHTML = recentTracks.map(t => {
                            const track = { id: t.id, title: t.title, artist: t.artist, url: t.audio_url, cover: t.cover, genre: t.genre, profile_id: t.profile_id };
                            const trackAttr = encodeTrack(track);

                            const playsCount = t.plays_count || 0;
                            const likesCount = t.likes?.[0]?.count ?? (t.likes?.length || 0);

                            return `
                            <div class="group flex items-center gap-4 p-3 rounded-xl hover:bg-white/50 dark:hover:bg-slate-800/50 transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-800">
                                <div class="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 cursor-pointer" data-play="${trackAttr}">
                                    <img alt="Track small" class="w-full h-full object-cover group-hover:opacity-50 transition-opacity" src="${t.cover}" />
                                </div>
                                <div class="flex-1 min-w-0 cursor-pointer" data-play="${trackAttr}">
                                    <p class="font-semibold text-sm truncate hover:text-primary transition-colors">${t.title}</p>
                                    <p class="text-xs text-slate-500 dark:text-slate-400 truncate">${t.artist}</p>
                                </div>
                                <div class="hidden md:flex items-center gap-6">
                                    <div class="hidden lg:block w-24 text-slate-500 dark:text-slate-400 text-xs font-semibold capitalize">${t.genre || 'Other'}</div>
                                    <div class="flex items-center gap-4">
                                        <div class="border border-slate-300 dark:border-white/20 rounded px-2 py-0.5 text-[10px] font-mono font-bold text-slate-400 dark:text-slate-300">
                                            ${(!t.duration || t.duration === 0) ? `<audio src="${t.audio_url}" preload="metadata" onloadedmetadata="this.nextElementSibling.textContent = window.app.fmtDuration(this.duration)"></audio><span>0s.</span>` : `<span>${this.fmtDuration(t.duration)}</span>`}
                                        </div>
                                        <div class="flex items-center gap-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
                                            <div class="flex items-center gap-1.5">
                                                <span class="material-symbols-rounded text-base">play_arrow</span>
                                                <span>${this.player.fmtCompact(t.plays_count || 0)}</span>
                                            </div>
                                            <div class="flex items-center gap-1.5">
                                                <span class="material-symbols-rounded text-base">favorite</span>
                                                <span>${this.player.fmtCompact(t.likes?.[0]?.count ?? 0)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            `;
                        }).join('');
                    }
                }

            } catch (err) {
                console.error('Error fetching home feed:', err);
                if (trendingContainer) trendingContainer.innerHTML = `<div class="col-span-full py-12 text-center text-red-500">Failed to load tracks: ${err.message}</div>`;
                if (recentContainer) recentContainer.innerHTML = `<div class="py-8 text-center text-red-500">Failed to load tracks.</div>`;
            }
        }

        async setupProfileUI(targetId) {
            const currentUser = JSON.parse(localStorage.getItem('chod_user'));
            // If targetId is null/undefined, we view ourselves. If it matches currentUser.id, we also view ourselves.
            const isSelf = !targetId || (currentUser && targetId === currentUser.id);
            const viewId = isSelf ? (currentUser?.id) : targetId;

            if (!viewId && !currentUser) {
                this.goTo('auth');
                return;
            }

            const nameEl = document.getElementById('prof-name');
            const avatarEl = document.getElementById('prof-avatar');
            const ownActions = document.getElementById('own-profile-actions');
            const otherActions = document.getElementById('other-profile-actions');
            const btnFollow = document.getElementById('btn-follow');

            // Show/Hide relevant action buttons
            if (isSelf) {
                if (ownActions) ownActions.classList.remove('hidden');
                if (otherActions) otherActions.classList.add('hidden');
            } else {
                if (ownActions) ownActions.classList.add('hidden');
                if (otherActions) otherActions.classList.remove('hidden');
            }

            // We fetch profile data for viewId
            try {
                const { data: profileDb } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', viewId)
                    .single();

                if (profileDb) {
                    const fullName = [profileDb.first_name, profileDb.last_name].filter(Boolean).join(' ') || profileDb.username || 'User';
                    if (nameEl) nameEl.textContent = fullName;
                    if (avatarEl) avatarEl.src = profileDb.avatar_url || `https://ui-avatars.com/api/?name=${profileDb.username || 'User'}&background=00609b&color=fff&size=256`;

                    if (isSelf && currentUser) {
                        // Update fresh username to localstorage
                        currentUser.username = profileDb.username;
                        localStorage.setItem('chod_user', JSON.stringify(currentUser));
                    }
                }

                // Check Follow Status
                if (!isSelf && currentUser && btnFollow) {
                    const { data: followRecord } = await supabase
                        .from('followers')
                        .select('*')
                        .eq('follower_id', currentUser.id)
                        .eq('following_id', viewId)
                        .single();

                    this.updateFollowUI(!!followRecord);
                    btnFollow.onclick = () => this.toggleFollow(viewId);
                }

                // Fetch Real Metrics
                const [{ count: followersCount }, { count: followingCount }, { count: tracksCount }] = await Promise.all([
                    supabase.from('followers').select('*', { count: 'exact', head: true }).eq('following_id', viewId),
                    supabase.from('followers').select('*', { count: 'exact', head: true }).eq('follower_id', viewId),
                    supabase.from('tracks').select('*', { count: 'exact', head: true }).eq('profile_id', viewId)
                ]);

                const fcl = document.getElementById('prof-followers-count');
                const fgi = document.getElementById('prof-following-count');
                const tcl = document.getElementById('prof-tracks-count');

                if (fcl) fcl.textContent = this.player.fmtCompact(followersCount || 0);
                if (fgi) fgi.textContent = this.player.fmtCompact(followingCount || 0);
                if (tcl) tcl.textContent = this.player.fmtCompact(tracksCount || 0);

            } catch (e) { console.error("Could not fetch profile or metrics", e); }


            // Setup Profile Action Buttons (Self)
            const btnEditProfile = document.getElementById('btn-edit-profile');
            if (btnEditProfile) {
                btnEditProfile.onclick = () => this.openEditProfileModal(currentUser);
            }

            const btnLogout = document.getElementById('btn-logout');
            if (btnLogout) {
                btnLogout.onclick = async () => {
                    await supabase.auth.signOut();
                    localStorage.removeItem('chod_user');
                    this.syncAuth();
                    this.goTo('auth');
                };
            }

            const tracksContainer = document.getElementById('profile-tracks-container');
            if (!tracksContainer) return;

            tracksContainer.innerHTML = '<div class="py-12 flex justify-center text-primary"><span class="material-symbols-rounded animate-spin text-3xl">sync</span></div>';

            try {
                const { data: tracks, error } = await supabase
                    .from('tracks')
                    .select('*, likes:likes(count)')
                    .eq('profile_id', viewId)
                    .or(isSelf ? 'is_public.eq.true,is_public.eq.false' : 'is_public.eq.true')
                    .order('created_at', { ascending: false });

                if (error) throw error;

                if (!tracks || tracks.length === 0) {
                    tracksContainer.innerHTML = `<div class="p-8 text-center text-slate-500">${isSelf ? 'No tracks uploaded yet. <br/><button class="mt-4 px-6 py-2 bg-primary text-white rounded-full text-sm" data-route="upload">Upload your first track</button>' : 'This user hasn\'t uploaded any tracks yet.'}</div>`;
                } else {
                    tracksContainer.className = "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6";
                    tracksContainer.innerHTML = tracks.map(t => this.renderTrackCard(t)).join('');
                }
            } catch (err) {
                console.error("Profile tracks error", err);
                tracksContainer.innerHTML = `<div class="p-8 text-center text-red-500">Error loading tracks.</div>`;
            }

            // Fetch & Render Playlists
            const playlistsContainer = document.getElementById('profile-playlists-container');
            if (playlistsContainer) {
                playlistsContainer.innerHTML = '<div class="py-8 flex justify-center text-primary"><span class="material-symbols-rounded animate-spin text-2xl">sync</span></div>';
                try {
                    const { data: playlists, error: pErr } = await supabase
                        .from('playlists')
                        .select('*')
                        .eq('profile_id', viewId)
                        .order('created_at', { ascending: false });

                    if (pErr) throw pErr;

                    if (!playlists || playlists.length === 0) {
                        playlistsContainer.innerHTML = '<div class="col-span-full py-12 text-center text-slate-500">No playlists created yet.</div>';
                    } else {
                        if (playlists && playlists.length > 0) {
                            // Manual robust fetch for playlist covers to map to each playlist
                            const playlistIds = playlists.map(p => p.id);
                            let ptData = [];

                            try {
                                const { data } = await supabase.from('playlist_tracks').select('playlist_id, track_id').in('playlist_id', playlistIds);
                                if (data) ptData = data;
                            } catch (e) { console.warn("Could not fetch playlist_tracks for covers", e); }

                            let tracksData = [];
                            if (ptData.length > 0) {
                                const trackIds = ptData.map(pt => pt.track_id);
                                try {
                                    const { data } = await supabase.from('tracks').select('id, cover').in('id', trackIds);
                                    if (data) tracksData = data;
                                } catch (e) { console.warn("Could not fetch tracks for covers", e); }
                            }

                            // Map cover to playlist
                            playlists.forEach(p => {
                                const ptForPlaylist = ptData.find(pt => pt.playlist_id === p.id);
                                if (ptForPlaylist) {
                                    const trackForCover = tracksData.find(t => t.id === ptForPlaylist.track_id);
                                    if (trackForCover) p.firstCover = trackForCover.cover;
                                }
                            });

                            playlistsContainer.innerHTML = playlists.map(p => {
                                const coverUrl = p.firstCover || 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=400&q=80';

                                return `
                            <div class="playlist-card group" onclick="window.app.goTo('playlist', {id: '${p.id}'})">
                                <img src="${coverUrl}" class="playlist-cover" alt="${p.title}">
                                <div class="playlist-info">
                                    <h4 class="playlist-title truncate text-slate-900 dark:text-white">${p.title}</h4>
                                    <div class="playlist-meta">
                                        <span>${p.is_public ? 'Public' : 'Private'}</span>
                                        <span>Playlist</span>
                                    </div>
                                </div>
                            </div>
                            `;
                            }).join('');
                        }
                    }
                } catch (err) {
                    console.error("Playlists fetch error:", err);
                    playlistsContainer.innerHTML = `<div class="col-span-full py-8 text-center text-red-500">Error loading playlists.</div>`;
                }
            }

            // Fetch & Render Liked Tracks
            const likesContainer = document.getElementById('profile-likes-container');
            if (likesContainer) {
                likesContainer.innerHTML = '<div class="py-8 flex justify-center text-primary"><span class="material-symbols-rounded animate-spin text-2xl">sync</span></div>';
                try {
                    const { data: likedEntries, error: lErr } = await supabase
                        .from('likes')
                        .select('*, tracks(*, likes:likes(count))')
                        .eq('profile_id', viewId)
                        .order('created_at', { ascending: false });

                    if (lErr) throw lErr;

                    if (!likedEntries || likedEntries.length === 0) {
                        likesContainer.innerHTML = `<div class="col-span-full py-12 text-center text-slate-500">${isSelf ? 'Tracks you like will appear here.' : 'No liked tracks yet.'}</div>`;
                    } else {
                        likesContainer.className = "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6";
                        likesContainer.innerHTML = likedEntries
                            .filter(entry => entry.tracks)
                            .map(entry => this.renderTrackCard(entry.tracks))
                            .join('');
                    }
                } catch (err) {
                    console.error("Likes fetch error:", err);
                    likesContainer.innerHTML = `<div class="col-span-full py-8 text-center text-red-500">Error loading liked tracks.</div>`;
                }
            }
        }

        async toggleFollow(targetId) {
            const user = JSON.parse(localStorage.getItem('chod_user'));
            if (!user) return this.goTo('auth');

            const btn = document.getElementById('btn-follow');
            if (btn) btn.disabled = true;

            try {
                const { data: existing } = await supabase
                    .from('followers')
                    .select('*')
                    .eq('follower_id', user.id)
                    .eq('following_id', targetId)
                    .single();

                if (existing) {
                    await supabase.from('followers').delete().eq('id', existing.id);
                    this.updateFollowUI(false);
                } else {
                    await supabase.from('followers').insert({ follower_id: user.id, following_id: targetId });
                    this.updateFollowUI(true);
                }

                // Refresh followers count
                const { count } = await supabase.from('followers').select('*', { count: 'exact', head: true }).eq('following_id', targetId);
                const countEl = document.getElementById('prof-followers-count');
                if (countEl) countEl.textContent = this.player.fmtCompact(count || 0);

            } catch (err) {
                console.error("Follow error:", err);
            } finally {
                if (btn) btn.disabled = false;
            }
        }

        updateFollowUI(isFollowing) {
            const btn = document.getElementById('btn-follow');
            if (!btn) return;

            if (isFollowing) {
                btn.classList.replace('btn-primary', 'btn-outline');
                btn.innerHTML = `<span class="material-symbols-rounded">person_remove</span> <span id="follow-text">Unfollow</span>`;
            } else {
                btn.classList.replace('btn-outline', 'btn-primary');
                btn.innerHTML = `<span class="material-symbols-rounded">person_add</span> <span id="follow-text">Follow</span>`;
            }
        }

        renderTrackCard(t) {
            const track = { id: t.id, title: t.title, artist: t.artist, url: t.audio_url, cover: t.cover, genre: t.genre, profile_id: t.profile_id };
            const trackAttr = encodeTrack(track);
            const user = JSON.parse(localStorage.getItem('chod_user'));
            const isOwner = user && user.id === t.profile_id;

            // Get counts (might be nested from Supabase count join)
            const likesCount = t.likes?.[0]?.count ?? (t.likes?.length || 0);
            const playsCount = t.plays_count || 0;

            return `
            <div class="group relative bg-white dark:bg-slate-900/50 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 hover:shadow-lg transition-all">
                <div data-play="${trackAttr}" class="relative aspect-square rounded-xl overflow-hidden mb-4 shadow-md cursor-pointer">
                    <img alt="Cover" class="object-cover w-full h-full transform group-hover:scale-105 transition-transform duration-500" src="${t.cover}" />
                    <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button class="w-12 h-12 bg-primary rounded-full flex items-center justify-center text-white transform translate-y-4 group-hover:translate-y-0 transition-all shadow-lg">
                            <span class="material-symbols-rounded text-3xl">play_arrow</span>
                        </button>
                    </div>
                </div>
                <div class="flex justify-between items-start gap-2 mb-2">
                    <div class="min-w-0 flex-1">
                        <h3 class="font-bold text-lg mb-1 truncate cursor-pointer hover:text-primary transition-colors" data-play="${trackAttr}">${t.title}</h3>
                        <p class="text-slate-500 dark:text-slate-400 text-sm truncate cursor-pointer hover:text-primary transition-colors font-medium" onclick="window.app.goTo('profile', {id: '${t.profile_id}'})">${t.artist}</p>
                    </div>
                    ${isOwner ? `
                    <button onclick="window.app.openEditTrackModal('${trackAttr}')" class="text-slate-400 hover:text-primary p-1 bg-slate-100 dark:bg-slate-800 hover:bg-white rounded-lg transition-colors" title="Edit Track">
                        <span class="material-symbols-rounded text-xl">edit</span>
                    </button>
                    ` : ''}
                </div>
                <!-- Engagement Stats -->
                <div class="flex items-center justify-between gap-4 text-xs font-semibold text-slate-400 dark:text-slate-500 pt-2 border-t border-slate-100 dark:border-slate-800/50">
                    <div class="flex items-center gap-3">
                        <div class="flex items-center gap-1.5">
                            <span class="material-symbols-rounded text-[18px]">play_arrow</span>
                            <span>${this.player.fmtCompact(playsCount)}</span>
                        </div>
                        <div class="flex items-center gap-1.5">
                            <span class="material-symbols-rounded text-[18px]">favorite</span>
                            <span>${this.player.fmtCompact(likesCount)}</span>
                        </div>
                    </div>
                    <div class="border border-slate-200 dark:border-white/10 rounded px-1.5 py-0.5 text-[10px] font-mono font-bold text-slate-400 dark:text-slate-500">
                        ${(!t.duration || t.duration === 0) ? '<audio src="' + t.audio_url + '" preload="metadata" onloadedmetadata="this.nextElementSibling.textContent = window.app.fmtDuration(this.duration)"></audio><span>0s.</span>' : '<span>' + this.fmtDuration(t.duration) + '</span>'}
                    </div>
                </div>
            </div>
            `;
        }

        async setupSearchUI(query) {
            const queryDisplay = document.querySelector('#search-query-display span');
            if (queryDisplay) queryDisplay.textContent = query || '...';

            if (!query) {
                document.getElementById('search-loading-state')?.classList.add('hidden');
                document.getElementById('search-empty-state')?.classList.remove('hidden');
                return;
            }

            const tracksContainer = document.getElementById('search-tracks-container');
            const profilesContainer = document.getElementById('search-profiles-container');
            const genresContainer = document.getElementById('search-genres-container');
            const tracksSection = document.getElementById('search-tracks-section');
            const profilesSection = document.getElementById('search-profiles-section');
            const genresSection = document.getElementById('search-genres-section');
            const loadingState = document.getElementById('search-loading-state');
            const emptyState = document.getElementById('search-empty-state');

            try {
                // 1. Search Tracks (Title or Genre)
                const { data: tracks, error: tErr } = await supabase
                    .from('tracks')
                    .select('*, likes:likes(count)')
                    .eq('is_public', true)
                    .or(`title.ilike.%${query}%,genre.ilike.%${query}%`)
                    .limit(20);

                if (tErr) throw tErr;

                // 2. Search Profiles
                const { data: profiles, error: pErr } = await supabase
                    .from('profiles')
                    .select('*')
                    .or(`username.ilike.%${query}%,first_name.ilike.%${query}%,last_name.ilike.%${query}%`)
                    .limit(20);

                if (pErr) throw pErr;

                // Hide loading
                if (loadingState) loadingState.classList.add('hidden');

                let totalResults = 0;

                // Render Tracks
                if (tracks && tracks.length > 0) {
                    totalResults += tracks.length;
                    tracksSection.classList.remove('hidden');
                    tracksContainer.innerHTML = tracks.map(t => this.renderTrackCard(t)).join('');
                } else {
                    tracksSection.classList.add('hidden');
                }

                // Render Profiles
                if (profiles && profiles.length > 0) {
                    totalResults += profiles.length;
                    profilesSection.classList.remove('hidden');
                    profilesContainer.innerHTML = profiles.map(p => {
                        const fullName = [p.first_name, p.last_name].filter(Boolean).join(' ') || p.username || 'User';
                        return `
                        <div class="group text-center cursor-pointer nav-link" onclick="window.app.goTo('profile', {id: '${p.id}'})">
                            <div class="relative w-full aspect-square rounded-full overflow-hidden mb-3 border-4 border-white dark:border-slate-800 shadow-sm group-hover:border-primary transition-all">
                                <img src="${p.avatar_url || `https://ui-avatars.com/api/?name=${fullName}&background=random`}" class="w-full h-full object-cover">
                            </div>
                            <h4 class="font-bold truncate text-slate-900 dark:text-white group-hover:text-primary transition-colors">${fullName}</h4>
                            <p class="text-xs text-slate-500">Artist</p>
                        </div>
                        `;
                    }).join('');
                } else {
                    profilesSection.classList.add('hidden');
                }

                // Extract genres from tracks (simplistic approach for now)
                const uniqueGenres = [...new Set(tracks.map(t => t.genre).filter(Boolean))];
                if (uniqueGenres.length > 0) {
                    genresSection.classList.remove('hidden');
                    genresContainer.innerHTML = uniqueGenres.map(g => `
                        <button class="px-5 py-2 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-primary hover:text-primary transition-all text-sm font-medium capitalize">
                            ${g}
                        </button>
                    `).join('');
                } else {
                    genresSection.classList.add('hidden');
                }

                if (totalResults === 0) {
                    emptyState.classList.remove('hidden');
                } else {
                    emptyState.classList.add('hidden');
                }

            } catch (err) {
                console.error("Search Error:", err);
                if (loadingState) loadingState.innerHTML = `<p class="text-red-500">Search failed: ${err.message}</p>`;
            }
        }

        async setupFollowingUI() {
            const user = JSON.parse(localStorage.getItem('chod_user'));
            if (!user) {
                this.goTo('auth');
                return;
            }

            const listContainer = document.getElementById('following-list');
            if (!listContainer) return;

            try {
                // Fetch profiles being followed by the current user
                const { data: followed, error } = await supabase
                    .from('followers')
                    .select('profiles!followers_following_id_fkey(*)')
                    .eq('follower_id', user.id);

                if (error) throw error;

                if (!followed || followed.length === 0) {
                    listContainer.innerHTML = `
                        <div class="col-span-full py-20 text-center">
                            <div class="mb-4">
                                <span class="material-symbols-rounded text-6xl text-slate-300">person_add</span>
                            </div>
                            <h3 class="text-xl font-bold text-slate-900 dark:text-white mb-2">Not following anyone yet</h3>
                            <p class="text-slate-500 mb-6">Discover new artists and follow them to see them here.</p>
                            <button onclick="window.app.goTo('home')" class="px-6 py-2 bg-primary text-white rounded-full font-bold hover:bg-brand-deep transition-all">Explore Tracks</button>
                        </div>
                    `;
                    return;
                }

                listContainer.innerHTML = followed.map(f => {
                    const p = f.profiles;
                    if (!p) return '';
                    const fullName = [p.first_name, p.last_name].filter(Boolean).join(' ') || p.username || 'User';
                    const avatarUrl = p.avatar_url || `https://ui-avatars.com/api/?name=${fullName}&background=random`;

                    return `
                    <div class="group bg-white dark:bg-slate-900/50 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 hover:shadow-lg transition-all cursor-pointer" onclick="window.app.goTo('profile', {id: '${p.id}'})">
                        <div class="flex flex-col items-center">
                            <div class="w-24 h-24 rounded-full overflow-hidden mb-4 border-4 border-white dark:border-slate-800 shadow-md group-hover:border-primary transition-all">
                                <img src="${avatarUrl}" class="w-full h-full object-cover">
                            </div>
                            <h4 class="font-bold text-lg text-slate-900 dark:text-white truncate w-full text-center group-hover:text-primary transition-colors">${fullName}</h4>
                            <p class="text-sm text-slate-500 mb-4 text-center">Artist</p>
                            <button class="w-full py-2 bg-primary/10 text-primary font-bold rounded-xl group-hover:bg-primary group-hover:text-white transition-all text-sm">
                                View Profile
                            </button>
                        </div>
                    </div>
                    `;
                }).join('');

            } catch (err) {
                console.error("Following fetch error:", err);
                listContainer.innerHTML = `<div class="col-span-full py-8 text-center text-red-500">Error loading following list.</div>`;
            }
        }

        openEditTrackModal(trackAttr) {
            try {
                const track = decodeTrack(trackAttr);
                if (!track) return;
                const modal = document.getElementById('edit-track-modal');
                if (!modal) return;

                document.getElementById('edit-track-id').value = track.id;
                document.getElementById('edit-title').value = track.title;

                const genreSelect = document.getElementById('edit-genre');
                const genreCustom = document.getElementById('edit-genre-custom');
                const preview = document.getElementById('edit-track-preview');

                if (preview) preview.src = track.cover || '';

                // Show/hide custom genre based on value
                const standardGenres = ['electronic', 'lofi', 'ambient', 'jazz', 'rock', 'pop', 'hiphop'];
                if (track.genre && !standardGenres.includes(track.genre.toLowerCase())) {
                    genreSelect.value = 'other';
                    genreCustom.value = track.genre;
                    genreCustom.classList.remove('hidden');
                } else {
                    genreSelect.value = track.genre || 'other';
                    genreCustom.value = track.genre || '';
                    genreCustom.classList.add('hidden');
                }

                modal.classList.remove('hidden');
                modal.classList.add('flex');

                document.getElementById('edit-track-cover').onchange = (e) => {
                    const reader = new FileReader();
                    reader.onload = (ev) => { if (preview) preview.src = ev.target.result; };
                    if (e.target.files[0]) reader.readAsDataURL(e.target.files[0]);
                };

                document.getElementById('btn-close-edit').onclick = () => this.closeEditModal();
                document.getElementById('btn-cancel-edit').onclick = () => this.closeEditModal();

                const btnDelete = document.getElementById('btn-delete-track');
                if (btnDelete) {
                    btnDelete.onclick = async () => {
                        if (!confirm(`Are you sure you want to delete "${track.title}"? This cannot be undone.`)) return;

                        btnDelete.disabled = true;
                        btnDelete.textContent = "Deleting...";

                        try {
                            const { error } = await supabase.from('tracks').delete().eq('id', track.id);
                            if (error) throw error;

                            alert("Track deleted successfully.");
                            this.closeEditModal();
                            this.setupProfileUI(track.profile_id); // Refresh profile
                        } catch (err) {
                            console.error("Delete Track Error:", err);
                            alert("Failed to delete track: " + err.message);
                            btnDelete.disabled = false;
                            btnDelete.textContent = "Delete Track";
                        }
                    };
                }

                const form = document.getElementById('edit-track-form');
                form.onsubmit = async (e) => {
                    e.preventDefault();

                    const btnSave = document.getElementById('btn-save-edit');
                    const spinner = document.getElementById('edit-spinner');
                    const btnText = document.getElementById('edit-btn-text');

                    btnSave.disabled = true;
                    spinner.classList.remove('hidden');
                    btnText.textContent = "Saving...";

                    try {
                        let finalCover = track.cover;
                        const coverInput = document.getElementById('edit-track-cover');

                        // Handle Cover Upload
                        if (coverInput && coverInput.files[0]) {
                            const file = coverInput.files[0];
                            const fileExt = file.name.split('.').pop();
                            const fileName = `${track.id}_cover_${Date.now()}.${fileExt}`;
                            const filePath = `track_covers/${fileName}`;

                            const { error: uploadError } = await supabase.storage
                                .from('covers')
                                .upload(filePath, file);

                            if (uploadError) throw uploadError;

                            const { data: { publicUrl } } = supabase.storage
                                .from('covers')
                                .getPublicUrl(filePath);

                            finalCover = publicUrl;
                        }

                        const { error } = await supabase
                            .from('tracks')
                            .update({
                                title: document.getElementById('edit-title').value,
                                genre: document.getElementById('edit-genre-custom').value || document.getElementById('edit-genre').value,
                                cover: finalCover
                            })
                            .eq('id', track.id);

                        if (error) throw error;

                        this.closeEditModal();
                        this.setupProfileUI(); // Refresh list

                    } catch (err) {
                        console.error('Failed to update track', err);
                        alert("Update failed: " + err.message);
                    } finally {
                        btnSave.disabled = false;
                        spinner.classList.add('hidden');
                        btnText.textContent = "Save Changes";
                    }
                };

            } catch (e) {
                console.error("Failed to parse edit track data", e);
            }
        }

        closeEditModal() {
            const modal = document.getElementById('edit-track-modal');
            if (modal) {
                modal.classList.add('hidden');
                modal.classList.remove('flex');
            }
        }

        openEditProfileModal(user) {
            const modal = document.getElementById('edit-profile-modal');
            if (!modal) return;

            // Fetch current details from DB first
            supabase.from('profiles').select('*').eq('id', user.id).single().then(({ data }) => {
                if (data) {
                    document.getElementById('edit-prof-firstname').value = data.first_name || '';
                    document.getElementById('edit-prof-lastname').value = data.last_name || '';
                    document.getElementById('edit-prof-username').value = data.username || '';
                    if (data.avatar_url) {
                        document.getElementById('edit-prof-preview').src = data.avatar_url;
                    }
                }
            });

            modal.classList.remove('hidden');
            modal.classList.add('flex');

            document.getElementById('btn-close-profile-edit').onclick = () => this.closeEditProfileModal();
            document.getElementById('btn-cancel-profile-edit').onclick = () => this.closeEditProfileModal();

            const form = document.getElementById('edit-profile-form');
            form.onsubmit = async (e) => {
                e.preventDefault();
                const btnSave = document.getElementById('btn-save-profile-edit');
                const spinner = document.getElementById('edit-prof-spinner');
                const btnText = document.getElementById('edit-prof-btn-text');

                btnSave.disabled = true;
                spinner.classList.remove('hidden');
                btnText.textContent = "Saving...";

                try {
                    const newFirstName = document.getElementById('edit-prof-firstname').value;
                    const newLastName = document.getElementById('edit-prof-lastname').value;
                    const newUsername = document.getElementById('edit-prof-username').value;
                    let newAvatarUrl = document.getElementById('edit-prof-preview').src;

                    // Handle Avatar Upload
                    const avatarInput = document.getElementById('edit-prof-avatar');
                    if (avatarInput && avatarInput.files[0]) {
                        const file = avatarInput.files[0];
                        if (file.size > 2 * 1024 * 1024) throw new Error("Avatar image exceeds 2MB limit.");
                        const fileExt = file.name.split('.').pop();
                        const fileName = `${user.id}_avatar_${Date.now()}.${fileExt}`;
                        const filePath = `${user.id}/${fileName}`;

                        const { error: uploadError } = await supabase.storage
                            .from('avatars')
                            .upload(filePath, file);

                        if (uploadError) throw uploadError;

                        const { data: { publicUrl } } = supabase.storage
                            .from('avatars')
                            .getPublicUrl(filePath);

                        newAvatarUrl = publicUrl;
                    }

                    const { error } = await supabase
                        .from('profiles')
                        .update({
                            first_name: newFirstName,
                            last_name: newLastName,
                            username: newUsername,
                            avatar_url: newAvatarUrl,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', user.id);

                    if (error) throw error;

                    // Update auth metadata
                    await supabase.auth.updateUser({
                        data: {
                            username: newUsername,
                            first_name: newFirstName,
                            last_name: newLastName
                        }
                    });

                    user.username = newUsername;
                    localStorage.setItem('chod_user', JSON.stringify(user));

                    this.closeEditProfileModal();
                    this.setupProfileUI(); // Refresh header

                } catch (err) {
                    console.error('Failed to update profile', err);
                    alert("Update failed: " + err.message);
                } finally {
                    btnSave.disabled = false;
                    spinner.classList.add('hidden');
                    btnText.textContent = "Save Profile";
                }
            };
        }

        closeEditProfileModal() {
            const modal = document.getElementById('edit-profile-modal');
            if (modal) {
                modal.classList.add('hidden');
                modal.classList.remove('flex');
            }
        }

        async setupAudioPlayUI() {
            const trackStr = localStorage.getItem('chod_current_track');
            if (!trackStr) return this.goTo('home');
            let track;
            try { track = JSON.parse(trackStr); } catch (e) { return this.goTo('home'); }

            const user = JSON.parse(localStorage.getItem('chod_user'));

            // Fetch Uploader Profile
            let uploader = null;
            if (track.profile_id) {
                try {
                    const { data } = await supabase.from('profiles').select('*').eq('id', track.profile_id).single();
                    uploader = data;
                } catch (e) { console.error("Could not fetch uploader", e); }
            }

            // Set UI details
            const el = (id) => document.getElementById(id);
            if (el('ap-title')) el('ap-title').textContent = track.title;
            if (el('ap-artist')) el('ap-artist').textContent = track.artist;
            if (el('ap-cover')) el('ap-cover').src = track.cover;
            if (el('ap-uploader-avatar') && uploader) {
                const uploaderName = [uploader.first_name, uploader.last_name].filter(Boolean).join(' ') || uploader.username || 'User';
                el('ap-uploader-avatar').src = uploader.avatar_url || `https://ui-avatars.com/api/?name=${uploader.username || 'User'}&background=00609b&color=fff&size=200`;
                el('ap-uploader-avatar').onclick = () => this.goTo('profile', { id: uploader.id });
                if (el('ap-artist')) el('ap-artist').onclick = () => this.goTo('profile', { id: uploader.id });
            }
            if (el('ap-user-avatar') && user) {
                el('ap-user-avatar').src = user.avatar_url || `https://ui-avatars.com/api/?name=${user.username || 'User'}&background=00609b&color=fff`;
            }

            // Sync with global player
            if (this.player.audio.src !== track.url && !this.player.audio.src.endsWith(track.url)) {
                this.player.playTrack(track);
            }

            // Initialize Wavesurfer
            const container = el('waveform');
            container.innerHTML = '';

            const ws = WaveSurfer.create({
                container: container,
                waveColor: '#B8D0E0',
                progressColor: '#00609b',
                cursorColor: '#003566',
                barWidth: 2,
                barGap: 2,
                barRadius: 2,
                height: 160,
                autoCenter: true,
                media: this.player.audio, // Syncs with global audio element!
            });

            // If audio is already playing/loaded, we might need a little push to show the waveform
            if (this.player.audio.readyState >= 2) {
                ws.load(this.player.audio.src);
            }

            const apPlayBtn = el('ap-play-btn');
            const apPlayIcon = el('ap-play-icon');
            if (apPlayBtn) {
                apPlayBtn.onclick = () => this.player.toggle();
            }

            // --- LIKE BUTTON LOGIC (Audioplay Page) ---
            const apLikeBtn = el('ap-btn-like');
            const syncApLike = async () => {
                if (!apLikeBtn) return;
                const user = JSON.parse(localStorage.getItem('chod_user'));
                if (!user) return;
                const { data } = await supabase.from('likes').select('*').eq('profile_id', user.id).eq('track_id', track.id).single();
                const icon = apLikeBtn.querySelector('.material-symbols-rounded');
                if (icon) {
                    icon.classList.toggle('fill-current', !!data);
                    icon.classList.toggle('text-pink-500', !!data);
                }
            };
            if (apLikeBtn) {
                apLikeBtn.onclick = async () => {
                    await this.player.toggleLike();
                    syncApLike();
                };
                syncApLike();
            }

            // --- VOLUME SLIDER LOGIC (Audioplay Page) ---
            const apVolSlider = el('ap-volume-slider');
            if (apVolSlider) {
                apVolSlider.value = this.player.audio.volume;
                apVolSlider.oninput = (e) => {
                    const val = e.target.value;
                    this.player.audio.volume = val;
                    // Sync with global slider if it exists
                    const globalVol = document.getElementById('volume-slider');
                    if (globalVol) globalVol.value = val;
                };
            }

            // Handle Time updates for Comment Badge
            let currentCommentTime = 0;
            ws.on('timeupdate', (currentTime) => {
                currentCommentTime = currentTime;
                if (el('comment-time-badge')) {
                    el('comment-time-badge').textContent = `Pinned at: ${this.player.fmt(currentTime)}`;
                }
            });

            this.player.audio.addEventListener('play', () => { if (apPlayIcon) apPlayIcon.textContent = 'pause'; });
            this.player.audio.addEventListener('pause', () => { if (apPlayIcon) apPlayIcon.textContent = 'play_arrow'; });
            if (!this.player.audio.paused && apPlayIcon) apPlayIcon.textContent = 'pause';

            // Fetch and Render Comments
            const fetchComments = async () => {
                try {
                    const { data, error } = await supabase
                        .from('comments')
                        .select('*, profiles:profile_id(username, first_name, last_name, avatar_url)')
                        .eq('track_id', track.id)
                        .order('created_at', { ascending: true });

                    if (error) throw error;
                    renderComments(data || []);
                } catch (e) {
                    console.error("Comments fetch error:", e);
                }
            };

            const renderComments = (comments) => {
                const list = el('comments-list');
                const duration = this.player.audio.duration || 1; // Fallback if not loaded

                // Clear old pins
                container.querySelectorAll('.comment-pin').forEach(p => p.remove());

                if (!comments || comments.length === 0) {
                    if (list) list.innerHTML = '<div class="py-8 text-center text-slate-500">No comments yet. Be the first to drop a thought!</div>';
                    return;
                }

                if (list) {
                    list.innerHTML = comments.map(c => {
                        const p = c.profiles || {};
                        const displayName = [p.first_name, p.last_name].filter(Boolean).join(' ') || p.username || 'Unknown';
                        const avatarUrl = p.avatar_url || `https://ui-avatars.com/api/?name=${displayName}&background=00609b&color=fff`;
                        return `
                        <div class="flex gap-4 group hover:bg-slate-50 dark:hover:bg-slate-800/50 p-3 rounded-xl transition-colors">
                            <img class="w-10 h-10 rounded-full cursor-pointer" src="${avatarUrl}" onclick="window.app.goTo('profile', {id: '${c.profile_id}'})" />
                            <div class="flex-1">
                                <div class="flex items-center gap-2 mb-1">
                                    <span class="font-bold text-sm text-slate-900 dark:text-white cursor-pointer hover:text-primary" onclick="window.app.goTo('profile', {id: '${c.profile_id}'})">${displayName}</span>
                                    <span class="text-xs text-slate-400">at</span>
                                    <span class="text-xs font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded cursor-pointer hover:bg-primary/20 transition-colors" onclick="document.getElementById('core-audio-element').currentTime=${c.timestamp}">${this.player.fmt(c.timestamp || 0)}</span>
                                </div>
                                <p class="text-sm text-slate-700 dark:text-slate-300 break-words">${c.content.replace(/</g, "&lt;")}</p>
                            </div>
                        </div>
                        `;
                    }).join('');
                }

                // Render Pins
                if (duration > 1) {
                    comments.forEach(c => {
                        const perc = (c.timestamp / duration) * 100;
                        const pin = document.createElement('div');
                        pin.className = 'comment-pin absolute bottom-0 w-6 h-6 -ml-3 flex items-end justify-center group cursor-pointer pointer-events-auto z-20 hover:z-30';
                        pin.style.left = `${perc}%`;
                        pin.innerHTML = `
                            <div class="w-1 h-3 bg-white border border-primary/20 shadow-sm opacity-60 group-hover:h-full group-hover:bg-primary group-hover:opacity-100 transition-all duration-300"></div>
                            <div class="absolute bottom-full mb-1 bg-slate-900 text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                ${c.profiles?.username}: ${c.content.substring(0, 20)}...
                            </div>
                        `;
                        pin.onclick = (e) => { e.stopPropagation(); this.player.audio.currentTime = c.timestamp; };
                        container.appendChild(pin);
                    });
                }
            };

            // Needs duration to draw pins accurately, wait for Wavesurfer ready
            ws.on('ready', () => { fetchComments(); });

            // Ensure pins draw at least once if audio is already ready
            if (this.player.audio.readyState >= 1) { fetchComments(); }

            // Handle Comment Submission
            const btnPost = el('btn-post-comment');
            const inputComment = el('comment-input');
            if (btnPost && inputComment) {
                btnPost.onclick = async () => {
                    if (!user) { alert("Please sign in to comment."); return this.goTo('auth'); }
                    const txt = inputComment.value.trim();
                    if (!txt) return;

                    btnPost.disabled = true;
                    btnPost.textContent = "Posting...";

                    try {
                        const { error } = await supabase.from('comments').insert({
                            track_id: track.id,
                            profile_id: user.id,
                            content: txt,
                            timestamp: Math.max(0, currentCommentTime) // Use current time or 0
                        });
                        if (error) throw error;

                        inputComment.value = "";
                        await fetchComments();
                    } catch (e) {
                        console.error("Failed to post comment:", e);
                        alert("Failed to post comment.");
                    } finally {
                        btnPost.disabled = false;
                        btnPost.textContent = "Post Comment";
                    }
                };
            }

            // Sync Related Tracks
            const renderRelatedTracks = () => {
                const relatedContainer = el('ap-related-tracks');
                if (!relatedContainer) return;

                const queue = this.player.queue || [];
                // currentIndex might be string, ensure number comparison
                const currentIndex = Number(this.player.currentIndex);

                if (queue.length <= 1) {
                    relatedContainer.innerHTML = '<div class="text-sm text-slate-500 py-4 text-center">No related tracks found.</div>';
                    return;
                }

                let upcoming = [];
                const addedIds = new Set();
                const addTrack = (track) => {
                    if (track && !addedIds.has(track.id) && track.id !== queue[currentIndex]?.id) {
                        upcoming.push(track);
                        addedIds.add(track.id);
                    }
                };

                if (this.player.isShuffle) {
                    // Quick shuffle visualization: grab 5 random tracks not currently playing
                    const shuffled = [...queue].filter((t, i) => i !== currentIndex).sort(() => 0.5 - Math.random());
                    shuffled.forEach(t => { if (upcoming.length < 5) addTrack(t); });
                } else {
                    let nextIdx = currentIndex + 1;
                    while (upcoming.length < 5 && nextIdx < queue.length) {
                        addTrack(queue[nextIdx]);
                        nextIdx++;
                    }
                    if (this.player.isRepeat === 1 && upcoming.length < 5) {
                        // If repeating all, loop around
                        let loopIdx = 0;
                        while (upcoming.length < 5 && loopIdx < currentIndex) {
                            addTrack(queue[loopIdx]);
                            loopIdx++;
                        }
                    }
                }

                if (upcoming.length === 0) {
                    relatedContainer.innerHTML = '<div class="text-sm text-slate-500 py-4 text-center">End of queue.</div>';
                } else {
                    relatedContainer.innerHTML = upcoming.map(t => {
                        // Make sure clicking related track plays it directly
                        // We need the index of this track in the actual queue
                        const actualIndex = queue.findIndex(qt => qt.id === t.id);
                        return `
                        <div class="group flex items-center gap-3 p-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-xl cursor-pointer transition-colors" onclick="window.app.player.playTrack(window.app.player.queue[${actualIndex}], ${actualIndex})">
                            <div class="relative w-12 h-12 rounded overflow-hidden shadow-sm flex-shrink-0">
                                <img src="${t.cover}" class="w-full h-full object-cover">
                                <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <span class="material-symbols-rounded text-white text-xl">play_arrow</span>
                                </div>
                            </div>
                            <div class="flex-1 min-w-0">
                                <p class="font-bold text-sm text-slate-900 dark:text-white truncate group-hover:text-primary transition-colors">${t.title}</p>
                                <p class="text-xs text-slate-500 truncate">${t.artist}</p>
                            </div>
                        </div>
                        `;
                    }).join('');
                }
            };
            renderRelatedTracks();
        }

        async setupPlaylistUI(playlistId) {
            if (!playlistId) return this.goTo('home');
            const el = (id) => document.getElementById(id);

            try {
                // Robust Multi-Step Fetch for Playlists
                const { data: playlist, error } = await supabase
                    .from('playlists')
                    .select('*')
                    .eq('id', playlistId)
                    .single();

                if (error || !playlist) throw error || new Error("Playlist not found");

                // Gracefully fetch owner
                let owner = { username: 'Unknown User' };
                if (playlist.profile_id) {
                    const { data: pf } = await supabase.from('profiles').select('*').eq('id', playlist.profile_id).single();
                    if (pf) owner = pf;
                }

                // Gracefully fetch tracks
                let tracks = [];
                let ptData = null;

                const res = await supabase.from('playlist_tracks').select('track_id').eq('playlist_id', playlist.id).order('created_at', { ascending: true });
                if (res.error) {
                    const fallbackRes = await supabase.from('playlist_tracks').select('track_id').eq('playlist_id', playlist.id);
                    ptData = fallbackRes.data;
                } else {
                    ptData = res.data;
                }

                if (ptData && ptData.length > 0) {
                    const trackIds = ptData.map(p => p.track_id);

                    // Fetch tracks robustly
                    let tData = null;
                    try {
                        // First attempt: simple fetch
                        const { data, error } = await supabase.from('tracks').select('*').in('id', trackIds);
                        if (!error && data) {
                            tData = data;
                            // Second attempt: try to add likes count if possible
                            try {
                                const { data: lData } = await supabase.from('tracks').select('id, likes:likes(count)').in('id', trackIds);
                                if (lData) {
                                    // Map likes back to tData
                                    tData.forEach(track => {
                                        const match = lData.find(l => l.id === track.id);
                                        if (match) track.likes = match.likes;
                                    });
                                }
                            } catch (e) { console.warn("Could not enrich tracks with likes count", e); }
                        }
                    } catch (err) {
                        console.error("Critical error fetching tracks for playlist:", err);
                    }

                    if (tData) {
                        // Reassemble in sequence matching ptData
                        tracks = trackIds.map(tid => tData.find(t => t.id === tid)).filter(Boolean);
                    }
                }

                // Update Header
                if (el('pl-title')) el('pl-title').textContent = playlist.title || 'Untitled Playlist';
                if (el('pl-user-name')) {
                    const fullName = [owner.first_name, owner.last_name].filter(Boolean).join(' ') || owner.username || 'User';
                    el('pl-user-name').textContent = fullName;
                    if (owner.id) el('pl-user-name').onclick = () => this.goTo('profile', { id: owner.id });
                }
                if (el('pl-user-avatar')) {
                    el('pl-user-avatar').src = owner.avatar_url || `https://ui-avatars.com/api/?name=${owner.username || 'User'}&background=random`;
                }
                if (el('pl-track-count')) el('pl-track-count').textContent = `${tracks.length} Tracks`;

                // First track cover for playlist cover
                const firstCover = tracks[0]?.cover;
                if (el('pl-cover')) {
                    el('pl-cover').src = firstCover || 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=600';
                }

                // Play All Button
                const btnPlayAll = el('btn-play-all');
                if (btnPlayAll) {
                    btnPlayAll.onclick = () => {
                        if (tracks.length > 0) {
                            const formattedTracks = tracks.map(t => ({
                                id: t.id,
                                title: t.title,
                                artist: t.artist,
                                url: t.audio_url,
                                cover: t.cover,
                                genre: t.genre,
                                profile_id: t.profile_id
                            }));
                            this.player.queue = formattedTracks;
                            this.player.isShuffle = false;
                            const btn = document.getElementById('btn-shuffle');
                            if (btn) { btn.classList.remove('text-primary'); btn.classList.add('text-slate-400'); }
                            this.player.playTrack(formattedTracks[0], 0);
                            this.goTo('audioplay');
                        }
                    };
                }

                const btnShuffleAll = el('btn-shuffle-all');
                if (btnShuffleAll) {
                    btnShuffleAll.onclick = () => {
                        if (tracks.length > 0) {
                            const formattedTracks = tracks.map(t => ({
                                id: t.id, title: t.title, artist: t.artist, url: t.audio_url, cover: t.cover, genre: t.genre, profile_id: t.profile_id
                            }));
                            this.player.queue = formattedTracks;
                            this.player.isShuffle = true;
                            const btn = document.getElementById('btn-shuffle');
                            if (btn) { btn.classList.add('text-primary'); btn.classList.remove('text-slate-400'); }
                            this.player.playNext(true);
                            this.goTo('audioplay');
                        }
                    };
                }

                // Render tracks
                const list = el('playlist-tracks-list');
                if (list) {
                    if (tracks.length === 0) {
                        list.innerHTML = '<div class="py-20 text-center text-slate-500">This playlist is empty.</div>';
                    } else {
                        list.innerHTML = tracks.map(t => {
                            const trackAttr = encodeTrack(t);
                            const playsCount = t.plays_count || 0;
                            const likesCount = t.likes?.[0]?.count ?? (t.likes?.length || 0);

                            return `
                            <div class="group flex items-center gap-4 p-4 rounded-2xl hover:bg-white/10 transition-colors border border-transparent hover:border-white/5 cursor-pointer" data-play="${trackAttr}">
                                <div class="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 relative">
                                    <img src="${t.cover}" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                    <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <span class="material-symbols-rounded text-white text-3xl">play_arrow</span>
                                    </div>
                                </div>
                                <div class="flex-1 min-w-0">
                                    <h4 class="font-bold text-white truncate group-hover:text-primary transition-colors">${t.title}</h4>
                                    <p class="text-sm text-slate-400 truncate">${t.artist}</p>
                                </div>
                                <div class="hidden md:flex items-center gap-6 text-slate-400 text-xs font-bold font-mono">
                                    <div class="flex items-center gap-1.5">
                                        <span class="material-symbols-rounded text-lg">play_arrow</span>
                                        <span>${this.player.fmtCompact(playsCount)}</span>
                                    </div>
                                    <div class="flex items-center gap-1.5">
                                        <span class="material-symbols-rounded text-lg">favorite</span>
                                        <span>${this.player.fmtCompact(likesCount)}</span>
                                    </div>
                                    <div class="w-16 text-right text-slate-500">
                                        ${(!t.duration || t.duration === 0) ? '<audio src="' + t.audio_url + '" preload="metadata" onloadedmetadata="this.nextElementSibling.textContent = window.app.fmtDuration(this.duration)"></audio><span>0s.</span>' : '<span>' + this.fmtDuration(t.duration) + '</span>'}
                                    </div>
                                </div>
                                <div class="flex items-center gap-2">
                                    <button class="p-2 text-slate-400 hover:text-white transition-colors">
                                        <span class="material-symbols-rounded">more_vert</span>
                                    </button>
                                </div>
                            </div>
                            `;
                        }).join('');
                    }
                }

            } catch (err) {
                console.error("Playlist View Error:", err);
                this.goTo('home');
            }
        }

        async setupAllTracksUI() {
            const el = (id) => document.getElementById(id);
            const container = el('alltracks-container');
            const sortSelect = el('alltracks-sort');
            if (!container) return;

            const fetchAndRender = async () => {
                container.innerHTML = '<div class="col-span-full py-20 flex justify-center text-primary"><span class="material-symbols-rounded animate-spin text-5xl">sync</span></div>';
                try {
                    const sortBy = sortSelect?.value || 'newest';
                    let query = supabase.from('tracks').select('*, likes:likes(count)');

                    if (sortBy === 'newest') query = query.order('created_at', { ascending: false });
                    else if (sortBy === 'plays') query = query.order('plays_count', { ascending: false });

                    let { data: tracks, error } = await query;
                    if (error) throw error;

                    if (sortBy === 'likes') {
                        tracks = tracks.sort((a, b) => {
                            const aL = a.likes?.[0]?.count ?? 0;
                            const bL = b.likes?.[0]?.count ?? 0;
                            return bL - aL;
                        });
                    }

                    if (!tracks || tracks.length === 0) {
                        container.innerHTML = '<div class="col-span-full py-20 text-center text-slate-500">No tracks found.</div>';
                    } else {
                        container.innerHTML = tracks.map(t => this.renderTrackCard(t)).join('');
                    }
                } catch (err) {
                    console.error("AllTracks fetch error:", err);
                    container.innerHTML = '<div class="col-span-full py-8 text-center text-red-500">Error loading tracks.</div>';
                }
            };

            if (sortSelect) {
                sortSelect.onchange = fetchAndRender;
            }
            fetchAndRender();
        }

        async setupCropperUI() {
            const trackStr = localStorage.getItem('chod_current_track');
            if (!trackStr) return this.goTo('home');
            let track;
            try { track = JSON.parse(trackStr); } catch (e) { return this.goTo('home'); }

            const el = (id) => document.getElementById(id);
            if (el('cropper-title')) el('cropper-title').textContent = `${track.title} - ${track.artist}`;

            const container = el('cropper-waveform');
            if (!container) return;
            container.innerHTML = '';

            const ws = WaveSurfer.create({
                container: container,
                waveColor: '#B8D0E0',
                progressColor: '#00609b',
                cursorColor: 'transparent',
                height: 128,
            });

            const wsRegions = ws.registerPlugin(WaveSurfer.Regions.create());

            let currentRegion = null;
            ws.on('decode', () => {
                const dur = ws.getDuration();
                currentRegion = wsRegions.addRegion({
                    start: dur * 0.1,
                    end: dur * 0.3,
                    content: 'Drag to select',
                    color: 'rgba(0, 96, 155, 0.3)',
                    drag: true,
                    resize: true,
                });
                updateTimeInfo();
            });

            wsRegions.on('region-updated', updateTimeInfo);

            function updateTimeInfo() {
                if (!currentRegion) return;
                const fmt = window.app.player.fmt;
                if (el('cropper-time-info')) {
                    el('cropper-time-info').textContent = `${fmt(currentRegion.start)} - ${fmt(currentRegion.end)} (${fmt(currentRegion.end - currentRegion.start)})`;
                }
            }

            // --- ZOOM LOGIC ---
            const zoomSlider = el('cropper-zoom-slider');
            const zoomVal = el('zoom-value');
            if (zoomSlider) {
                zoomSlider.oninput = (e) => {
                    const val = Number(e.target.value);
                    ws.zoom(val);
                    if (zoomVal) zoomVal.textContent = `${val}x`;
                };
            }

            ws.load(track.url);

            const btnDownload = el('btn-download-crop');
            if (btnDownload) {
                btnDownload.onclick = async () => {
                    if (!currentRegion) return alert('Wait for track to load.');
                    const start = currentRegion.start;
                    const end = currentRegion.end;
                    const format = el('cropper-format')?.value || 'wav';

                    btnDownload.disabled = true;
                    if (el('cropper-spinner')) el('cropper-spinner').classList.remove('hidden');
                    if (el('cropper-btn-text')) el('cropper-btn-text').textContent = "Processing...";

                    try {
                        const ctx = new (window.AudioContext || window.webkitAudioContext)();
                        const res = await fetch(track.url);
                        const arrayBuffer = await res.arrayBuffer();
                        const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

                        const frameStart = Math.floor(start * audioBuffer.sampleRate);
                        const frameEnd = Math.floor(end * audioBuffer.sampleRate);
                        const frameLen = frameEnd - frameStart;

                        const offlineCtx = new OfflineAudioContext(
                            audioBuffer.numberOfChannels,
                            frameLen,
                            audioBuffer.sampleRate
                        );

                        const source = offlineCtx.createBufferSource();
                        source.buffer = audioBuffer;
                        source.connect(offlineCtx.destination);
                        source.start(0, start, end - start);

                        const renderedBuffer = await offlineCtx.startRendering();
                        let finalBlob;

                        if (format === 'wav') {
                            finalBlob = audioBufferToWav(renderedBuffer);
                        } else if (format === 'mp3' && window.lamejs) {
                            finalBlob = audioBufferToMp3(renderedBuffer);
                        } else {
                            throw new Error("Format not supported or missing encoder.");
                        }

                        // Download
                        const dlUrl = URL.createObjectURL(finalBlob);
                        const a = document.createElement('a');
                        a.href = dlUrl;
                        a.download = `${track.title.replace(/\\s+/g, '_')}_cropped.${format}`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(dlUrl);

                    } catch (e) {
                        console.error('Cropper Error:', e);
                        alert("Cropping failed: " + e.message);
                    } finally {
                        btnDownload.disabled = false;
                        if (el('cropper-spinner')) el('cropper-spinner').classList.add('hidden');
                        if (el('cropper-btn-text')) el('cropper-btn-text').textContent = "Download Selection";
                    }
                };
            }

            function audioBufferToWav(buffer) {
                const numChannels = buffer.numberOfChannels;
                const sampleRate = buffer.sampleRate;
                const format = 1; // PCM
                const bitDepth = 16;
                const result = numChannels === 2 ? interleave(buffer.getChannelData(0), buffer.getChannelData(1)) : buffer.getChannelData(0);
                const dataLength = result.length * (bitDepth / 8);
                const bufferArray = new ArrayBuffer(44 + dataLength);
                const view = new DataView(bufferArray);

                const writeString = (v, offset, str) => {
                    for (let i = 0; i < str.length; i++) v.setUint8(offset + i, str.charCodeAt(i));
                };

                writeString(view, 0, 'RIFF');
                view.setUint32(4, 36 + dataLength, true);
                writeString(view, 8, 'WAVE');
                writeString(view, 12, 'fmt ');
                view.setUint32(16, 16, true);
                view.setUint16(20, format, true);
                view.setUint16(22, numChannels, true);
                view.setUint32(24, sampleRate, true);
                view.setUint32(28, sampleRate * numChannels * (bitDepth / 8), true);
                view.setUint16(32, numChannels * (bitDepth / 8), true);
                view.setUint16(34, bitDepth, true);
                writeString(view, 36, 'data');
                view.setUint32(40, dataLength, true);

                let offset = 44;
                for (let i = 0; i < result.length; i++, offset += 2) {
                    let s = Math.max(-1, Math.min(1, result[i]));
                    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
                }
                return new Blob([view], { type: 'audio/wav' });
            }

            function interleave(l, r) {
                const res = new Float32Array(l.length + r.length);
                for (let i = 0, j = 0; i < l.length; i++) {
                    res[j++] = l[i]; res[j++] = r[i];
                }
                return res;
            }

            function audioBufferToMp3(buffer) {
                const numChannels = buffer.numberOfChannels;
                const sampleRate = buffer.sampleRate;
                const mp3enc = new lamejs.Mp3Encoder(numChannels, sampleRate, 128);

                let left = buffer.getChannelData(0);
                let right = numChannels === 2 ? buffer.getChannelData(1) : left;

                const sampleBlock = 1152;
                const leftData = new Int16Array(left.length);
                const rightData = new Int16Array(right.length);

                for (let i = 0; i < left.length; i++) {
                    let l = Math.max(-1, Math.min(1, left[i]));
                    leftData[i] = l < 0 ? l * 0x8000 : l * 0x7FFF;
                    let r = Math.max(-1, Math.min(1, right[i]));
                    rightData[i] = r < 0 ? r * 0x8000 : r * 0x7FFF;
                }

                const mp3Data = [];
                for (let i = 0; i < leftData.length; i += sampleBlock) {
                    const lChunk = leftData.subarray(i, i + sampleBlock);
                    const rChunk = rightData.subarray(i, i + sampleBlock);
                    const buf = mp3enc.encodeBuffer(lChunk, numChannels === 2 ? rChunk : undefined);
                    if (buf.length > 0) mp3Data.push(buf);
                }
                const tail = mp3enc.flush();
                if (tail.length > 0) mp3Data.push(tail);

                return new Blob(mp3Data, { type: 'audio/mp3' });
            }
        }
    }

    const start = () => {
        if (initSupabase()) {
            window.app = new ChodApp();
        } else if (initRetries < 20) {
            initRetries++; setTimeout(start, 500);
        }
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
